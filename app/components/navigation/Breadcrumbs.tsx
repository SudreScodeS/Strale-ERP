'use client';

// ── Breadcrumbs.tsx — Auto-generated from pathname ─

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const ROUTE_NAMES: Record<string, string> = {
  '/': 'Dashboard',
  '/sales': 'Vendas',
  '/quotes': 'Orçamentos',
  '/purchases': 'Compras',
  '/inventory': 'Estoque',
  '/finance': 'Financeiro',
  '/assistant': 'Assistente',
  '/users': 'Usuários',
  '/admin': 'Administração',
  '/reports': 'Relatórios',
  '/demand-forecast': 'Previsão de Demanda',
  '/notifications': 'Notificações',
  '/settings': 'Configurações',
  '/login': 'Login',
  '/register': 'Cadastro',
};

function HomeIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

export function Breadcrumbs() {
  const pathname = usePathname();

  // Don't show on root
  if (pathname === '/') return null;

  // Build breadcrumb segments
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Array<{ label: string; href: string; isCurrent: boolean }> = [];

  // Always include home
  crumbs.push({ label: 'Dashboard', href: '/', isCurrent: false });

  // Build cumulative paths
  let cumulativePath = '';
  for (let i = 0; i < segments.length; i++) {
    cumulativePath += '/' + segments[i];
    const label = ROUTE_NAMES[cumulativePath] || segments[i].charAt(0).toUpperCase() + segments[i].slice(1).replace(/-/g, ' ');
    crumbs.push({
      label,
      href: cumulativePath,
      isCurrent: i === segments.length - 1,
    });
  }

  // Don't show if only one crumb (home)
  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex items-center gap-1 text-xs"
      style={{ color: 'var(--text-muted)' }}
    >
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <ChevronIcon />}
          {crumb.isCurrent ? (
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {i === 0 ? <HomeIcon /> : crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="flex items-center gap-1 transition-colors hover:underline"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {i === 0 ? <HomeIcon /> : crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
