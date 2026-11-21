'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { CheckCircle2, ExternalLink, Film, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import PanelShell from '@/components/panel-shell';

type CutStatus = 'na_fila' | 'editando' | 'publicado';
type Plan = {videoId:string; channelId:string; title:string; thumbnail:string; status:CutStatus; notes:string; publishedUrl:string; updatedAt:string|null};
const names:Record<CutStatus,string> = {na_fila:'Na fila',editando:'Editando',publicado:'Publicado'};

export default function CortesPage() {
  const [authorized,setAuthorized] = useState(false);
  const [plans,setPlans] = useState<Plan[]>([]);
  const [drafts,setDrafts] = useState<Record<string,Plan>>({});
  const [loading,setLoading] = useState(false);
  const [pending,setPending] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [query,setQuery] = useState('');
  const [status,setStatus] = useState<'all'|CutStatus>('all');

  const request = useCallback(async (method:'GET'|'PATCH'|'DELETE', body?:object) => {
    const user=auth.currentUser;
    if(!user) throw new Error('Faça login para continuar.');
    const token=await user.getIdToken();
    const response=await fetch('/api/cortes',{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || `Erro ${response.status}`);
    return data;
  },[]);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {
      const result=await request('GET');
      setPlans(result.plans || []);
      setDrafts(Object.fromEntries((result.plans || []).map((v:Plan)=>[v.videoId,v])));
    } catch(e){setError(e instanceof Error?e.message:'Falha ao carregar');}
    finally {setLoading(false);}
  },[request]);
  useEffect(()=>onAuthStateChanged(auth,user=>setAuthorized(Boolean(user))),[]);
  useEffect(()=>{if(authorized)void load();else{setPlans([]);setDrafts({});}},[authorized,load]);
  const visible=useMemo(()=>plans.filter(p=>(status==='all'||(drafts[p.videoId]?.status??p.status)===status)&&(!query.trim()||p.title.toLowerCase().includes(query.toLowerCase()))),[plans,drafts,status,query]);
  function edit(id:string,patch:Partial<Plan>){setDrafts(previous=>({...previous,[id]:{...previous[id],...patch}}));}
  async function save(id:string){
    setPending(id);setError('');setNotice('');
    try{const d=drafts[id];await request('PATCH',{videoId:id,status:d.status,notes:d.notes,publishedUrl:d.publishedUrl});setNotice('Alterações salvas.');await load();}
    catch(e){setError(e instanceof Error?e.message:'Falha ao salvar');}finally{setPending('');}
  }
  async function remove(id:string){
    if(!window.confirm('Remover esta live do planejamento? O vídeo original não será excluído.'))return;
    setPending(id);setError('');
    try{await request('DELETE',{videoId:id});await load();setNotice('Item removido do planejamento.');}
    catch(e){setError(e instanceof Error?e.message:'Falha ao remover');}finally{setPending('');}
  }
  const count=(s:CutStatus)=>plans.filter(p=>p.status===s).length;
  return <PanelShell><main className="mx-auto max-w-[1500px] px-5 py-8 text-slate-100 sm:px-8 lg:px-10">
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.3em] text-cyan-300">J.A.R.V.I.S. / CONTENT WORKFLOW</p><h1 className="mt-2 text-3xl font-black tracking-tight">Planejamento de cortes</h1><p className="mt-2 text-sm text-slate-400">Da live em alta até o vídeo publicado, tudo organizado em um só lugar.</p></div><button type="button" onClick={()=>void load()} disabled={!authorized||loading} className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-200 disabled:opacity-50"><RefreshCw size={16}/>Atualizar</button></div>
    <div className="mb-6 grid gap-3 sm:grid-cols-3">{(['na_fila','editando','publicado'] as CutStatus[]).map(s=><div key={s} className="rounded-2xl border border-cyan-500/20 bg-[#0d1d2e] p-5"><p className="text-xs text-slate-400">{names[s]}</p><p className="mt-2 text-3xl font-black text-cyan-200">{count(s)}</p></div>)}</div>
    <section className="mb-5 flex flex-wrap gap-3 rounded-2xl border border-cyan-500/20 bg-[#0d1d2e] p-4"><label className="relative min-w-[220px] flex-1"><Search size={17} className="absolute left-3 top-3.5 text-slate-400"/><input className="w-full rounded-xl border border-cyan-500/20 bg-[#081625] py-3 pl-10 pr-3 text-sm text-white" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por título"/></label><select aria-label="Filtrar por status" value={status} onChange={e=>setStatus(e.target.value as 'all'|CutStatus)} className="rounded-xl border border-cyan-500/20 bg-[#081625] px-3 py-3 text-sm text-white"><option value="all">Todos os status</option>{Object.entries(names).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></section>
    {error&&<p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-red-200">{error}</p>}
    {notice&&<p role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-emerald-200">{notice}</p>}
    {loading?<p className="py-16 text-center text-slate-400">Carregando planejamento...</p>:visible.length===0?<div className="rounded-2xl border border-cyan-500/20 bg-[#0d1d2e] p-12 text-center"><Film size={34} className="mx-auto text-cyan-300"/><h2 className="mt-4 text-lg font-bold">Nenhuma live no planejamento</h2><p className="mt-2 text-sm text-slate-400">Entre em Inteligência IA e clique em “Separar para corte” em uma transmissão encerrada.</p><a href="/inteligencia" className="mt-4 inline-block text-sm font-bold text-cyan-300">Abrir Inteligência IA</a></div>:
    <div className="grid gap-4 xl:grid-cols-2">{visible.map(p=>{const d=drafts[p.videoId]??p;return <article key={p.videoId} className="rounded-2xl border border-cyan-500/20 bg-[#0d1d2e] p-5"><div className="flex gap-4"><img src={p.thumbnail || '/favicon.ico'} alt="" loading="lazy" className="aspect-video h-24 w-40 rounded-xl object-cover"/><div className="min-w-0"><h2 className="line-clamp-2 font-bold leading-6">{p.title}</h2><a className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300" href={`https://www.youtube.com/watch?v=${p.videoId}`} target="_blank" rel="noopener noreferrer">Assistir live <ExternalLink size={14}/></a></div></div><div className="mt-4 grid gap-3"><label className="text-xs font-semibold text-slate-400">Etapa<select value={d.status} onChange={e=>edit(p.videoId,{status:e.target.value as CutStatus})} className="mt-2 w-full rounded-xl border border-cyan-500/20 bg-[#081625] px-3 py-3 text-sm text-white">{Object.entries(names).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label className="text-xs font-semibold text-slate-400">Observações / ideias<textarea rows={3} maxLength={1000} value={d.notes||''} onChange={e=>edit(p.videoId,{notes:e.target.value})} placeholder="Trechos, assunto, título sugerido..." className="mt-2 w-full rounded-xl border border-cyan-500/20 bg-[#081625] p-3 text-sm text-white"/></label><label className="text-xs font-semibold text-slate-400">Link do corte publicado<input type="url" maxLength={400} value={d.publishedUrl||''} onChange={e=>edit(p.videoId,{publishedUrl:e.target.value})} placeholder="https://youtube.com/watch?v=..." className="mt-2 w-full rounded-xl border border-cyan-500/20 bg-[#081625] p-3 text-sm text-white"/></label></div><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-cyan-500/10 pt-4"><button type="button" disabled={Boolean(pending)} onClick={()=>void remove(p.videoId)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"><Trash2 size={16}/>Remover</button><button type="button" disabled={Boolean(pending)} onClick={()=>void save(p.videoId)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-[#061221] hover:bg-cyan-400 disabled:opacity-50">{d.status==='publicado'?<CheckCircle2 size={16}/>:<Save size={16}/>} {pending===p.videoId?'Salvando...':'Salvar alterações'}</button></div></article>})}</div>}
    <p className="mt-7 text-xs leading-6 text-slate-400">Esta área armazena apenas um documento por live selecionada. Não faz buscas no histórico de visualizações. A lista mostra até 200 itens mais recentes; itens adicionais exigirão paginação futura. O uso de material de terceiros requer atenção às permissões e aos direitos autorais.</p>
  </main></PanelShell>;
}
