import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);
    if (!/^UC[a-zA-Z0-9_-]{22}$/.test(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    await adminDb().collection('channels').doc(params.id).delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    return NextResponse.json({ error: message === 'UNAUTHORIZED' || message === 'FORBIDDEN' ? message : 'Erro interno' }, { status: message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500 });
  }
}
