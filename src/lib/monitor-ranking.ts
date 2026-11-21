import 'server-only';
import { adminDb } from '@/lib/firebase-admin';
import { growthFor, type ViewsHistory } from '@/lib/monitor';

type Video = {id:string;title:string;thumbnail:string;publishedAt:string;actualStartTime:string;views:number;growth:number|null};
type Ranking = {videos:Video[];totalLives:number;totalImported:number;unclassified:number;limited:boolean};

// Materialized view: 1 document read per channel in normal Dashboard requests.
// Rebuild only after completing a collection, not on each page open.
export async function buildRanking(channelId:string):Promise<void> {
  const db=adminDb();
  const snap=await db.collection('videos').where('channelId','==',channelId).limit(3000).get();
  const groups:Record<string, Video[]> = {'1':[],'7':[],'30':[]};
  let totalLives=0, unclassified=0;
  for(const doc of snap.docs){
    const v=doc.data();
    if(!v.liveStatus)unclassified++;
    if(v.liveStatus!=='ended')continue;
    totalLives++;
    const current=Number(v.views||0);
    const common={id:doc.id,title:String(v.title||''),thumbnail:String(v.thumbnail||''),publishedAt:String(v.publishedAt||''),actualStartTime:String(v.actualStartTime||''),views:current};
    for(const days of [1,7,30] as const){
      groups[String(days)].push({...common,growth:growthFor(v.viewHistory as ViewsHistory|undefined,current,days)});
    }
  }
  const results:Record<string,Ranking>={};
  for(const days of [1,7,30] as const){
    const data=groups[String(days)].sort((a,b)=>(b.growth??-Infinity)-(a.growth??-Infinity));
    // 100 is consistent with the existing interface and keeps the Firestore cache document small.
    results[String(days)]={videos:data.slice(0,100),totalLives,totalImported:snap.size,unclassified,limited:snap.size===3000};
  }
  await db.collection('monitorRankings').doc(channelId).set({channelId,generatedAt:new Date().toISOString(),results});
}

export async function getRanking(channelId:string,days:1|7|30):Promise<Ranking & {generatedAt:string|null}> {
  const db=adminDb();
  const ref=db.collection('monitorRankings').doc(channelId);
  let doc=await ref.get();
  if(!doc.exists){
    // One-off bootstrap for existing installations; no N daily-history reads.
    await buildRanking(channelId);
    doc=await ref.get();
  }
  const raw=doc.data();
  const result=raw?.results?.[String(days)] as Ranking|undefined;
  return {...(result || {videos:[],totalLives:0,totalImported:0,unclassified:0,limited:false}),generatedAt:raw?.generatedAt||null};
}
