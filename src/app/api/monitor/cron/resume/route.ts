import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { CollectionBusyError, runDailyCollection } from '@/lib/daily-collection';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    return NextResponse.json(await runDailyCollection(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof CollectionBusyError) return NextResponse.json({ error: 'Já existe uma coleta em andamento.' }, { status: 409 });
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: message }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: message }, { status: 403 });
    console.error('[MANUAL CRON RESUME]', error);
    return NextResponse.json({ error: 'Falha ao continuar a coleta. Verifique os logs do servidor.' }, { status: 500 });
  }
}
