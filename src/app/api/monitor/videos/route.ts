import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getRanking } from '@/lib/monitor-ranking';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req);
  const channelId=req.nextUrl.searchParams.get('channelId');
  if(!channelId || !/^UC[a-zA-Z0-9_-]{22}$/.test(channelId))return NextResponse.json({error:'Selecione um canal'}, {status:400});
  const days=Number(req.nextUrl.searchParams.get('days')||1);
  if(![1,7,30].includes(days))return NextResponse.json({error:'Período inválido'}, {status:400});
  return NextResponse.json(await getRanking(channelId,days as 1|7|30),{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('[MONITOR VIDEOS]',e);return NextResponse.json({error:'Falha ao consultar ranking. Consulte o terminal.'},{status:500});}
}
