'use client';

import { useEffect, useState } from 'react';
import { MetricCard, PageHeader } from './components/ui';
import { ProtectedPage } from './components/protected';
import { getAuthHeaders } from './lib/authClient';
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
}

const PAGE_PATH = '/';

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'metrics', visible: true, order: 0, colSpan: 2 },
  { id: 'stock-alerts', visible: true, order: 1, colSpan: 2 },
  { id: 'recent-orders', visible: true, order: 2, colSpan: 2 },
];

export default function Home() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand-blue)]" />
        </div>
      </ProtectedPage>
    );
  }

  const stockStatus = summary.lowStockCount > 0
    ? { label: 'Atenção', color: 'var(--danger)' }
    : summary.watchStockCount > 0
    ? { label: 'Observar', color: 'var(--warning)' }
    : { label: 'Normal', color: 'var(--success)' };

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Dashboard" description="Visao geral do negocio." />
        <LayoutToolbar pagePath={PAGE_PATH} />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((section, index) => (
            <DraggableSection
              key={section.id}
              pagePath={PAGE_PATH}
              section={section}
              index={index}
              totalSections={sections.length}
              className={section.colSpan === 2 ? 'sm:col-span-2 lg:col-span-4' : ''}
            >
              {section.id === 'metrics' && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard title="Produtos" value={String(summary.productsCount)} note={`${summary.variablesCount} variacoes`} />
                  <MetricCard title="Pedidos" value={String(summary.ordersCount)} note="total finalizados" />
                  <MetricCard title="Receita" value={`R$ ${summary.totalSales.toFixed(2)}`} note="vendas acumuladas" />
                  <MetricCard title="Lucro" value={`R$ ${summary.profit.toFixed(2)}`} note="receita menos despesas" />
                </div>
              )}

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
                      style={{ color: 'var(--brand-blue)' }}
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
                      style={{ color: 'var(--brand-blue)' }}
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
