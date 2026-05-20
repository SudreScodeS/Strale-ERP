'use client';

import { useEffect, useState } from 'react';
import { MetricCard, PageHeader } from './components/ui';
import { SkeletonPage } from './components/skeleton';
import { ErrorBoundary } from './components/error-boundary';
import { ProtectedPage } from './components/protected';
import { getAuthHeaders, getCurrentUser } from './lib/authClient';
import { useLayout, type SectionConfig } from './components/layout-context';
import { DraggableSection, LayoutToolbar } from './components/draggable-section';
import type { DashboardOrder, DashboardSummary } from '../types';

// ==========================================
// AVAILABLE METRIC CARDS
// ==========================================

interface MetricOption {
  id: string;
  title: string;
  icon: React.ReactNode;
  href?: string;
  getValue: (s: DashboardSummary) => string;
  getNote: (s: DashboardSummary) => string;
}

// ==========================================
// METRIC ICONS (SVG, inline)
// ==========================================

const MetricIcons = {
  products: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  orders: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  revenue: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  profit: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  lowStock: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  avgTicket: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  ),
  margin: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
  ),
  items: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
    </svg>
  ),
  stockHealth: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  ordersToday: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  quotesPending: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  quotesConverted: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const AVAILABLE_METRICS: MetricOption[] = [
  {
    id: 'products',
    title: 'Produtos',
    icon: MetricIcons.products,
    href: '/inventory',
    getValue: (s) => String(s.productsCount),
    getNote: (s) => `${s.variablesCount} variacoes`,
  },
  {
    id: 'orders',
    title: 'Pedidos',
    icon: MetricIcons.orders,
    href: '/sales',
    getValue: (s) => String(s.ordersCount),
    getNote: () => 'total finalizados',
  },
  {
    id: 'revenue',
    title: 'Receita',
    icon: MetricIcons.revenue,
    href: '/finance',
    getValue: (s) => `R$ ${s.totalSales.toFixed(2)}`,
    getNote: () => 'vendas acumuladas',
  },
  {
    id: 'profit',
    title: 'Lucro',
    icon: MetricIcons.profit,
    href: '/finance',
    getValue: (s) => `R$ ${s.profit.toFixed(2)}`,
    getNote: () => 'receita menos despesas',
  },
  {
    id: 'lowStock',
    title: 'Estoque Baixo',
    icon: MetricIcons.lowStock,
    href: '/inventory',
    getValue: (s) => String(s.lowStockCount + s.watchStockCount),
    getNote: (s) => {
      const parts: string[] = [];
      if (s.lowStockCount > 0) parts.push(`${s.lowStockCount} criticos`);
      if (s.watchStockCount > 0) parts.push(`${s.watchStockCount} atencao`);
      return parts.join(' · ') || 'tudo ok';
    },
  },
  {
    id: 'avgTicket',
    title: 'Ticket Médio',
    icon: MetricIcons.avgTicket,
    href: '/sales',
    getValue: (s) => s.ordersCount > 0 ? `R$ ${(s.totalSales / s.ordersCount).toFixed(2)}` : 'R$ 0,00',
    getNote: () => 'por pedido',
  },
  {
    id: 'margin',
    title: 'Margem',
    icon: MetricIcons.margin,
    href: '/reports',
    getValue: (s) => s.totalSales > 0 ? `${((s.profit / s.totalSales) * 100).toFixed(1)}%` : '0%',
    getNote: () => 'lucro / receita',
  },
  {
    id: 'items',
    title: 'Itens',
    icon: MetricIcons.items,
    href: '/inventory',
    getValue: (s) => String(s.variablesCount),
    getNote: (s) => `${s.productsCount} produtos base`,
  },
  {
    id: 'stockHealth',
    title: 'Saúde Estoque',
    icon: MetricIcons.stockHealth,
    href: '/inventory',
    getValue: (s) => {
      const total = s.lowStockCount + s.watchStockCount;
      if (total === 0) return '100%';
      const healthy = Math.max(0, 100 - total * 5);
      return `${healthy}%`;
    },
    getNote: (s) => {
      const total = s.lowStockCount + s.watchStockCount;
      return total === 0 ? 'sem alertas' : `${total} itens em alerta`;
    },
  },
  {
    id: 'ordersToday',
    title: 'Pedidos Hoje',
    icon: MetricIcons.ordersToday,
    href: '/sales',
    getValue: (s) => {
      const today = new Date().toDateString();
      const count = s.recentOrders.filter((o) => new Date(o.createdAt).toDateString() === today).length;
      return String(count);
    },
    getNote: () => 'registrados hoje',
  },
  {
    id: 'quotesPending',
    title: 'Orçamentos Pendentes',
    icon: MetricIcons.quotesPending,
    href: '/quotes',
    getValue: (s) => String((s as DashboardSummary & { quotesPending?: number }).quotesPending ?? 0),
    getNote: () => 'rascunho + enviados',
  },
  {
    id: 'quotesConverted',
    title: 'Orçamentos Convertidos',
    icon: MetricIcons.quotesConverted,
    href: '/quotes',
    getValue: (s) => String((s as DashboardSummary & { quotesConverted?: number }).quotesConverted ?? 0),
    getNote: (s) => {
      const rate = (s as DashboardSummary & { quoteConversionRate?: number }).quoteConversionRate;
      return rate !== undefined ? `${rate.toFixed(1)}% conversão` : 'viraram pedido';
    },
  },
];

