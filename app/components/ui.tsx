"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { globalConfig, applyServerConfig } from '../../config/global';
import { getCurrentUser, getStoredToken, getAuthHeaders, logout } from '../lib/authClient';

// ==========================================
// SVG ICONS (inline, no dependencies)
// ==========================================

const icons = {
  dashboard: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  inventory: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  forecast: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  assistant: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.2 48.2 0 005.348-.374c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  sales: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  quotes: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  finance: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  purchases: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  reports: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  admin: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  sun: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  moon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  ),
  menu: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
  close: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  logout: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  ),
};

// ==========================================
// NAVIGATION ITEMS CONFIG
// ==========================================

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: ('admin' | 'seller')[];
  section?: string;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: icons.dashboard, roles: ['admin'], section: 'Geral' },
  { href: '/sales', label: 'Pedidos', icon: icons.sales, roles: ['admin', 'seller'], section: 'Operacoes' },
  { href: '/quotes', label: 'Orçamentos', icon: icons.quotes, roles: ['admin', 'seller'], section: 'Operacoes' },
  { href: '/inventory', label: 'Estoque', icon: icons.inventory, roles: ['admin'], section: 'Operacoes' },
  { href: '/purchases', label: 'Compras', icon: icons.purchases, roles: ['admin'], section: 'Operacoes' },
  { href: '/finance', label: 'Financeiro', icon: icons.finance, roles: ['admin'], section: 'Financeiro' },
  { href: '/reports', label: 'Relatórios', icon: icons.reports, roles: ['admin'], section: 'Financeiro' },
  { href: '/demand-forecast', label: 'Previsao', icon: icons.forecast, roles: ['admin'], section: 'Financeiro' },
  { href: '/assistant', label: 'Assistente', icon: icons.assistant, roles: ['admin', 'seller'], section: 'Ferramentas' },
  { href: '/users', label: 'Usuarios', icon: icons.users, roles: ['admin'], section: 'Configuracoes' },
  { href: '/admin', label: 'Configuracoes', icon: icons.admin, roles: ['admin'], section: 'Configuracoes' },
];

