"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { globalConfig } from '../../config/global';
import { getCurrentUser, getStoredToken, logout } from '../lib/authClient';

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const [role] = useState<'admin' | 'seller' | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = getStoredToken();
    const user = token ? getCurrentUser() : null;
    return user?.role || null;
  });
  const [username] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = getStoredToken();
    const user = token ? getCurrentUser() : null;
    return user?.username || null;
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return (window.localStorage.getItem('erp-theme') as 'light' | 'dark' | null) || 'light';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('erp-sidebar-open');
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('erp-sidebar-open', String(isSidebarOpen));
  }, [isSidebarOpen]);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    window.localStorage.setItem('erp-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  const navItems = [
    { href: '/', label: 'Dashboard', roles: ['admin'] },
    { href: '/inventory', label: 'Estoque', roles: ['admin'] },
    { href: '/demand-forecast', label: 'Previsão', roles: ['admin'] },
    { href: '/users', label: 'Usuários', roles: ['admin'] },
    { href: '/sales', label: 'Pedidos', roles: ['admin', 'seller'] },
    { href: '/finance', label: 'Financeiro', roles: ['admin'] },
    { href: '/purchases', label: 'Compras', roles: ['admin'] },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {!isSidebarOpen ? (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-4 top-4 z-40 hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-slate-100 lg:block"
        >
          Abrir menu
        </button>
      ) : null}
      <aside
        className={`fixed left-0 top-0 hidden h-screen flex-col border-r border-slate-200 bg-white px-4 py-6 transition-all duration-300 lg:flex ${
          isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full overflow-hidden border-r-0 px-0 py-0'
        }`}
      >
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image src={theme === 'light' ? '/LogoC.svg' : '/LogoE.svg'} alt="Logo" width={40} height={40} className="h-10 w-10" priority />
            <div>
              <h1 className="text-lg font-semibold">{globalConfig.systemName}</h1>
              <p className="text-sm text-slate-500">Painel ERP modular</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-2xl border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
        <nav className="space-y-2 text-sm font-medium text-slate-700">
          {navItems
            .filter((item) => role && item.roles.includes(role))
            .map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-2xl px-4 py-3 transition hover:bg-blue-50">
                {item.label}
              </Link>
            ))}
          {!role ? (
            <Link href="/login" className="block rounded-2xl px-4 py-3 transition hover:bg-blue-50">
              Login
            </Link>
          ) : null}
        </nav>
        <div className="mt-auto space-y-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
          >
            {theme === 'light' ? 'Modo noturno' : 'Modo claro'}
          </button>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <p className="font-semibold text-slate-900">{username || 'Convidado'}</p>
            <p className="mt-1 text-xs text-slate-500">Perfil: {role || 'visitante'}</p>
            {role ? (
              <button onClick={logout} className="mt-3 rounded-2xl brand-primary px-4 py-2 text-white transition">
                Sair
              </button>
            ) : null}
          </div>
        </div>
      </aside>
      <main className={`flex-1 p-6 transition-all duration-300 lg:px-10 lg:py-8 ${isSidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}`}>{children}</main>
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-blue-700">ERP Modular</p>
          <h2 className="text-3xl font-semibold text-slate-900">{title}</h2>
        </div>
        <div className="rounded-2xl brand-soft px-4 py-3">{globalConfig.companyName}</div>
      </div>
      {description ? <p className="max-w-3xl text-slate-600">{description}</p> : null}
    </div>
  );
}

export function MetricCard({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-4 text-3xl font-semibold text-slate-900">{value}</p>
      {note ? <p className="mt-2 text-sm text-slate-500">{note}</p> : null}
    </div>
  );
}