const DEFAULT_METRIC_IDS = ['products', 'orders', 'revenue', 'profit'];

function getMetricsStorageKey(): string {
  if (typeof window === 'undefined') return 'elitium-dashboard-metrics-default';
  const user = getCurrentUser();
  return `elitium-dashboard-metrics-${user?.id || 'default'}`;
}

function loadSelectedMetrics(): string[] {
  if (typeof window === 'undefined') return DEFAULT_METRIC_IDS;
  try {
    const raw = localStorage.getItem(getMetricsStorageKey());
    return raw ? JSON.parse(raw) : DEFAULT_METRIC_IDS;
  } catch {
    return DEFAULT_METRIC_IDS;
  }
}

function saveSelectedMetrics(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getMetricsStorageKey(), JSON.stringify(ids));
  } catch {
    // storage full
  }
}

// ==========================================
// METRIC PICKER (edit mode)
// ==========================================

function MetricPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) return; // at least 1
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      if (selectedIds.length >= 10) return; // max 10
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div
      className="mb-5 rounded-2xl p-4"
      style={{ background: 'var(--surface-soft)', border: '1px dashed var(--border)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Métricas visíveis (clique para adicionar/remover)
        </p>
        <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
          {selectedIds.length}/10 selecionadas
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_METRICS.map((metric) => {
          const isSelected = selectedIds.includes(metric.id);
          return (
            <button
              key={metric.id}
              type="button"
              onClick={() => toggle(metric.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                isSelected
                  ? 'ring-2 ring-blue-400 shadow-sm'
                  : 'opacity-50 hover:opacity-80'
              }`}
              style={{
                background: isSelected ? 'var(--card-bg)' : 'var(--surface-muted)',
                border: `1px solid ${isSelected ? 'var(--brand)' : 'var(--border)'}`,
                color: 'var(--text-primary)',
              }}
            >
              <span className="flex-shrink-0 text-sm">{metric.icon}</span>
              {metric.title}
              {isSelected && (
                <svg className="h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// PAGE
// ==========================================

const PAGE_PATH = '/';

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'metrics', visible: true, order: 0, colSpan: 2 },
  { id: 'stock-alerts', visible: true, order: 1, colSpan: 2 },
  { id: 'recent-orders', visible: true, order: 2, colSpan: 2 },
];

export default function Home() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>(DEFAULT_METRIC_IDS);
  const { getPageLayout, isEditing } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  // Load selected metrics from localStorage
  useEffect(() => {
    setSelectedMetricIds(loadSelectedMetrics());
  }, []);

  // Save when changed
  useEffect(() => {
    saveSelectedMetrics(selectedMetricIds);
  }, [selectedMetricIds]);

  useEffect(() => {
    fetch('/api/v1/dashboard', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setSummary(data.summary))
      .catch(() => {});
  }, []);

  if (!summary) {
    return (
      <ProtectedPage allowedRoles={['admin']}>
        <SkeletonPage />
      </ProtectedPage>
    );
  }

  const stockStatus = summary.lowStockCount > 0
    ? { label: 'Atenção', color: 'var(--danger)' }
    : summary.watchStockCount > 0
    ? { label: 'Observar', color: 'var(--warning)' }
    : { label: 'Normal', color: 'var(--success)' };

  const activeMetrics = AVAILABLE_METRICS.filter((m) => selectedMetricIds.includes(m.id));

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div className="animate-fade-in">
        <PageHeader title="Dashboard" description="Visao geral do negocio." />
        <LayoutToolbar pagePath={PAGE_PATH} />

        {isEditing && (
          <MetricPicker selectedIds={selectedMetricIds} onChange={setSelectedMetricIds} />
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((section, index) => (
            <DraggableSection
              key={`${section.id}-${section.order}`}
              pagePath={PAGE_PATH}
              section={section}
              index={index}
              totalSections={sections.length}
              className={section.colSpan === 2 ? 'sm:col-span-2 lg:col-span-4' : ''}
            >
              {section.id === 'metrics' && (
                <ErrorBoundary name="Métricas">
                {(() => {
                const count = activeMetrics.length;
                // Row layout by count:
                // 1→[1], 2→[2], 3→[3], 4→[4],
                // 5→[3,2], 6→[3,3], 7→[4,3], 8→[4,4], 9→[3,3,3], 10→[4,3,3]
                const rowLayouts: Record<number, number[]> = {
                  1: [1], 2: [2], 3: [3], 4: [4],
                  5: [3, 2], 6: [3, 3], 7: [4, 3],
                  8: [4, 4], 9: [3, 3, 3], 10: [4, 3, 3],
                };
                const rows = rowLayouts[count] || [Math.min(count, 4)];
                const gapPx = 20;
                let idx = 0;
                let globalIdx = 0;
                return (
                  <div className="flex flex-col items-center" style={{ gap: `${gapPx}px` }}>
                    {rows.map((cols, rowIdx) => {
                      const rowMetrics = activeMetrics.slice(idx, idx + cols);
                      idx += cols;
                      const totalGap = (cols - 1) * gapPx;
                      return (
                        <div
                          key={rowIdx}
                          className="flex justify-center"
                          style={{ gap: `${gapPx}px`, width: '100%' }}
                        >
                          {rowMetrics.map((metric) => {
                            const stagger = globalIdx++;
                            return (
                              <div
                                key={metric.id}
                                className={`animate-fade-in-up stagger-${Math.min(stagger + 1, 8)}`}
                                style={{ width: `calc((100% - ${totalGap}px) / ${cols})`, maxWidth: `calc((100% - ${totalGap}px) / ${cols})` }}
                              >
                                <MetricCard
                                  title={metric.title}
                                  value={metric.getValue(summary)}
                                  note={metric.getNote(summary)}
                                  icon={metric.icon}
                                  href={metric.href}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
                </ErrorBoundary>
              )}

              {section.id === 'stock-alerts' && (summary.lowStockCount > 0 || summary.watchStockCount > 0) && (
                <ErrorBoundary name="Alertas de Estoque">
                <div>
                  <div
                    className="flex items-center gap-4 rounded-2xl p-5"
                    style={{
                      background: summary.lowStockCount > 0 ? 'var(--danger-bg)' : 'var(--warning-bg)',
                      border: `1px solid ${summary.lowStockCount > 0 ? 'var(--danger-border)' : 'var(--warning-border)'}`,
                    }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: stockStatus.color }}
                    >
                      {summary.lowStockCount + summary.watchStockCount}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Itens com estoque baixo
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {summary.lowStockCount > 0 && `${summary.lowStockCount} criticos`}
                        {summary.lowStockCount > 0 && summary.watchStockCount > 0 && ' · '}
                        {summary.watchStockCount > 0 && `${summary.watchStockCount} em atencao`}
                      </p>
                    </div>
                    <a
                      href="/inventory"
                      className="ml-auto text-xs font-semibold transition-opacity hover:opacity-70"
                      style={{ color: 'var(--brand)' }}
                    >
                      Ver estoque
                    </a>
                  </div>
                </div>
                </ErrorBoundary>
              )}

              {section.id === 'recent-orders' && (
                <ErrorBoundary name="Últimos Pedidos">
                <section
                  className="rounded-2xl p-6"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Ultimos pedidos
                    </h3>
                    <a
                      href="/sales"
                      className="text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--brand)' }}
                    >
                      Ver todos
                    </a>
                  </div>

                  <div className="mt-4 divide-y" style={{ borderColor: 'var(--border)' }}>
                    {summary.recentOrders.length === 0 ? (
                      <p className="py-8 text-center text-sm" style={{ color: 'var(--text-faint)' }}>
                        Nenhum pedido registrado.
                      </p>
                    ) : (
                      summary.recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {order.name || `Pedido ${order.id}`}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                              {order.createdByName} · {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                              R$ {order.totalPrice.toFixed(2)}
                            </span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                              style={{
                                background: order.status === 'completed' ? 'var(--success-bg)' : order.status === 'cancelled' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                                color: order.status === 'completed' ? 'var(--success)' : order.status === 'cancelled' ? 'var(--danger)' : 'var(--warning)',
                              }}
                            >
                              {order.status === 'completed' ? 'ok' : order.status === 'cancelled' ? 'canc.' : 'pend.'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
                </ErrorBoundary>
              )}
            </DraggableSection>
          ))}
        </div>
      </div>
    </ProtectedPage>
  );
}
