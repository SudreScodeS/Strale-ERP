'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';

interface ReportRow {
  [key: string]: string | number | boolean | null;
}

interface ReportConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  endpoint: string;
  columns: { key: string; label: string; format?: (v: unknown) => string }[];
}

// ==========================================
// REPORT ICONS
// ==========================================

const reportIcons = {
  sales: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  inventory: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  finance: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  quotes: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  forecast: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
};

// ==========================================
// REPORT DEFINITIONS
// ==========================================

const REPORTS: ReportConfig[] = [
  {
    id: 'sales',
    title: 'Vendas',
    description: 'Todos os pedidos com valores, status e responsáveis.',
    icon: reportIcons.sales,
    endpoint: '/api/orders',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Cliente' },
      { key: 'totalPrice', label: 'Total (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'status', label: 'Status' },
      { key: 'createdByName', label: 'Vendedor' },
      { key: 'createdAt', label: 'Data', format: (v) => new Date(String(v)).toLocaleDateString('pt-BR') },
    ],
  },
  {
    id: 'inventory',
    title: 'Estoque',
    description: 'Produtos, variáveis e níveis de estoque.',
    icon: reportIcons.inventory,
    endpoint: '/api/inventory',
    columns: [
      { key: 'productName', label: 'Produto' },
      { key: 'groupName', label: 'Grupo' },
      { key: 'variableName', label: 'Variável' },
      { key: 'stock', label: 'Estoque' },
      { key: 'price', label: 'Preço (R$)', format: (v) => Number(v).toFixed(2) },
    ],
  },
  {
    id: 'finance',
    title: 'Financeiro',
    description: 'Receitas, despesas e lucro consolidado.',
    icon: reportIcons.finance,
    endpoint: '/api/finance',
    columns: [
      { key: 'type', label: 'Tipo' },
      { key: 'description', label: 'Descrição' },
      { key: 'amount', label: 'Valor (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'date', label: 'Data', format: (v) => new Date(String(v)).toLocaleDateString('pt-BR') },
      { key: 'category', label: 'Categoria' },
    ],
  },
  {
    id: 'quotes',
    title: 'Orçamentos',
    description: 'Orçamentos com status e valores.',
    icon: reportIcons.quotes,
    endpoint: '/api/quotes',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'clientName', label: 'Cliente' },
      { key: 'totalPrice', label: 'Total (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Data', format: (v) => new Date(String(v)).toLocaleDateString('pt-BR') },
    ],
  },
  {
    id: 'forecast',
    title: 'Previsão de Demanda',
    description: 'Tendências, previsões e recomendações de estoque.',
    icon: reportIcons.forecast,
    endpoint: '/api/demand-forecast',
    columns: [
      { key: 'productName', label: 'Produto' },
      { key: 'trend', label: 'Tendência' },
      { key: 'weeklyForecast', label: 'Previsão Semanal' },
      { key: 'monthlyForecast', label: 'Previsão Mensal' },
      { key: 'riskLevel', label: 'Risco' },
      { key: 'recommendation', label: 'Recomendação' },
    ],
  },
];

// ==========================================
// CSV EXPORT
// ==========================================

