import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/server-auth';
import { yt } from '@/lib/monitor';
import { buildRanking } from '@/lib/monitor-ranking';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function POST(req:NextRequest) {
  try {
    await requireAdmin(req);
    const {channelId}=await req.json();
    if(typeof channelId!=='string'||!/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) return NextResponse.json({error:'Canal inválido'},{status:400});
    const db=adminDb(), ref=db.collection('channels').doc(channelId), snap=await ref.get();
    if(!snap.exists) return NextResponse.json({error:'Canal não cadastrado'},{status:404});
    const channel=snap.data()!;
    if(!channel.uploadsPlaylistId) return NextResponse.json({error:'Playlist de uploads indisponível'},{status:400});
    if(Number(channel.importLockUntil||0)>Date.now()) return NextResponse.json({error:'Importação em andamento'},{status:409});
    await ref.update({importLockUntil:Date.now()+90000});
    try {
      const result=await yt('playlistItems',{part:'snippet,contentDetails',playlistId:channel.uploadsPlaylistId,maxResults:'50',...(channel.importNextPageToken?{pageToken:channel.importNextPageToken}:{})});
      const playlistItems = (result.items || []) as Array<{ contentDetails?: { videoId?: string } }>;
      const ids = playlistItems.map(x => x.contentDetails?.videoId).filter((id): id is string => typeof id === 'string' && id.length > 0);
      const detail=ids.length?await yt('videos',{part:'snippet,statistics,contentDetails,liveStreamingDetails',id:ids.join(',')}):{items:[]};
      const videos=detail.items||[];
      const batch=db.batch();let lives=0;
      for(const video of videos){
        const d=video.liveStreamingDetails;
        const ended=Boolean(d?.actualStartTime && d?.actualEndTime);
        if(ended)lives++;
        batch.set(db.collection('videos').doc(video.id),{
          channelId,title:video.snippet?.title||'',publishedAt:video.snippet?.publishedAt||'',
          thumbnail:video.snippet?.thumbnails?.medium?.url||video.snippet?.thumbnails?.default?.url||'',
          duration:video.contentDetails?.duration||'',
          liveStatus:ended?'ended':d?.actualStartTime?'unknown':'not_confirmed',
          actualStartTime:d?.actualStartTime||null,actualEndTime:d?.actualEndTime||null,
          liveCheckedAt:new Date().toISOString(),createdFromImportAt:new Date().toISOString(),
          views:Number(video.statistics?.viewCount||0),likes:Number(video.statistics?.likeCount||0)
        },{merge:true});
      }
      if(videos.length)await batch.commit();
      const done=!result.nextPageToken;
      await ref.update({importNextPageToken:result.nextPageToken||null,status:done?'imported':'importing',importedCount:Number(channel.importedCount||0)+videos.length,importLockUntil:0,lastImportedAt:new Date().toISOString()});
      if(done) await buildRanking(channelId);
      return NextResponse.json({imported:videos.length,lives,done,nextPage:!!result.nextPageToken});
    } finally {await ref.update({importLockUntil:0}).catch(()=>{});}
  } catch(e){console.error('[MONITOR IMPORT]',e);return NextResponse.json({error:'Falha na importação. Consulte o terminal.'},{status:500});}
}
