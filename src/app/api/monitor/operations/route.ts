import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Job = Record<string, unknown>;
function safeJob(data?: FirebaseFirestore.DocumentData): Job | null {
  if (!data) return null;
  // Explicit allowlist: never send exceptions, tokens or credentials to the client.
  const keys = ['runDate', 'completed', 'completedAt', 'startedAt', 'channelId', 'cursor', 'lastErrorAt', 'lockUntil', 'lastProgressAt', 'totalScanned', 'totalUpdated', 'totalYoutubeCalls'];
  return Object.fromEntries(keys.filter(k => Object.prototype.hasOwnProperty.call(data, k)).map(k => [k, data[k] ?? null]));
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = adminDb();
    const channelSnapshots = await db.collection('channels').get();
    const channelDocs = channelSnapshots.docs;
    const refs = [db.collection('monitorJobs').doc('dailyCollect'), ...channelDocs.map(d => db.collection('monitorJobs').doc(`manual_${d.id}`))];
    // One batch of reads of tiny job-state documents; no video/daily-history scan.
    const jobs = await db.getAll(...refs);
    const channels = channelDocs.map((d, i) => ({
      id: d.id,
      title: String(d.get('title') || d.id),
      importedCount: Number(d.get('importedCount') || 0),
      status: String(d.get('status') || 'unknown'),
      manual: safeJob(jobs[i + 1]?.data()),
    }));
    return NextResponse.json({
      serverTime: new Date().toISOString(),
      cron: safeJob(jobs[0]?.data()),
      channels,
      note: 'Dados operacionais, não métricas de quota. Verifique a cota real no Firebase Console.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'UNAUTHORIZED') return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (code === 'FORBIDDEN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    console.error('[MONITOR OPERATIONS]', error);
    return NextResponse.json({ error: 'Falha ao consultar estado das coletas. Veja o terminal.' }, { status: 500 });
  }
}
