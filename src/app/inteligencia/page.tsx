'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Activity, ArrowUpRight, Clock3, Radar, RefreshCw, Search, TrendingUp, Zap } from 'lucide-react';
import { auth } from '@/lib/firebase';
import PanelShell from '@/components/panel-shell';
import type { Opportunity } from '@/lib/viral-intelligence';

type Channel = { id: string; title: string };
type Result = {
  channels: Channel[]; opportunities: Opportunity[]; totalCandidates: number;
  analyzedChannels: number; missingCache: string[]; limitations?: string;
};
type Period = 1 | 7 | 30;
type Order = 'growth' | 'score' | 'acceleration' | 'views';
const formatter = new Intl.NumberFormat('pt-BR');
const fmt = (n: number | null | undefined) => n == null || !Number.isFinite(n) ? '—' : formatter.format(Math.round(n));
const growthFor = (v: Opportunity, p: Period) => p === 1 ? v.growth1 : p === 7 ? v.growth7 : v.growth30;

export default function IntelligencePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [data, setData] = useState<Result | null>(null);
  const [selected, setSelected] = useState('all');
  const [period, setPeriod] = useState<Period>(1);
  const [minAge, setMinAge] = useState('0');
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<Order>('growth');
  const [acceleratingOnly, setAcceleratingOnly] = useState(false);
  const [measuredOnly, setMeasuredOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => onAuthStateChanged(auth, user => {
    setLoggedIn(Boolean(user));
    if (!user) { setData(null); setChannels([]); }
  }), []);

  const load = useCallback(async (channelId: string, signal: AbortSignal) => {
    if (!auth.currentUser) return;
    setLoading(true); setError(''); setData(null);
    try {
      const token = await auth.currentUser.getIdToken();
      if (signal.aborted) return;
      const response = await fetch(`/api/monitor/intelligence?channelId=${encodeURIComponent(channelId)}`, {
        cache: 'no-store', signal, headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Erro HTTP ${response.status}`);
      if (!signal.aborted) {
        setData(body as Result);
        if (Array.isArray(body.channels)) setChannels(body.channels);
      }
    } catch (e) {
      if (!signal.aborted) setError(e instanceof Error ? e.message : 'Erro ao carregar o radar');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const controller = new AbortController();
    void load(selected, controller.signal);
    return () => controller.abort();
  }, [loggedIn, selected, reload, load]);

  const rows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('pt-BR');
    const age = Number(minAge);
    const now = Date.now();
    return (data?.opportunities || []).filter(v => {
      // The server filters by channelId. This additional check prevents mixed results if stale cache is returned.
      if (selected !== 'all' && v.channelId !== selected) return false;
      const growth = growthFor(v, period);
      if (measuredOnly && growth === null) return false;
      if (acceleratingOnly && !(v.acceleration !== null && v.acceleration >= 2 && (v.growth1 || 0) >= 30)) return false;
      if (search && !`${v.title} ${v.channelTitle}`.toLocaleLowerCase('pt-BR').includes(search)) return false;
      if (age > 0) {
        const stamp = Date.parse(v.actualStartTime || v.publishedAt || '');
        if (!Number.isFinite(stamp) || now - stamp < age * 86400000) return false;
      }
      return true;
    }).sort((a, b) => {
      const metric = (v: Opportunity) => order === 'growth' ? growthFor(v, period) : order === 'score' ? v.score : order === 'acceleration' ? v.acceleration : v.views;
      return (metric(b) ?? -Infinity) - (metric(a) ?? -Infinity) || a.title.localeCompare(b.title);
    });
  }, [data, selected, period, minAge, query, order, acceleratingOnly, measuredOnly]);

  useEffect(() => setPage(1), [selected, period, minAge, query, order, acceleratingOnly, measuredOnly]);
  const visible = rows.slice((page - 1) * 24, page * 24);
  const pages = Math.max(1, Math.ceil(rows.length / 24));
  const withGrowth = rows.filter(v => growthFor(v, period) !== null);
  const totalGrowth = withGrowth.reduce((sum, v) => sum + Math.max(0, growthFor(v, period) || 0), 0);
  const accelerating = rows.filter(v => v.acceleration !== null && v.acceleration >= 2 && (v.growth1 || 0) >= 30).length;
  const ageOptions = [{ value: '0', label: 'Qualquer idade' }, { value: '30', label: '30+ dias' }, { value: '180', label: '6+ meses' }, { value: '365', label: '1+ ano' }, { value: '730', label: '2+ anos' }];
  const selectStyle = 'mt-2 w-full rounded-xl border border-cyan-400/20 bg-[#071421] p-3 text-sm text-slate-100 outline-none focus:border-cyan-300';

  return <PanelShell><main className="mx-auto max-w-[1500px] px-4 py-8 text-slate-100 sm:px-8 lg:px-10">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.23em] text-cyan-300">J.A.R.V.I.S. / LIVE SIGNAL RADAR</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Radar de viralização</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Encontre transmissões encerradas que estão ganhando audiência. Abra a live original no YouTube e escolha os trechos manualmente.</p>
      </div>
      <button type="button" onClick={() => setReload(n => n + 1)} disabled={loading || !loggedIn} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Recarregar radar</button>
    </div>

    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[
        { label: 'Lives no resultado', value: fmt(rows.length), Icon: Radar },
        { label: `Novas views / ${period} ${period === 1 ? 'dia' : 'dias'}`, value: fmt(totalGrowth), Icon: TrendingUp },
        { label: 'Sinais de aceleração', value: fmt(accelerating), Icon: Zap },
        { label: 'Canais com cache', value: fmt(data?.analyzedChannels || 0), Icon: Activity },
      ].map(({ label, value, Icon }) => <div key={label} className="rounded-2xl border border-cyan-400/15 bg-[#0d1d2e] p-4 shadow-lg shadow-black/10 sm:p-5">
        <div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold text-slate-400">{label}</span><Icon size={18} className="shrink-0 text-cyan-300"/></div>
        <p className="mt-4 text-2xl font-black tabular-nums text-white sm:text-3xl">{value}</p>
      </div>)}
    </div>

    <section className="mb-5 rounded-2xl border border-cyan-400/20 bg-[#0d1d2e] p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-semibold text-slate-400">Canal
          <select value={selected} onChange={e => setSelected(e.target.value)} className={selectStyle}><option value="all">Todos os canais</option>{channels.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-slate-400">Período de crescimento
          <select value={period} onChange={e => setPeriod(Number(e.target.value) as Period)} className={selectStyle}><option value={1}>Último dia UTC</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option></select>
        </label>
        <label className="text-xs font-semibold text-slate-400">Idade mínima da live
          <select value={minAge} onChange={e => setMinAge(e.target.value)} className={selectStyle}>{ageOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-slate-400">Ordenação
          <select value={order} onChange={e => setOrder(e.target.value as Order)} className={selectStyle}><option value="growth">Mais visualizações novas</option><option value="acceleration">Maior aceleração</option><option value="score">Score de oportunidade</option><option value="views">Total acumulado</option></select>
        </label>
        <label className="text-xs font-semibold text-slate-400">Pesquisar transmissão
          <span className="relative mt-2 block"><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Título ou canal" className="w-full rounded-xl border border-cyan-400/20 bg-[#071421] py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-300"/></span>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 border-t border-cyan-400/10 pt-4">
        <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={measuredOnly} onChange={e => setMeasuredOnly(e.target.checked)} className="accent-cyan-400"/> Somente lives com crescimento medido</label>
        <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={acceleratingOnly} onChange={e => setAcceleratingOnly(e.target.checked)} className="accent-cyan-400"/> Apenas aceleração forte (2× ou mais)</label>
      </div>
    </section>

    {error && <p role="alert" className="mb-5 rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-sm text-rose-200">{error}</p>}
    {data?.missingCache?.length ? <p className="mb-5 rounded-xl border border-amber-400/30 bg-amber-950/20 p-4 text-sm text-amber-200">Ranking ainda não gerado para: {data.missingCache.join(', ')}. Finalize a coleta para preencher o cache.</p> : null}
    {loading ? <div className="rounded-2xl border border-cyan-400/15 bg-[#0d1d2e] p-14 text-center text-slate-400">Consultando rankings em cache...</div> : rows.length === 0 ? <div className="rounded-2xl border border-cyan-400/15 bg-[#0d1d2e] p-12 text-center"><Clock3 size={30} className="mx-auto text-cyan-300"/><h2 className="mt-4 font-bold text-white">Nenhuma live corresponde aos filtros</h2><p className="mt-2 text-sm text-slate-400">Para 1 dia, são necessárias coletas em dias UTC diferentes. Você também pode desmarcar “Somente lives com crescimento medido”.</p></div> : <>
      <div className="grid gap-4 xl:grid-cols-2">{visible.map((v, index) => {
        const growth = growthFor(v, period);
        const isAccelerating = v.acceleration !== null && v.acceleration >= 2 && (v.growth1 || 0) >= 30;
        return <article key={`${v.channelId}:${v.id}`} className="rounded-2xl border border-cyan-400/20 bg-[#0d1d2e] p-4 shadow-lg shadow-black/10 transition-colors hover:border-cyan-300/50">
          <div className="flex gap-4"><div className="relative w-32 shrink-0 sm:w-40"><img src={v.thumbnail || '/favicon.ico'} alt="" loading="lazy" className="aspect-video w-full rounded-xl object-cover"/><span className="absolute left-2 top-2 rounded-md bg-[#06101b]/95 px-2 py-1 text-[11px] font-bold text-cyan-300">#{(page - 1) * 24 + index + 1}</span></div>
          <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold uppercase tracking-wider text-cyan-300">{v.channelTitle}</p><a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-white hover:text-cyan-200">{v.title}</a><div className="mt-2 flex flex-wrap gap-2">{isAccelerating && <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] font-bold text-amber-200">ACELERANDO</span>}<span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-200">LIVE ENCERRADA</span></div></div></div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4"><div><p className="text-[10px] text-slate-400">Novas views ({period}d)</p><p className="mt-1 text-lg font-black text-emerald-300">{growth === null ? '—' : `+${fmt(growth)}`}</p></div><div><p className="text-[10px] text-slate-400">Aceleração</p><p className="mt-1 text-lg font-black text-amber-300">{v.acceleration === null ? '—' : `${v.acceleration.toFixed(1)}×`}</p></div><div><p className="text-[10px] text-slate-400">Views totais</p><p className="mt-1 text-lg font-black text-white">{fmt(v.views)}</p></div></div>
          <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-100">Abrir live no YouTube <ArrowUpRight size={15}/></a>
        </article>;
      })}</div>
      {pages > 1 && <div className="mt-6 flex items-center justify-center gap-4"><button type="button" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-lg border border-cyan-400/30 px-4 py-2 text-sm text-cyan-200 disabled:opacity-30">Anterior</button><span className="text-sm text-slate-400">Página {page} de {pages}</span><button type="button" disabled={page === pages} onClick={() => setPage(p => Math.min(pages, p + 1))} className="rounded-lg border border-cyan-400/30 px-4 py-2 text-sm text-cyan-200 disabled:opacity-30">Próxima</button></div>}
    </>}
    <p className="mt-7 text-xs leading-6 text-slate-400">O radar utiliza o cache de rankings do Firestore; não consulta cada live individualmente. Períodos em dias UTC, sem histórico retroativo. “Aceleração” compara a média diária recente com os seis dias anteriores quando existem dados suficientes. Os resultados ficam limitados às lives presentes nos rankings armazenados (até 100 por canal e período). {data?.limitations || ''}</p>
  </main></PanelShell>;
}
