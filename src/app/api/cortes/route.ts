import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const validId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v);
const statuses = ['na_fila', 'editando', 'publicado'] as const;
type Status = typeof statuses[number];
const validStatus = (v: unknown): v is Status => typeof v === 'string' && statuses.some(s => s === v);
const respond = (error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  if (code === 'UNAUTHORIZED' || code === 'TOKEN_AUSENTE' || code === 'TOKEN_INVALIDO_OU_EXPIRADO') return NextResponse.json({error:'Sessão inválida. Faça login novamente.'},{status:401});
  if (code === 'FORBIDDEN' || code === 'SEM_PERMISSAO_ADMIN' || code === 'ADMIN_EMAIL_NAO_CONFIGURADO') return NextResponse.json({error:'Acesso administrativo negado.'},{status:403});
  console.error('[CORTES]', error);
  return NextResponse.json({error:'Falha no planejamento. Consulte o terminal.'},{status:500});
};

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    // Maximum 200 items to cap Firestore reads. No per-video history reads.
    const docs = await adminDb().collection('cutPlans').orderBy('updatedAt', 'desc').limit(200).get();
    const plans = docs.docs.map(d => ({videoId:d.id, ...d.data(), createdAt:d.get('createdAt')?.toDate?.()?.toISOString() ?? null, updatedAt:d.get('updatedAt')?.toDate?.()?.toISOString() ?? null}));
    return NextResponse.json({plans, limit:200, limited:docs.size===200}, {headers:{'Cache-Control':'private, no-store'}});
  } catch(e) { return respond(e); }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    if (!validId(body.videoId)) return NextResponse.json({error:'ID do vídeo inválido.'},{status:400});
    const db = adminDb();
    const source = await db.collection('videos').doc(body.videoId).get();
    if (!source.exists || source.get('liveStatus') !== 'ended') return NextResponse.json({error:'A transmissão precisa estar importada e identificada como encerrada.'},{status:400});
    const ref = db.collection('cutPlans').doc(body.videoId);
    const result = await db.runTransaction(async tx => {
      const found = await tx.get(ref);
      if (found.exists) return false;
      tx.create(ref, {
        channelId:String(source.get('channelId') || ''), title:String(source.get('title') || ''), thumbnail:String(source.get('thumbnail') || ''),
        status:'na_fila', notes:'', publishedUrl:'', publishedAt:null,
        createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(),
      });
      return true;
    });
    return NextResponse.json({created:result,videoId:body.videoId},{status:result?201:200});
  } catch(e) { return respond(e); }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    if (!validId(body.videoId) || !validStatus(body.status) || typeof body.notes !== 'string' || body.notes.length > 1000 || typeof body.publishedUrl !== 'string' || body.publishedUrl.length > 400) return NextResponse.json({error:'Dados inválidos.'},{status:400});
    if (body.publishedUrl) {
      try { const url = new URL(body.publishedUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
      catch { return NextResponse.json({error:'O link publicado precisa ser uma URL http(s).'}, {status:400}); }
    }
    const ref = adminDb().collection('cutPlans').doc(body.videoId);
    const result = await adminDb().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      tx.update(ref,{status:body.status,notes:body.notes.trim(),publishedUrl:body.publishedUrl.trim(),updatedAt:FieldValue.serverTimestamp(),publishedAt:body.status==='publicado'?(snap.get('publishedAt') || FieldValue.serverTimestamp()):null});
      return true;
    });
    if (!result) return NextResponse.json({error:'Item não encontrado.'},{status:404});
    return NextResponse.json({ok:true});
  } catch(e) { return respond(e); }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    if (!validId(body.videoId)) return NextResponse.json({error:'ID inválido.'},{status:400});
    await adminDb().collection('cutPlans').doc(body.videoId).delete();
    return NextResponse.json({ok:true});
  } catch(e) { return respond(e); }
}
