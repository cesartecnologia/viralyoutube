import 'server-only';
import { adminDb } from '@/lib/firebase-admin';
import type { DocumentSnapshot } from 'firebase-admin/firestore';

export const dayUTC = (d: Date = new Date()): string => d.toISOString().slice(0, 10);
export function daysAgo(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - n);
  return dayUTC(d);
}

export async function yt(endpoint: string, params: Record<string,string>) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY não configurada');
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${new URLSearchParams({...params,key})}`, {cache:'no-store'});
  const data = await response.json();
  if (!response.ok) throw new Error(`YouTube ${response.status}: ${data.error?.message || 'Erro de consulta'}`);
  return data;
}

export type ViewsHistory = Record<string,number>;
export function growthFor(history: ViewsHistory | undefined, current: number, period: 1|7|30, now = new Date()): number | null {
  const baseline = history?.[daysAgo(period, now)];
  return typeof baseline === 'number' && Number.isFinite(baseline) ? current - baseline : null;
}

// Recebe snapshots já consultados pela paginação: nenhuma leitura extra por live.
// Mantém no próprio documento apenas os 32 últimos dias de referências.
// Não sobrescreve estatísticas no mesmo dia e não escreve subcoleções daily.
export async function saveStats(
  items: Array<{id:string; statistics?:{viewCount?:string;likeCount?:string}}>,
  sourceDocs: DocumentSnapshot[]
): Promise<number> {
  const db=adminDb(), today=dayUTC();
  const existing=new Map(sourceDocs.map(d=>[d.id,d]));
  const batch=db.batch();
  const cutoff=daysAgo(31);
  let changed=0;
  for(const item of items){
    const d=existing.get(item.id);
    if(!d || !item.statistics || d.data()?.liveStatus!=='ended') continue;
    const old=d.data() || {};
    if(old.lastCheckedDay===today) continue;
    const views=Number(item.statistics.viewCount||0);
    if(!Number.isFinite(views)) continue;
    const prior=(old.viewHistory && typeof old.viewHistory==='object' ? old.viewHistory : {}) as ViewsHistory;
    const history:ViewsHistory={};
    for(const [date,value] of Object.entries(prior)) {
      if(/^\d{4}-\d{2}-\d{2}$/.test(date) && date>=cutoff && date<=today && Number.isFinite(value)) history[date]=value;
    }
    history[today]=views;
    batch.set(d.ref, {views, likes:Number(item.statistics.likeCount||0),lastCheckedAt:new Date().toISOString(),lastCheckedDay:today,viewHistory:history}, {merge:true});
    changed++;
  }
  if(changed) await batch.commit();
  return changed;
}
