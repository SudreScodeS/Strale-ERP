'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, MetricCard } from '../components/ui';
import { SkeletonMetrics, SkeletonTable } from '../components/skeleton';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { apiFetch } from '../lib/apiFetch';
import { toast } from '../components/ui/Toast';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';

/** Local view type — API returns dates as strings */
interface FinancialRecordView {
  id: string;
  type: 'sale' | 'purchase' | 'expense';
  amount: number;
  description: string;
  date: string;
}

interface ProductRevenue {
  productId: string;
  productName: string;
  totalSales: number;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageMargin: number;
  productMargin: number;
}

export default function FinancePage() {
  const [records, setRecords] = useState<FinancialRecordView[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [profit, setProfit] = useState(0);
  const [error, setError] = useState('');
  const [faturamento, setFaturamento] = useState<ProductRevenue[]>([]);
  const [sortCol, setSortCol] = useState<string>('totalRevenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'financeiro' | 'faturamento'>('financeiro');
  const [loading, setLoading] = useState(true);

  const PAGE_PATH = '/finance';
  const DEFAULT_SECTIONS: SectionConfig[] = [
    { id: 'finance-metrics', visible: true, order: 0, colSpan: 2 },
    { id: 'finance-table', visible: true, order: 1, colSpan: 2 },
  ];
  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  async function loadFinance() {
    const response = await apiFetch('/api/v1/finance', { cache: 'no-store', headers: getAuthHeaders() });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Falha ao carregar financeiro.');
      return;
    }
    setRecords(data.records || []);
    setTotalSales(data.totalSales || 0);
    setTotalExpenses(data.totalExpenses || 0);
    setProfit(data.profit || 0);
    setError('');
  }

  async function loadFaturamento() {
    const response = await fetch('/api/v1/reports/faturamento', { cache: 'no-store', headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok && data.products) {
      setFaturamento(data.products);
    }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadFinance(), loadFaturamento()]).finally(() => setLoading(false));
  }, []);

  const sortedFaturamento = useMemo(() => {
    return [...faturamento].sort((a, b) => {
      const aVal = a[sortCol as keyof ProductRevenue];
      const bVal = b[sortCol as keyof ProductRevenue];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), 'pt-BR', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [faturamento, sortCol, sortDir]);

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  const fatTotals = useMemo(() => {
    const totalRev = faturamento.reduce((s, p) => s + p.totalRevenue, 0);
    const totalProfit = faturamento.reduce((s, p) => s + p.totalProfit, 0);
    const totalQty = faturamento.reduce((s, p) => s + p.totalQuantity, 0);
    const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
    return { totalRev, totalProfit, totalQty, avgMargin };
  }, [faturamento]);

  const typeLabel: Record<string, string> = { sale: 'Venda', purchase: 'Compra', expense: 'Despesa' };
  const typeColor: Record<string, string> = {
    sale: 'var(--success)',
    purchase: 'var(--info)',
    expense: 'var(--danger)',
  };

  const sortIcon = (col: string) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Financeiro" description="Vendas, despesas, lucro e faturamento por produto." />
        <LayoutToolbar pagePath={PAGE_PATH} />

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface-muted)', width: 'fit-content' }}>
          <button
            type="button"
            onClick={() => setActiveTab('financeiro')}
            className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all"
            style={{
              background: activeTab === 'financeiro' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'financeiro' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'financeiro' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Financeiro
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('faturamento')}
            className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all"
            style={{
              background: activeTab === 'faturamento' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'faturamento' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'faturamento' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Faturamento
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg px-4 py-2 text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
            {error}
          </div>
        )}

        {/* ==================== LOADING STATE ==================== */}
        {loading && (
          <div className="space-y-6 animate-fade-in">
            <SkeletonMetrics count={3} />
            <SkeletonTable rows={6} columns={4} />
          </div>
        )}

        {/* ==================== TAB: FINANCEIRO ==================== */}
        {!loading && activeTab === 'financeiro' && (
          <>
            <DraggableSection pagePath={PAGE_PATH} section={sections[0]} index={0} totalSections={sections.length} className="sm:col-span-3">
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard title="Receita" value={`R$ ${totalSales.toFixed(2)}`} />
                <MetricCard title="Despesas" value={`R$ ${totalExpenses.toFixed(2)}`} />
                <MetricCard title="Lucro" value={`R$ ${profit.toFixed(2)}`} />
              </div>
            </DraggableSection>

            <DraggableSection pagePath={PAGE_PATH} section={sections[1]} index={1} totalSections={sections.length}>
              <section
                className="mt-6 rounded-xl p-5"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Histórico</h3>
                <div className="mt-3 divide-y" style={{ borderColor: 'var(--border)' }}>
                  {records.length === 0 ? (
                    <p className="py-6 text-center text-xs" style={{ color: 'var(--text-faint)' }}>
                      Nenhum registro.
                    </p>
                  ) : (
                    records.map((record) => (
                      <div key={record.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {record.description || typeLabel[record.type]}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                            {new Date(record.date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: 'var(--surface-muted)', color: typeColor[record.type] || 'var(--text-muted)' }}
                          >
                            {typeLabel[record.type] || record.type}
                          </span>
                          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            R$ {(record.amount ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </DraggableSection>
          </>
        )}

        {/* ==================== TAB: FATURAMENTO ==================== */}
        {!loading && activeTab === 'faturamento' && (
          <section
            className="rounded-xl p-5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Faturamento por Produto</h3>
              <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{faturamento.length} produtos</span>
            </div>

            {/* Cards de resumo */}
            <div className="grid gap-3 sm:grid-cols-4 mb-5">
              <div className="rounded-lg p-3" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Receita Total</p>
                <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>R$ {fatTotals.totalRev.toFixed(2)}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Lucro Total</p>
                <p className="text-sm font-bold mt-1" style={{ color: 'var(--success)' }}>R$ {fatTotals.totalProfit.toFixed(2)}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Itens Vendidos</p>
                <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{fatTotals.totalQty.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Margem Média</p>
                <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{fatTotals.avgMargin.toFixed(1)}%</p>
              </div>
            </div>

            {/* Botões de ordenação */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { col: 'productName', label: 'Produto' },
                { col: 'totalSales', label: 'Mais vendido' },
                { col: 'totalQuantity', label: 'Quantidade' },
                { col: 'totalRevenue', label: 'Maior receita' },
                { col: 'totalProfit', label: 'Maior lucro' },
                { col: 'averageMargin', label: 'Maior margem' },
              ].map((opt) => (
                <button
                  key={opt.col}
                  type="button"
                  onClick={() => handleSort(opt.col)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80"
                  style={{
                    background: sortCol === opt.col ? 'var(--brand)' : 'var(--surface-muted)',
                    color: sortCol === opt.col ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${sortCol === opt.col ? 'var(--brand)' : 'var(--border)'}`,
                  }}
                >
                  {opt.label}{sortIcon(opt.col)}
                </button>
              ))}
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Produto</th>
                    <th className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Vendas</th>
                    <th className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Qtd</th>
                    <th className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Receita</th>
                    <th className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Custo</th>
                    <th className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Lucro</th>
                    <th className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFaturamento.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs" style={{ color: 'var(--text-faint)' }}>
                        Nenhum dado de faturamento.
                      </td>
                    </tr>
                  ) : (
                    sortedFaturamento.map((p, i) => (
                      <tr
                        key={p.productId}
                        className="transition-colors"
                        style={{
                          background: i % 2 === 0 ? 'transparent' : 'var(--surface-soft)',
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-muted)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--surface-soft)'; }}
                      >
                        <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{p.productName}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{p.totalSales}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{p.totalQuantity.toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>R$ {p.totalRevenue.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>R$ {p.totalCost.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: p.totalProfit > 0 ? 'var(--success)' : p.totalProfit < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                          R$ {p.totalProfit.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {p.averageMargin.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé com totais */}
            {sortedFaturamento.length > 0 && (
              <div className="mt-3 flex justify-end gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{sortedFaturamento.length} produtos</strong></span>
                <span>Receita: <strong style={{ color: 'var(--text-primary)' }}>R$ {fatTotals.totalRev.toFixed(2)}</strong></span>
                <span>Lucro: <strong style={{ color: 'var(--success)' }}>R$ {fatTotals.totalProfit.toFixed(2)}</strong></span>
              </div>
            )}
          </section>
        )}
      </div>
    </ProtectedPage>
  );
}
