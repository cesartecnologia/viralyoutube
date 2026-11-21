import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/server-auth';
import { deriveOpportunities } from '@/lib/viral-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = adminDb();
    const selected = req.nextUrl.searchParams.get('channelId') || 'all';
    if (selected !== 'all' && !/^UC[a-zA-Z0-9_-]{22}$/.test(selected)) {
      return NextResponse.json({error: 'Canal inválido'}, {status: 400});
    }
    // Channel list is intentionally small. Never scan the videos collection here.
    const channelSnap = await db.collection('channels').limit(31).get();
    if (channelSnap.size > 30) {
      return NextResponse.json({error: 'Limite de 30 canais na análise comparativa. Selecione um subconjunto antes de ampliar.'}, {status: 422});
    }
    const channels = channelSnap.docs.map(doc => ({id: doc.id, title: String(doc.get('title') || doc.id)}));
    const chosen = selected === 'all' ? channels : channels.filter(c => c.id === selected);
    if (selected !== 'all' && chosen.length === 0) {
      return NextResponse.json({error: 'Canal não cadastrado'}, {status: 404});
    }
    const refs = chosen.map(c => db.collection('monitorRankings').doc(c.id));
    const snaps = refs.length ? await db.getAll(...refs) : [];
    const missingCache: string[] = [];
    const sources = snaps.flatMap((snap, index) => {
      const data = snap.data();
      if (!data?.results) { missingCache.push(chosen[index].title); return []; }
      return [{id: chosen[index].id, title: chosen[index].title, results: data.results}];
    });
    const opportunities = deriveOpportunities(sources);
    return NextResponse.json({
      channels, selected, opportunities,
      totalCandidates: opportunities.length,
      analyzedChannels: sources.length,
      missingCache,
      generatedAt: new Date().toISOString(),
      source: 'monitorRankings',
      limitations: 'Até 100 lives por canal e período, conforme os rankings em cache. Comparações exigem coletas em dias diferentes (UTC).',
    }, {headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'UNAUTHORIZED') return NextResponse.json({error: code}, {status: 401});
    if (code === 'FORBIDDEN') return NextResponse.json({error: code}, {status: 403});
    console.error('[INTELLIGENCE]', error);
    return NextResponse.json({error: 'Não foi possível calcular as oportunidades. Consulte os logs do servidor.'}, {status: 500});
  }
}