// ==========================================
// SIDEBAR COMPONENT
// ==========================================

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const pathname = usePathname();
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('erp-sidebar-open', String(isSidebarOpen));
  }, [isSidebarOpen]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Load server config on mount (syncs printTypes, pricing rules, etc.)
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    fetch('/api/config', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.config) applyServerConfig(data.config);
      })
      .catch(() => {});
  }, []);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    window.localStorage.setItem('erp-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  // Group nav items by section
  const filteredItems = navItems.filter((item) => role && item.roles.includes(role));
  const sections = filteredItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section || 'Outros';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      {/* Logo & header */}
      <div className="mb-6 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <Image
            src={theme === 'light' ? '/LogoC.svg' : '/Logo.svg'}
            alt="Logo"
            width={36}
            height={36}
            className="h-9 w-9"
            priority
          />
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--sidebar-text-strong)' }}>
              {globalConfig.systemName}
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {globalConfig.companyName}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="rounded-lg p-1.5 transition-colors hover:bg-[var(--sidebar-hover)] lg:block hidden"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Fechar sidebar"
        >
          {icons.close}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-1">
        {Object.entries(sections).map(([sectionName, items]) => (
          <div key={sectionName}>
            <p
              className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: 'var(--text-faint)' }}
            >
              {sectionName}
            </p>
            <div className="space-y-0.5">
              {items.map((item, itemIdx) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 animate-slide-in"
                    style={{
                      color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                      background: active ? 'var(--sidebar-active)' : 'transparent',
                      boxShadow: active ? '0 2px 10px rgba(139, 92, 246, 0.35), 0 1px 0 rgba(167,139,250,0.12) inset' : 'none',
                      animationDelay: `${itemIdx * 0.04}s`,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'var(--sidebar-hover)';
                        e.currentTarget.style.color = 'var(--sidebar-text-strong)';
                        e.currentTarget.style.boxShadow = '0 1px 0 rgba(167,139,250,0.06) inset';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--sidebar-text)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {!role ? (
          <Link
            href="/login"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
            style={{ color: 'var(--sidebar-text)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--sidebar-hover)';
              e.currentTarget.style.color = 'var(--sidebar-text-strong)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--sidebar-text)';
            }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span>Login</span>
          </Link>
        ) : null}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto space-y-3 border-t px-1 pt-4" style={{ borderColor: 'var(--sidebar-border)' }}>
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          style={{ color: 'var(--sidebar-text)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--sidebar-hover)';
            e.currentTarget.style.color = 'var(--sidebar-text-strong)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--sidebar-text)';
          }}
        >
          {theme === 'light' ? icons.moon : icons.sun}
          <span>{theme === 'light' ? 'Modo escuro' : 'Modo claro'}</span>
        </button>

        {/* User card */}
        <div
          className="rounded-xl p-3"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', boxShadow: '0 1px 0 rgba(167,139,250,0.06) inset, 0 -1px 0 rgba(0,0,0,0.15) inset' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: 'var(--brand)', color: '#fff' }}
            >
              {(username || 'C')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {username || 'Convidado'}
              </p>
              <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                {role || 'visitante'}
              </p>
            </div>
            {role ? (
              <button
                onClick={logout}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--danger-bg)]"
                style={{ color: 'var(--text-muted)' }}
                title="Sair"
                aria-label="Fazer logout"
              >
                {icons.logout}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl shadow-md lg:hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        aria-label="Abrir menu"
      >
        {icons.menu}
      </button>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'var(--modal-overlay)' }}
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Mobile sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col p-5 transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar (expanded or icon-only) */}
      <aside
        className={`fixed left-0 top-0 hidden h-screen flex-col transition-all duration-300 lg:flex ${
          isSidebarOpen ? 'w-72 p-5' : 'w-[68px] items-center py-4 px-2'
        }`}
        style={{
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {isSidebarOpen ? (
          sidebarContent
        ) : (
          /* Collapsed: icon-only sidebar */
          <>
            {/* Logo + expand button */}
            <div className="mb-5 flex flex-col items-center gap-2">
              <Image
                src={theme === 'light' ? '/LogoC.svg' : '/Logo.svg'}
                alt="Logo"
                width={28}
                height={28}
                className="h-7 w-7"
                priority
              />
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--sidebar-hover)]"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Abrir sidebar"
                title="Abrir menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
            </div>

            {/* Navigation icons */}
            <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto">
              {filteredItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150"
                    style={{
                      color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                      background: active ? 'var(--sidebar-active)' : 'transparent',
                      boxShadow: active ? '0 2px 10px rgba(139, 92, 246, 0.35), 0 1px 0 rgba(167,139,250,0.12) inset' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'var(--sidebar-hover)';
                        e.currentTarget.style.color = 'var(--sidebar-text-strong)';
                        e.currentTarget.style.boxShadow = '0 1px 0 rgba(167,139,250,0.06) inset';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--sidebar-text)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {item.icon}
                  </Link>
                );
              })}

              {!role ? (
                <Link
                  href="/login"
                  title="Login"
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-hover)';
                    e.currentTarget.style.color = 'var(--sidebar-text-strong)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--sidebar-text)';
                  }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </Link>
              ) : null}
            </nav>

            {/* Bottom: theme toggle + user avatar */}
            <div className="mt-auto flex flex-col items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--sidebar-border)' }}>
              <button
                type="button"
                onClick={toggleTheme}
                title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
                style={{ color: 'var(--sidebar-text)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--sidebar-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {theme === 'light' ? icons.moon : icons.sun}
              </button>
              {role ? (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--brand)', color: '#fff' }}
                  title={username || 'Usuário'}
                >
                  {(username || 'C')[0].toUpperCase()}
                </div>
              ) : null}
            </div>
          </>
        )}
      </aside>

      {/* Main content */}
      <main
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? 'lg:ml-72' : 'lg:ml-[68px]'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

// ==========================================
// PAGE HEADER
// ==========================================

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-2 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
            {globalConfig.systemName}
          </p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
        </div>
        <div
          className="self-start rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--brand-muted)', color: 'var(--brand)', border: '1px solid var(--brand-border)', boxShadow: '0 1px 0 rgba(167,139,250,0.06) inset' }}
        >
          {globalConfig.companyName}
        </div>
      </div>
      {description ? (
        <p className="max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

// ==========================================
// METRIC CARD
// ==========================================

export function MetricCard({ title, value, note, icon, href }: { title: string; value: string; note?: string; icon?: React.ReactNode; href?: string }) {
  const iconElement = icon ? (
    <div
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-110 group-hover:rotate-3"
      style={{ background: 'var(--brand-muted)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}
    >
      {icon}
    </div>
  ) : null;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-md animate-fade-in-up"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
    >
      {/* Decorative gradient blob */}
      <div
        className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-[0.07] transition-all duration-300 group-hover:opacity-[0.12] group-hover:scale-110"
        style={{ background: 'var(--brand)' }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>
            {title}
          </p>
          <p className="mt-3 text-2xl font-bold tabular-nums sm:text-3xl transition-transform duration-200 group-hover:scale-[1.02] origin-left" style={{ color: 'var(--text-primary)' }}>
            {value}
          </p>
          {note ? (
            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {note}
            </p>
          ) : null}
        </div>
        {iconElement && href ? (
          <Link
            href={href}
            title={`Ir para ${title}`}
            className="cursor-pointer rounded-xl transition-all duration-200 hover:ring-2 hover:ring-[var(--brand)] hover:ring-offset-1"
            onClick={(e) => e.stopPropagation()}
          >
            {iconElement}
          </Link>
        ) : iconElement}
      </div>
    </div>
  );
}
