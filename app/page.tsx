'use client';

import { useEffect, useState } from 'react';
import { MetricCard, PageHeader } from './components/ui';
import { ProtectedPage } from './components/protected';
import { getAuthHeaders, getCurrentUser } from './lib/authClient';
import { useLayout, type SectionConfig } from './components/layout-context';
import { DraggableSection, LayoutToolbar } from './components/draggable-section';

interface DashboardOrder {
  id: string;
  name: string;
  totalPrice: number;
  status: string;
  createdByName: string;
  createdAt: string;
}

interface DashboardSummary {
  productsCount: number;
  variablesCount: number;
  ordersCount: number;
  totalSales: number;
  profit: number;
  lowStockCount: number;
  watchStockCount: number;
  recentOrders: DashboardOrder[];
  quotesPending?: number;
  quotesConverted?: number;
  quoteConversionRate?: number;
}

// ==========================================
// AVAILABLE METRIC CARDS
// ==========================================

interface MetricOption {
  id: string;
  title: string;
  icon: string;
  getValue: (s: DashboardSummary) => string;
  getNote: (s: DashboardSummary) => string;
}

const AVAILABLE_METRICS: MetricOption[] = [
  {
    id: 'products',
    title: 'Produtos',
    icon: '📦',
    getValue: (s) => String(s.productsCount),
    getNote: (s) => `${s.variablesCount} variacoes`,
  },
  {
    id: 'orders',
    title: 'Pedidos',
    icon: '🛒',
    getValue: (s) => String(s.ordersCount),
    getNote: () => 'total finalizados',
  },
  {
    id: 'revenue',
    title: 'Receita',
    icon: '💰',
    getValue: (s) => `R$ ${s.totalSales.toFixed(2)}`,
    getNote: () => 'vendas acumuladas',
  },
  {
    id: 'profit',
    title: 'Lucro',
    icon: '📈',
    getValue: (s) => `R$ ${s.profit.toFixed(2)}`,
    getNote: () => 'receita menos despesas',
  },
  {
    id: 'lowStock',
    title: 'Estoque Baixo',
    icon: '⚠️',
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
    icon: '🧾',
    getValue: (s) => s.ordersCount > 0 ? `R$ ${(s.totalSales / s.ordersCount).toFixed(2)}` : 'R$ 0,00',
    getNote: () => 'por pedido',
  },
  {
    id: 'margin',
    title: 'Margem',
    icon: '📊',
    getValue: (s) => s.totalSales > 0 ? `${((s.profit / s.totalSales) * 100).toFixed(1)}%` : '0%',
    getNote: () => 'lucro / receita',
  },
  {
    id: 'items',
    title: 'Itens',
    icon: '🏷️',
    getValue: (s) => String(s.variablesCount),
    getNote: (s) => `${s.productsCount} produtos base`,
  },
  {
    id: 'stockHealth',
    title: 'Saúde Estoque',
    icon: '✅',
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
    icon: '📅',
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
    icon: '📋',
    getValue: (s) => String((s as DashboardSummary & { quotesPending?: number }).quotesPending ?? 0),
    getNote: () => 'rascunho + enviados',
  },
  {
    id: 'quotesConverted',
    title: 'Orçamentos Convertidos',
    icon: '🔄',
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
              <span className="text-sm">{metric.icon}</span>
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
    fetch('/api/dashboard', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setSummary(data.summary))
      .catch(() => {});
  }, []);

  if (!summary) {
    return (
      <ProtectedPage allowedRoles={['admin']}>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
        </div>
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
      <div>
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
              {section.id === 'metrics' && (() => {
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
                          {rowMetrics.map((metric) => (
                            <div
                              key={metric.id}
                              style={{ width: `calc((100% - ${totalGap}px) / ${cols})`, maxWidth: `calc((100% - ${totalGap}px) / ${cols})` }}
                            >
                              <MetricCard
                                title={metric.title}
                                value={metric.getValue(summary)}
                                note={metric.getNote(summary)}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {section.id === 'stock-alerts' && (summary.lowStockCount > 0 || summary.watchStockCount > 0) && (
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
              )}

              {section.id === 'recent-orders' && (
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
              )}
            </DraggableSection>
          ))}
        </div>
      </div>
    </ProtectedPage>
  );
}
