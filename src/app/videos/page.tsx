'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { RadioTower, RefreshCw, Search, Tv2, DownloadCloud, ScanSearch, PlayCircle, Eye, TrendingUp, Clock3, ExternalLink, AlertCircle, CheckCircle2, Loader2, SlidersHorizontal } from 'lucide-react';
import { auth } from '@/lib/firebase';
import PanelShell from '@/components/panel-shell';

type Channel={id:string;title:string;thumbnail?:string;importedCount?:number};
type Video={id:string;title:string;thumbnail:string;publishedAt:string;views:number;growth:number|null;growth24h?:number|null;growth7d?:number|null;growth30d?:number|null;actualStartTime:string};
type ApiResult={videos:Video[];totalLives:number;totalImported:number;unclassified:number;limited?:boolean};
const fmt=(n:number)=>new Intl.NumberFormat('pt-BR').format(n);
const gainLabel=(n:number|null|undefined)=>n==null?'Aguardando histórico':`${n>=0?'+':''}${fmt(n)}`;
const ageDays=(s:string)=>{const n=new Date(s).getTime();return Number.isFinite(n)?Math.floor((Date.now()-n)/86400000):0};
const dateLabel=(s:string)=>{const d=new Date(s);return Number.isNaN(d.getTime())?'Data indisponível':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d)};

