import 'server-only';
import { randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/firebase-admin';
import { yt, saveStats, dayUTC } from '@/lib/monitor';
import { buildRanking } from '@/lib/monitor-ranking';

// Tenta concluir a coleta diária em uma única invocação, respeitando o
// limite de 60 segundos configurado na rota da Vercel.
// Se o tempo terminar, o cursor fica salvo para uma retomada posterior.
const PAGE_SIZE = 50;
const MAX_PAGES = 60;
const MAX_YOUTUBE_CALLS = 60;
const TIME_BUDGET_MS = 45_000;
const LEASE_MS = 110_000;

type JobState = {
  runDate?: string;
  completed?: boolean;
  channelId?: string | null;
  cursor?: string | null;
  lockUntil?: number;
  leaseOwner?: string | null;
  totalScanned?: number;
  totalUpdated?: number;
  totalYoutubeCalls?: number;
};
export type CollectResult = {
  completed: boolean;
  skipped?: boolean;
  date: string;
  scanned: number;
  updated: number;
  youtubeCalls: number;
  nextChannel: string | null;
  nextCursor: string | null;
  totalScanned: number;
  totalUpdated: number;
  message: string;
};
export class CollectionBusyError extends Error {
  constructor() { super('COLETA_EM_ANDAMENTO'); }
}

export async function runDailyCollection(): Promise<CollectResult> {
  const db = adminDb();
  const jobRef = db.collection('monitorJobs').doc('dailyCollect');
  const today = dayUTC();
  const owner = randomUUID();
  const started = Date.now();
  console.info('[DAILY COLLECT] Início', { date: today });

  const initial = await db.runTransaction(async tx => {
    const snap = await tx.get(jobRef);
    const old = (snap.data() || {}) as JobState;
    if (old.runDate === today && old.completed === true) return { kind: 'done' as const, old };
    if (Number(old.lockUntil || 0) > Date.now()) return { kind: 'busy' as const, old };
    const sameDay = old.runDate === today;
    const state: JobState = sameDay ? old : {
      runDate: today, completed: false, channelId: null, cursor: null,
      totalScanned: 0, totalUpdated: 0, totalYoutubeCalls: 0,
    };
    tx.set(jobRef, {
      ...state,
      lockUntil: Date.now() + LEASE_MS,
      leaseOwner: owner,
      lastErrorAt: null,
      startedAt: sameDay ? (snap.get('startedAt') || new Date().toISOString()) : new Date().toISOString(),
    }, { merge: true });
    return { kind: 'claimed' as const, old: state };
  });

  if (initial.kind === 'busy') throw new CollectionBusyError();
  if (initial.kind === 'done') return {
    completed: true, skipped: true, date: today, scanned: 0, updated: 0,
    youtubeCalls: 0, nextChannel: null, nextCursor: null,
    totalScanned: Number(initial.old.totalScanned || 0),
    totalUpdated: Number(initial.old.totalUpdated || 0),
    message: 'A coleta de hoje (UTC) já foi concluída.',
  };

  let scanned = 0, updated = 0, youtubeCalls = 0, pages = 0;
  let totalScanned = Number(initial.old.totalScanned || 0);
  let totalUpdated = Number(initial.old.totalUpdated || 0);
  let totalYoutubeCalls = Number(initial.old.totalYoutubeCalls || 0);
  let nextChannel = initial.old.channelId || null;
  let nextCursor = initial.old.cursor || null;
  let completed = false;

  async function checkpoint() {
    // Don't overwrite a newer invocation if this lease was replaced.
    await db.runTransaction(async tx => {
      const snap = await tx.get(jobRef);
      if (snap.get('leaseOwner') !== owner) throw new CollectionBusyError();
      tx.set(jobRef, {
        runDate: today, channelId: nextChannel, cursor: nextCursor,
        completed, completedAt: completed ? new Date().toISOString() : null,
        totalScanned, totalUpdated, totalYoutubeCalls,
        lastProgressAt: new Date().toISOString(),
      }, { merge: true });
    });
  }

  try {
    const channels = await db.collection('channels').orderBy('__name__').get();
    const ids = channels.docs.map(d => d.id);
    if (ids.length === 0) {
      completed = true;
      nextChannel = null;
      nextCursor = null;
      await checkpoint();
    } else {
      let i = nextChannel ? ids.indexOf(nextChannel) : 0;
      if (i < 0) { i = 0; nextCursor = null; }
      while (i < ids.length && pages < MAX_PAGES && youtubeCalls < MAX_YOUTUBE_CALLS && Date.now() - started < TIME_BUDGET_MS) {
        const channelId = ids[i];
        nextChannel = channelId;
        let query = db.collection('videos').where('channelId', '==', channelId).orderBy('__name__');
        if (nextCursor) query = query.startAfter(db.collection('videos').doc(nextCursor));
        const snap = await query.limit(PAGE_SIZE).get();
        const candidates = snap.docs.filter(d => d.data().liveStatus === 'ended' && d.data().lastCheckedDay !== today);
        if (candidates.length) {
          const response = await yt('videos', { part: 'statistics', id: candidates.map(d => d.id).join(',') });
          updated += await saveStats(response.items || [], candidates);
          youtubeCalls++;
          totalYoutubeCalls++;
        }
        pages++;
        scanned += snap.size;
        totalScanned += snap.size;
        totalUpdated = Number(initial.old.totalUpdated || 0) + updated;
        const channelEnded = snap.size < PAGE_SIZE;
        if (channelEnded) {
          // Ranking is rebuilt once per channel, not once per page.
          await buildRanking(channelId);
          i++;
          nextChannel = ids[i] || null;
          nextCursor = null;
        } else {
          nextCursor = snap.docs[snap.docs.length - 1].id;
        }
        await checkpoint();
      }
      if (i >= ids.length) {
        completed = true;
        nextChannel = null;
        nextCursor = null;
        await checkpoint();
      }
    }
    console.info('[DAILY COLLECT] Resultado', {
      date: today, completed, scanned, updated, youtubeCalls,
      totalScanned, totalUpdated, nextChannel, hasCursor: Boolean(nextCursor),
    });
    return {
      completed, date: today, scanned, updated, youtubeCalls,
      nextChannel, nextCursor, totalScanned, totalUpdated,
      message: completed
        ? 'Coleta diária concluída.'
        : 'Execução parcial: progresso salvo. Necessária nova invocação para concluir.',
    };
  } catch (error) {
    console.error('[DAILY COLLECT] Falha', error);
    await db.runTransaction(async tx => {
      const snap = await tx.get(jobRef);
      if (snap.get('leaseOwner') !== owner) return;
      tx.set(jobRef, { lastErrorAt: new Date().toISOString(), lastErrorCode: error instanceof Error ? error.name : 'UNKNOWN' }, { merge: true });
    }).catch(() => {});
    throw error;
  } finally {
    await db.runTransaction(async tx => {
      const snap = await tx.get(jobRef);
      if (snap.get('leaseOwner') === owner) tx.set(jobRef, { lockUntil: 0, leaseOwner: null }, { merge: true });
    }).catch(() => {});
  }
}
