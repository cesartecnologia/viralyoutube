'use client';
import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import { Activity, AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Clock3, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';
import PanelShell from '@/components/panel-shell';

type Job = {runDate?:string|null;completed?:boolean;completedAt?:string|null;startedAt?:string|null;channelId?:string|null;cursor?:string|null;lastErrorAt?:string|null;lockUntil?:number|null;lastProgressAt?:string|null;totalScanned?:number|null;totalUpdated?:number|null;totalYoutubeCalls?:number|null} | null;
type Channel = {id:string;title:string;importedCount:number;status:string;manual:Job};
type Status = {serverTime:string;cron:Job;channels:Channel[];note:string};
const formatDate = (v?:string|null) => {
  if(!v) return 'Não registrada';
  const d=new Date(v);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d);
};
function state(job:Job){
  if(!job) return {label:'Sem execução registrada',color:'text-slate-400'};
  if(job.lockUntil && job.lockUntil>Date.now()) return {label:'Execução em andamento',color:'text-cyan-300'};
  if(job.completed) return {label:'Última execução concluída',color:'text-emerald-300'};
  if(job.lastErrorAt) return {label:'Verificar logs da execução',color:'text-amber-300'};
  return {label:'Execução pendente ou interrompida',color:'text-amber-300'};
}
export default function OperationsPage(){
  const [info,setInfo]=useState<Status|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [collecting,setCollecting]=useState(false),[collectMessage,setCollectMessage]=useState('');
  const load=useCallback(async(signal?:AbortSignal)=>{
    if(!auth.currentUser)return;
    setLoading(true);setError('');
    try{
      const token=await auth.currentUser.getIdToken();
      const response=await fetch('/api/monitor/operations',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || `HTTP ${response.status}`);
      if(!signal?.aborted)setInfo(data as Status);
    }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'Falha ao consultar operações');}
    finally{if(!signal?.aborted)setLoading(false);}
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    const unsub=onAuthStateChanged(auth,user=>{if(user)void load(controller.signal);else setLoading(false);});
    return()=>{controller.abort();unsub();};
  },[load]);
  const resume = useCallback(async () => {
    if (!auth.currentUser || collecting) return;
    setCollecting(true); setError(''); setCollectMessage('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/monitor/cron/resume', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setCollectMessage(`${data.message} Nesta execução: ${Number(data.scanned || 0)} vídeos verificados, ${Number(data.updated || 0)} lives atualizadas.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na coleta');
    } finally { setCollecting(false); }
  }, [collecting, load]);
  const cron=info?.cron;
  const s=state(cron??null);
  return <PanelShell><main className="mx-auto max-w-[1480px] px-5 py-8 text-slate-100 sm:px-8 lg:px-10 lg:py-10">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300"><Activity size={14}/> SYSTEM / OPERATIONS</div>
      <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Central de operações</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">Acompanhe o estado das coletas com consultas leves, sem ler o histórico individual das lives.</p>
    </div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"><RefreshCw size={16} className={loading?'animate-spin':''}/> Atualizar estado</button></div>
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-400/20 bg-[#0b1a29] p-5">
      <div className="min-w-0 flex-1"><h2 className="font-bold text-white">Coleta em lotes com retomada</h2><p className="mt-1 text-xs text-slate-400">Processa até 250 vídeos por clique; continue até concluir. Uma execução por vez.</p></div>
      <button type="button" onClick={()=>void resume()} disabled={collecting || loading || Boolean(cron?.lockUntil && cron.lockUntil>Date.now())} className="rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-5 py-3 text-sm font-bold text-cyan-200 hover:bg-cyan-400/25 disabled:opacity-50">{collecting?'Processando lote...':cron?.completed && cron.runDate===new Date().toISOString().slice(0,10)?'Coleta diária concluída — verificar novamente':'Iniciar / continuar coleta'}</button>
      <p className="basis-full text-xs text-slate-400">Progresso da data {cron?.runDate||'—'}: {Number(cron?.totalScanned||0).toLocaleString('pt-BR')} vídeos verificados · {Number(cron?.totalUpdated||0).toLocaleString('pt-BR')} lives atualizadas · {Number(cron?.totalYoutubeCalls||0)} consultas YouTube. Último avanço: {formatDate(cron?.lastProgressAt)}.</p>
      {collectMessage&&<p role="status" className="basis-full text-sm text-emerald-300">{collectMessage}</p>}
    </div>
    {error&&<div role="alert" className="mb-5 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertTriangle size={18}/>{error}</div>}
    <div className="mb-6 grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-cyan-500/20 bg-[#0c2031] p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><CalendarClock size={16}/> Coleta agendada</div><div className={`mt-4 text-lg font-extrabold ${s.color}`}>{loading?'Consultando...':s.label}</div><p className="mt-2 text-xs text-slate-400">Última data processada: {cron?.runDate||'Não registrada'}</p></div>
      <div className="rounded-2xl border border-cyan-500/20 bg-[#0c2031] p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><Database size={16}/> Canais cadastrados</div><p className="mt-4 text-3xl font-black text-white">{loading?'—':info?.channels.length??0}</p><p className="mt-2 text-xs text-slate-400">Somente documentos de controle consultados</p></div>
      <div className="rounded-2xl border border-cyan-500/20 bg-[#0c2031] p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><Clock3 size={16}/> Última conclusão automática</div><p className="mt-4 text-lg font-extrabold text-white">{formatDate(cron?.completedAt)}</p><p className="mt-2 text-xs text-slate-400">Horário de Brasília</p></div>
    </div>
    <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0b1a29]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 p-5"><div><h2 className="text-lg font-bold text-white">Coleta manual por canal</h2><p className="mt-1 text-xs text-slate-400">Último estado salvo pelo monitor, sem disparar novas coletas</p></div><Link href="/videos" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300">Abrir monitor <ArrowUpRight size={15}/></Link></div>
    {loading&&!info?<p className="p-6 text-sm text-slate-400">Carregando registros...</p>:!info?.channels.length?<p className="p-6 text-sm text-slate-400">Nenhum canal cadastrado.</p>:<div className="divide-y divide-cyan-500/10">{info.channels.map(c=>{const st=state(c.manual);return <div key={c.id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0"><h3 className="font-semibold text-slate-100">{c.title}</h3><p className="mt-1 text-xs text-slate-400">{c.importedCount.toLocaleString('pt-BR')} importações registradas · {c.manual?.runDate||'sem coleta manual'}</p></div><div className="flex items-center gap-2 text-xs"><CheckCircle2 size={16} className={st.color}/><span className={st.color}>{st.label}</span></div></div>;})}</div>}
    </section>
    <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-slate-300"><div className="flex items-center gap-2 font-semibold text-amber-300"><ShieldCheck size={17}/> Consumo do Firebase</div><p className="mt-2 leading-6">Esta página mostra apenas o estado dos trabalhos. Ela <strong>não mostra a quota restante do Firestore</strong>. Consulte o uso real em Firebase Console → Firestore Database → Uso. Não repita coletas enquanto houver erro de quota.</p><a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-cyan-300">Abrir Firebase Console <ArrowUpRight size={14}/></a></div>
  </main></PanelShell>;
}