export default function VideosPage(){
 const [channels,setChannels]=useState<Channel[]>([]);
 const [channelId,setChannelId]=useState('');
 const [videos,setVideos]=useState<Video[]>([]);
 const [days,setDays]=useState(1),[age,setAge]=useState(0),[query,setQuery]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [totalLives,setTotalLives]=useState(0),[unclassified,setUnclassified]=useState(0),[limited,setLimited]=useState(false);
 const requestVersion=useRef(0);
 const api=useCallback(async(path:string,body?:unknown, signal?:AbortSignal)=>{
  const user=auth.currentUser;if(!user)throw new Error('Faça login novamente');
  const res=await fetch(path,{method:body===undefined?'GET':'POST',signal,cache:'no-store',headers:{Authorization:`Bearer ${await user.getIdToken()}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await res.json();if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);return data;
 },[]);
 const loadChannels=useCallback(async()=>{const data=await api('/api/channels');const ch=(data.channels||[]) as Channel[];setChannels(ch);const wanted=new URLSearchParams(window.location.search).get('channelId');setChannelId(prev=>ch.some(c=>c.id===prev)?prev:(ch.find(c=>c.id===wanted)?.id||ch[0]?.id||''));},[api]);
 const loadVideos=useCallback(async(signal?:AbortSignal)=>{
  const version=++requestVersion.current;
  if(!channelId){setVideos([]);setTotalLives(0);setLoading(false);return;}
  setLoading(true);setError('');setVideos([]);setTotalLives(0);setUnclassified(0);
  try{const data=await api(`/api/monitor/videos?channelId=${encodeURIComponent(channelId)}&days=${days}`,undefined,signal) as ApiResult;
   if(signal?.aborted||version!==requestVersion.current)return;
   // Defesa extra: não reutilizar resultados quando o usuário trocar de canal.
   setVideos(data.videos||[]);setTotalLives(data.totalLives||0);setUnclassified(data.unclassified||0);setLimited(Boolean(data.limited));
  }catch(e){if(signal?.aborted||version!==requestVersion.current)return;setError(e instanceof Error?e.message:'Falha ao consultar lives');}
  finally{if(!signal?.aborted&&version===requestVersion.current)setLoading(false);}
 },[api,channelId,days]);
 useEffect(()=>{const unsubscribe=onAuthStateChanged(auth,u=>{if(u)void loadChannels().catch(e=>setError(e.message));else{setChannels([]);setChannelId('');setVideos([]);setLoading(false);}});return unsubscribe;},[loadChannels]);
 useEffect(()=>{const ctrl=new AbortController();void loadVideos(ctrl.signal);return()=>{ctrl.abort();requestVersion.current++;};},[loadVideos]);
 async function run(endpoint:'import'|'classify'|'collect'){
  const selected=channelId;if(!selected||busy)return;setBusy(true);setError('');setMessage('Preparando operação...');
  try{let done=false,total=0,cursor='',lives=0;
   for(let i=0;i<500&&!done;i++){
    const data=await api(`/api/monitor/${endpoint}`,endpoint==='import'?{channelId:selected}:{channelId:selected,cursor});
    total+=Number(data.imported??data.processed??data.scanned??0);
    lives+=Number(data.lives??data.confirmed??data.updated??0);
    done=Boolean(data.done);cursor=data.nextCursor||'';
    setMessage(`${endpoint==='import'?'Importação':endpoint==='classify'?'Identificação':'Coleta'}: ${fmt(total)} vídeos percorridos · ${fmt(lives)} lives ${endpoint==='collect'?'atualizadas':'identificadas'}${done?' — concluído':'…'}`);
   }
   if(!done)setMessage('Limite de lotes atingido. Execute novamente para continuar.');
   await loadChannels();
   if(auth.currentUser && selected===channelId)await loadVideos();
  }catch(e){setError(e instanceof Error?e.message:'Falha na operação');}finally{setBusy(false);}
 }
 const filtered=useMemo(()=>videos.filter(v=>(age===0||new Date(v.actualStartTime||v.publishedAt).getTime()<=Date.now()-age*86400000)&&v.title.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))),[videos,age,query]);
 const measured=videos.filter(v=>v.growth!==null).length;
 const selectedChannel=channels.find(c=>c.id===channelId);
 const field='w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:opacity-50';
 return <PanelShell><main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
  <div className="mb-8 flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600"><RadioTower size={13}/> Monitoramento</div><h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Monitor de lives</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Explore transmissões encerradas, compare períodos e identifique oportunidades de conteúdo.</p></div>
    <button disabled={loading||busy||!channelId} onClick={()=>void loadVideos()} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading?'animate-spin':''}/> Recarregar lista</button>
  </div>
  <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_35px_-25px_rgba(15,23,42,.32)] sm:p-6">
    <div className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-800"><SlidersHorizontal size={17} className="text-indigo-600"/> Filtros de monitoramento</div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
      <label className="block xl:col-span-5"><span className="mb-2 block text-xs font-bold text-slate-500">Canal do YouTube</span><select className={field} value={channelId} onChange={e=>{setMessage('');setQuery('');setChannelId(e.target.value)}} disabled={busy}>{channels.length===0&&<option value="">Nenhum canal cadastrado</option>}{channels.map(c=><option key={c.id} value={c.id}>{c.title} ({fmt(c.importedCount||0)} importados)</option>)}</select></label>
      <label className="block xl:col-span-3"><span className="mb-2 block text-xs font-bold text-slate-500">Comparar crescimento</span><select className={field} value={days} onChange={e=>setDays(Number(e.target.value))}><option value={1}>Últimas 24 horas*</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option></select></label>
      <label className="block xl:col-span-4"><span className="mb-2 block text-xs font-bold text-slate-500">Idade da transmissão</span><select className={field} value={age} onChange={e=>setAge(Number(e.target.value))}><option value={0}>Todas as idades (0 dias)</option><option value={30}>Mais de 30 dias</option><option value={180}>Mais de 6 meses</option><option value={365}>Mais de 1 ano</option><option value={730}>Mais de 2 anos</option></select></label>
    </div>
    <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
      <button disabled={busy||!channelId} onClick={()=>void run('import')} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"><DownloadCloud size={16}/> Importar vídeos</button>
      <button disabled={busy||!channelId} onClick={()=>void run('classify')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ScanSearch size={16}/> Identificar lives</button>
      <button disabled={busy||!channelId} onClick={()=>void run('collect')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{busy?<Loader2 size={16} className="animate-spin"/>:<RefreshCw size={16}/>} Atualizar visualizações</button>
    </div>
    {message&&<p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-800"><CheckCircle2 size={16}/>{message}</p>}
    {error&&<p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={17}/>{error}</p>}
  </section>
  <div className="mb-7 grid gap-4 sm:grid-cols-3">
   {([{label:"Canal selecionado",value:selectedChannel?.title||"Nenhum canal",Icon:Tv2},{label:"Lives confirmadas",value:fmt(totalLives),Icon:PlayCircle},{label:"Com crescimento medido",value:fmt(measured),Icon:TrendingUp}]).map(({label,value,Icon},i)=><div key={label} className="flex min-w-0 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${i===0?'bg-indigo-50 text-indigo-600':i===1?'bg-blue-50 text-blue-600':'bg-emerald-50 text-emerald-600'}`}><Icon size={22}/></span><div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-1 truncate font-extrabold tracking-tight text-slate-900 ${i===0?'text-base':'text-2xl'}`}>{value}</p></div></div>)}
  </div>
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="text-lg font-extrabold text-slate-900">Transmissões encerradas</h2><p className="mt-1 text-xs text-slate-500">{loading?'Carregando lives…':`${fmt(filtered.length)} lives exibidas · ${selectedChannel?.title||'Selecione um canal'}`}</p></div><label className="relative block w-full sm:max-w-xs"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar pelo título..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"/></label></div>
    {loading?<div className="flex items-center justify-center gap-3 px-6 py-20 text-sm font-medium text-slate-500"><Loader2 className="animate-spin text-indigo-600"/> Buscando lives do canal selecionado...</div>:filtered.length===0?<div className="px-6 py-20 text-center"><span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-400"><RadioTower size={28}/></span><h3 className="font-bold text-slate-800">Nenhuma live encontrada</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{query?'Tente outro título ou ajuste os filtros.':'Importe os vídeos e use “Identificar lives” para classificar as transmissões desse canal.'}</p></div>:<div className="divide-y divide-slate-100">{filtered.map((v,i)=><article key={v.id} className="group flex flex-col gap-4 p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:p-5"><div className="relative shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:w-40"><img src={v.thumbnail} alt="Miniatura da transmissão" loading="lazy" className="aspect-video w-full object-cover"/><span className="absolute bottom-2 left-2 rounded-md bg-slate-950/85 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Live encerrada</span></div><div className="min-w-0 flex-1"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">#{i+1} · {selectedChannel?.title}</p><a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm font-extrabold leading-snug text-slate-900 hover:text-indigo-600 sm:text-base">{v.title}</a><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><Clock3 size={14}/> {dateLabel(v.actualStartTime||v.publishedAt)}</span><span className="inline-flex items-center gap-1.5"><Eye size={14}/> {fmt(v.views||0)} visualizações</span></div></div><div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end"><div className="text-left sm:text-right">
{v.growth===null?<span className="text-xs font-medium text-amber-600">Aguardando histórico</span>:<><p className={`text-xl font-extrabold ${v.growth>0?'text-emerald-500':'text-slate-400'}`}>{gainLabel(v.growth)}</p><p className="text-[11px] text-slate-400">ganhas no período selecionado</p></>}
{ageDays(v.actualStartTime||v.publishedAt)>=365 && (v.growth24h??0)>=100 && v.growth24h!==null && v.growth24h!==undefined && v.views>0 && v.growth24h/Math.max(1,v.views-v.growth24h)>=0.02 && <span className="mt-1 inline-block rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">LIVE ANTIGA EM ALTA</span>}
<div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
<div><span className="block text-slate-400">24h*</span><span className={v.growth24h!=null&&v.growth24h>0?'font-bold text-emerald-400':'text-slate-300'}>{gainLabel(v.growth24h)}</span></div>
<div><span className="block text-slate-400">7 dias</span><span className={v.growth7d!=null&&v.growth7d>0?'font-bold text-emerald-400':'text-slate-300'}>{gainLabel(v.growth7d)}</span></div>
<div><span className="block text-slate-400">30 dias</span><span className={v.growth30d!=null&&v.growth30d>0?'font-bold text-emerald-400':'text-slate-300'}>{gainLabel(v.growth30d)}</span></div>
</div></div><a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${v.title} no YouTube`} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"><ExternalLink size={16}/></a></div></article>)}</div>}
    {(limited||unclassified>0)&&<div className="border-t border-slate-100 bg-amber-50/70 px-5 py-3 text-xs text-amber-800">{limited?'A consulta atingiu o limite de vídeos do canal. ':''}{unclassified>0?`${fmt(unclassified)} vídeos ainda precisam de classificação.`:''}</div>}
  </section>
  <p className="mt-5 text-xs leading-5 text-slate-400">Ordenação: maior ganho de visualizações no período escolhido. O selo “Live antiga em alta” exige ao menos 1 ano de idade, 100 novas views e 2% de crescimento no intervalo diário. Somente transmissões confirmadas como encerradas. *24 horas é uma comparação por dias UTC, não uma janela móvel exata. O crescimento depende de coletas históricas e não pode ser recuperado retroativamente.</p>
 </main></PanelShell>;
}
