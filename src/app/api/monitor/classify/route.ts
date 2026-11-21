import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/server-auth';
import { yt } from '@/lib/monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const valid = (s: unknown): s is string => typeof s === 'string' && /^UC[a-zA-Z0-9_-]{22}$/.test(s);

// Reclassifica vídeos JÁ importados sem apagar estatísticas ou histórico.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const { channelId, cursor } = body;
    if (!valid(channelId)) return NextResponse.json({error:'Canal inválido'}, {status:400});
    if (cursor != null && cursor !== '' && (typeof cursor !== 'string' || !/^[\w-]{11}$/.test(cursor))) return NextResponse.json({error:'Cursor inválido'}, {status:400});
    const db = adminDb();
    if (!(await db.collection('channels').doc(channelId).get()).exists) return NextResponse.json({error:'Canal não cadastrado'}, {status:404});
    let query = db.collection('videos').where('channelId','==',channelId).orderBy('__name__');
    if (cursor) query = query.startAfter(db.collection('videos').doc(cursor));
    const snap = await query.limit(50).get();
    const ids = snap.docs.map(d=>d.id);
    let confirmed = 0, unknown = 0;
    if (ids.length) {
      const result = await yt('videos',{part:'liveStreamingDetails,snippet,contentDetails',id:ids.join(',')});
      const byId = new Map<string, any>((result.items || []).map((v:any)=>[v.id,v]));
      const batch = db.batch();
      for (const doc of snap.docs) {
        const video = byId.get(doc.id);
        if (!video) {batch.set(doc.ref,{liveStatus:'unknown',liveCheckedAt:new Date().toISOString()},{merge:true});unknown++;continue;}
        const d = video.liveStreamingDetails;
        const ended = Boolean(d?.actualStartTime && d?.actualEndTime);
        // Sem metadados suficientes não afirmar que foi live.
        const status = ended ? 'ended' : d?.actualStartTime ? 'unknown' : 'not_confirmed';
        if (ended) confirmed++; else if (status==='unknown') unknown++;
        batch.set(doc.ref, {
          liveStatus:status,
          actualStartTime:d?.actualStartTime || null,
          actualEndTime:d?.actualEndTime || null,
          liveCheckedAt:new Date().toISOString(),
        },{merge:true});
      }
      await batch.commit();
    }
    return NextResponse.json({processed:ids.length,confirmed,unknown,nextCursor:ids.length===50?ids[ids.length-1]:null,done:ids.length<50});
  } catch(e) {console.error('[MONITOR CLASSIFY]',e);return NextResponse.json({error:'Falha ao identificar lives. Consulte o terminal.'},{status:500});}
}
