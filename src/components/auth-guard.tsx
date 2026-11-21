'use client';
import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => onAuthStateChanged(auth, current => {
    setUser(current);
    setReady(true);
    if (!current) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }), [router, pathname]);
  if (!ready || !user) return <main className="p-8 text-slate-200">Verificando autenticação...</main>;
  return <>{children}</>;
}