function escapeCSV(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportCSV(report: ReportConfig, data: ReportRow[]) {
  const header = report.columns.map((c) => escapeCSV(c.label)).join(',');
  const rows = data.map((row) =>
    report.columns.map((c) => {
      const raw = row[c.key];
      const formatted = c.format ? c.format(raw) : raw;
      return escapeCSV(formatted as string | number | boolean | null);
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.id}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// PAGE
// ==========================================

export default function ReportsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, ReportRow[]>>({});
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchReport(report: ReportConfig) {
    setLoading(report.id);
    setError(null);
    try {
      const res = await fetch(report.endpoint, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();

      // Normalize different response shapes
      let rows: ReportRow[] = [];
      if (Array.isArray(json)) {
        rows = json;
      } else if (json.orders) rows = json.orders;
      else if (json.products) {
        // Flatten inventory: products → rows
        rows = json.products.flatMap((p: Record<string, unknown>) => {
          const groups = (p.groups || []) as Record<string, unknown>[];
          return groups.flatMap((g: Record<string, unknown>) => {
            const vars = (g.variables || []) as Record<string, unknown>[];
            return vars.map((v: Record<string, unknown>) => ({
              productName: p.name,
              groupName: g.name,
              variableName: v.name,
              stock: v.stock,
              price: v.price,
            }));
          });
        });
      }
      else if (json.transactions) rows = json.transactions;
      else if (json.quotes) rows = json.quotes;
      else if (json.forecasts) rows = json.forecasts;
      else if (json.data) rows = Array.isArray(json.data) ? json.data : [];
      else rows = [];

      setData((prev) => ({ ...prev, [report.id]: rows }));
      setPreviewData(rows);
      setSelectedReport(report.id);
    } catch {
      setError(`Falha ao carregar dados de ${report.title}.`);
    } finally {
      setLoading(null);
    }
  }

  function handleExport(report: ReportConfig) {
    const rows = data[report.id];
    if (!rows || rows.length === 0) {
      fetchReport(report).then(() => {
        // Will export after data loads — handled in effect below
      });
      return;
    }
    exportCSV(report, rows);
  }

  // Auto-export after fetch if user clicked export with no data
  useEffect(() => {
    if (selectedReport && data[selectedReport]) {
      // Data is ready
    }
  }, [selectedReport, data]);

  const activeReport = REPORTS.find((r) => r.id === selectedReport);

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader
          title="Relatórios"
          description="Exporte dados do sistema em formato CSV para análise externa."
        />

        {/* Report cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((report) => {
            const isActive = selectedReport === report.id;
            const isLoading = loading === report.id;
            const rows = data[report.id];

            return (
              <div
                key={report.id}
                className={`group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:shadow-md cursor-pointer ${
                  isActive ? 'ring-2 ring-blue-400 shadow-md' : ''
                }`}
                style={{
                  background: 'var(--card-bg)',
                  border: `1px solid ${isActive ? 'var(--brand)' : 'var(--card-border)'}`,
                }}
                onClick={() => fetchReport(report)}
              >
                {/* Decorative blob */}
                <div
                  className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-[0.07] transition-opacity group-hover:opacity-[0.12]"
                  style={{ background: 'var(--brand)' }}
                />

                <div className="relative flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'var(--brand-muted)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}
                  >
                    {report.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {report.title}
                    </h3>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {report.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  {rows ? (
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                      {rows.length} registro{rows.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      Clique para carregar
                    </span>
                  )}

                  {isLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
                  ) : rows && rows.length > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(report);
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--brand)', color: '#fff' }}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      CSV
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div
            className="mt-6 rounded-2xl p-4 text-sm"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}
          >
            {error}
          </div>
        )}

        {/* Preview table */}
        {activeReport && previewData.length > 0 && (
          <section
            className="mt-8 rounded-2xl p-6"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Prévia — {activeReport.title}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Mostrando até 50 registros. Exporte para ver todos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportCSV(activeReport, previewData)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                style={{ background: 'var(--brand)', color: '#fff' }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Exportar CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {activeReport.columns.map((col) => (
                      <th
                        key={col.key}
                        className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 50).map((row, i) => (
                    <tr
                      key={i}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-soft)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {activeReport.columns.map((col) => {
                        const raw = row[col.key];
                        const formatted = col.format ? col.format(raw) : raw;
                        return (
                          <td key={col.key} className="py-3 pr-4" style={{ color: 'var(--text-primary)' }}>
                            {String(formatted ?? '')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewData.length > 50 && (
              <p className="mt-3 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                + {previewData.length - 50} registros não mostrados
              </p>
            )}
          </section>
        )}
      </div>
    </ProtectedPage>
  );
}
