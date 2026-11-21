'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { LayoutDashboard, RadioTower, Tv2, LogOut, Menu, X, ChevronRight, Activity, ClipboardList, Radar } from 'lucide-react';
import { auth } from '@/lib/firebase';
import AuthGuard from './auth-guard';
import jarvis from './jarvis-theme.module.css';

const navigation = [
  { href: '/dashboard', label: 'Visão geral', Icon: LayoutDashboard },
  { href: '/videos', label: 'Monitor de lives', Icon: RadioTower },
  { href: '/canais', label: 'Meus canais', Icon: Tv2 },
  { href: '/operacoes', label: 'Operações', Icon: ClipboardList },
  { href: '/inteligencia', label: 'Inteligência IA', Icon: Radar },
];

export default function PanelShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  async function logout() {
    setExiting(true);
    try { await signOut(auth); router.replace('/login'); router.refresh(); }
    catch { alert('Não foi possível encerrar a sessão.'); setExiting(false); }
  }
  return <AuthGuard>
    <div className={`${jarvis.root} min-h-screen bg-[#f6f8fc] text-slate-900 lg:flex`}>
      {mobileOpen && <button type="button" aria-label="Fechar navegação" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden" />}
      <aside className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col bg-[#07121f] text-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}>
        <div className="flex h-24 items-center justify-between border-b border-white/10 px-6">
          <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-500/10 border border-cyan-400/60 text-cyan-300 shadow-lg shadow-cyan-600/20"><Activity size={24} strokeWidth={2.5}/></span>
            <span><span className="block text-[17px] font-extrabold tracking-tight">Viral<span className="text-cyan-300">Monitor</span></span><span className="block text-[10px] font-bold uppercase tracking-[.20em] text-slate-400">L.I.V.E. // INTELLIGENCE</span></span>
          </Link>
          <button className="rounded-xl p-2 text-slate-300 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={20}/></button>
        </div>
        <div className="px-4 pt-9"><p className="mb-3 px-4 text-[10px] font-bold uppercase tracking-[.19em] text-slate-500">CENTRAL DE COMANDO</p>
          <nav className="space-y-1" aria-label="Navegação principal">{navigation.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={active?'page':undefined} className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors ${active?'border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 shadow-md shadow-cyan-900/20':'text-slate-400 hover:bg-white/10 hover:text-white'}`}><Icon size={19}/><span className="flex-1">{label}</span>{active && <ChevronRight size={15} className="text-indigo-100"/>}</Link>;
          })}</nav>
        </div>
        <div className="mt-auto px-4 pb-5"><div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Ambiente de monitoramento</div><p className="mt-2 text-xs leading-5 text-slate-400">Dados públicos do YouTube. Histórico registrado a partir das coletas.</p></div>
          <button type="button" disabled={exiting} onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50"><LogOut size={18}/> {exiting?'Saindo...':'Encerrar sessão'}</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-cyan-500/15 bg-[#0a1524]/95 px-5 backdrop-blur-md sm:px-8 lg:px-10"><div className="flex items-center gap-3"><button type="button" aria-label="Abrir menu" onClick={() => setMobileOpen(true)} className="rounded-xl border border-slate-200 p-2 lg:hidden"><Menu size={21}/></button><span className="text-xs font-medium text-slate-400">CENTRAL DE COMANDO</span><ChevronRight size={14} className="text-slate-300"/><span className="text-sm font-bold text-cyan-100">{navigation.find(n => n.href===pathname)?.label || 'Viral Monitor'}</span></div><span className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex"><span className="h-2 w-2 rounded-full bg-emerald-500"/>SISTEMA ONLINE</span></header>
        {children}
      </div>
    </div>
  </AuthGuard>;
}
