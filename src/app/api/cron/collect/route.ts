import { NextRequest, NextResponse } from 'next/server';
import { CollectionBusyError, runDailyCollection } from '@/lib/daily-collection';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const result = await runDailyCollection();
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof CollectionBusyError) return NextResponse.json({ error: 'COLETA_EM_ANDAMENTO' }, { status: 409 });
    console.error('[CRON COLLECT]', error);
    return NextResponse.json({ error: 'Falha na coleta. Verifique os logs do servidor.' }, { status: 500 });
  }
}
