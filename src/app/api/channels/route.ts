import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/server-auth';
import { resolveChannel } from '@/lib/channel-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(error: unknown) {
  const msg = error instanceof Error ? error.message : 'Erro interno';
  const status = msg === 'UNAUTHORIZED' ? 401 : msg === 'FORBIDDEN' ? 403 : 500;
  if (status === 500) console.error('[API /api/channels] Erro interno:', error);
  return NextResponse.json({ error: status === 500 ? 'Falha interna. Consulte o terminal do Next.js.' : msg }, { status });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snapshot = await adminDb().collection('channels').get();
    return NextResponse.json({ channels: snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null })) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    if (typeof body.url !== 'string' || body.url.length > 300) return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    let channel;
    try { channel = await resolveChannel(body.url); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Canal inválido' }, { status: 400 }); }
    const ref = adminDb().collection('channels').doc(channel.id);
    const result = await adminDb().runTransaction(async transaction => {
      const existing = await transaction.get(ref);
      if (existing.exists) return false;
      transaction.create(ref, {
        title: channel.snippet.title,
        description: channel.snippet.description || '',
        thumbnail: channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url || '',
        subscriberCount: Number(channel.statistics?.subscriberCount || 0),
        videoCount: Number(channel.statistics?.videoCount || 0),
        uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || '',
        createdAt: FieldValue.serverTimestamp(),
        status: 'pending_import'
      });
      return true;
    });
    if (!result) return NextResponse.json({ error: 'Canal já cadastrado' }, { status: 409 });
    return NextResponse.json({ id: channel.id, title: channel.snippet.title }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
