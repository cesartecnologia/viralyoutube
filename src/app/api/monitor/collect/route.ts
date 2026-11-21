import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/server-auth';
import { yt, saveStats, dayUTC } from '@/lib/monitor';
import { buildRanking } from '@/lib/monitor-ranking';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 try{
  await requireAdmin(req);
  const {channelId,cursor}=await req.json().catch(()=>({}));
  if(typeof channelId!=='string'||!/^UC[a-zA-Z0-9_-]{22}$/.test(channelId))return NextResponse.json({error:'Canal inválido'},{status:400});
  if(cursor!=null&&cursor!==''&&(typeof cursor!=='string'||!/^[\w-]{11}$/.test(cursor)))return NextResponse.json({error:'Cursor inválido'},{status:400});
  const db=adminDb(), today=dayUTC();
  const channelRef=db.collection('channels').doc(channelId);
  if(!(await channelRef.get()).exists)return NextResponse.json({error:'Canal não cadastrado'},{status:404});
  const jobRef=db.collection('monitorJobs').doc('manual_'+channelId);
  const job=(await jobRef.get()).data()||{};
  if(job.runDate===today && job.completed===true)return NextResponse.json({updated:0,scanned:0,nextCursor:null,done:true,skipped:true,message:'Canal já coletado hoje (UTC).'});
  // Prevent another request from jumping ahead or repeating a page in the same daily run.
  const expected=job.runDate===today && !job.completed?String(job.cursor||''):'';
  if((cursor||'')!==expected)return NextResponse.json({error:'Cursor desatualizado. Reinicie a coleta após verificar o estado do job.'},{status:409});
  if(Number(job.lockUntil||0)>Date.now())return NextResponse.json({error:'Coleta já em andamento'},{status:409});
  await jobRef.set({runDate:today,lockUntil:Date.now()+90000,completed:false},{merge:true});
  try{
   let query=db.collection('videos').where('channelId','==',channelId).orderBy('__name__');
   if(cursor)query=query.startAfter(db.collection('videos').doc(cursor));
   const snap=await query.limit(50).get();
   const candidates=snap.docs.filter(d=>d.data().liveStatus==='ended' && d.data().lastCheckedDay!==today);
   let updated=0;
   if(candidates.length){const result=await yt('videos',{part:'statistics',id:candidates.map(d=>d.id).join(',')});updated=await saveStats(result.items||[],candidates);}
   const done=snap.size<50;
   const nextCursor=done?null:snap.docs[snap.docs.length-1].id;
   await jobRef.set({runDate:today,cursor:nextCursor,completed:done,lockUntil:0,completedAt:done?new Date().toISOString():null},{merge:true});
   if(done) await buildRanking(channelId);
   return NextResponse.json({updated,scanned:snap.size,nextCursor,done,skipped:candidates.length===0});
  }finally{await jobRef.set({lockUntil:0},{merge:true}).catch(()=>{});}
 }catch(e){console.error('[MONITOR COLLECT]',e);return NextResponse.json({error:'Falha na coleta. Consulte o terminal.'},{status:500});}
}
