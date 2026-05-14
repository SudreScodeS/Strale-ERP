'use client';

import { useEffect, useMemo, useState } from 'react';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform?: (json: any) => ReportRow[];
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
    transform: (json): ReportRow[] => {
      const data = json as Record<string, unknown>;
      const orders = data.orders || data;
      return Array.isArray(orders) ? orders as ReportRow[] : [];
    },
  },
  {
    id: 'inventory',
    title: 'Estoque',
    description: 'Todos os produtos, grupos, variáveis e níveis de estoque.',
    icon: reportIcons.inventory,
    endpoint: '/api/inventory',
    columns: [
      { key: 'productName', label: 'Produto' },
      { key: 'groupName', label: 'Grupo' },
      { key: 'variableName', label: 'Variável' },
      { key: 'stock', label: 'Estoque' },
      { key: 'price', label: 'Preço (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'basePrice', label: 'Preço Base (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'totalValue', label: 'Valor Total (R$)', format: (v) => Number(v).toFixed(2) },
    ],
    transform: (json): ReportRow[] => {
      const data = json as Record<string, unknown>;
      const products = (data.inventory || data.products || []) as Record<string, unknown>[];
      if (!Array.isArray(products)) return [];
      return products.flatMap((p) => {
        const groups = (p.groups || []) as Record<string, unknown>[];
        return groups.flatMap((g) => {
          const vars = (g.variables || []) as Record<string, unknown>[];
          return vars.map((v): ReportRow => ({
            productName: String(p.name ?? ''),
            groupName: String(g.name ?? ''),
            variableName: String(v.name ?? ''),
            stock: Number(v.stock ?? 0),
            price: Number(v.additionalPrice ?? 0),
            basePrice: Number(p.basePrice ?? 0),
            totalValue: Number(v.stock ?? 0) * (Number(p.basePrice ?? 0) + Number(v.additionalPrice ?? 0)),
          }));
        });
      });
    },
  },
  {
    id: 'finance',
    title: 'Financeiro',
    description: 'Compras e vendas consolidadas, divididas por mês.',
    icon: reportIcons.finance,
    endpoint: '/api/finance',
    columns: [
      { key: 'month', label: 'Mês' },
      { key: 'totalSales', label: 'Total Vendas (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'totalPurchases', label: 'Total Compras (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'totalExpenses', label: 'Total Despesas (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'netProfit', label: 'Lucro Líquido (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'transactionCount', label: 'Nº Transações' },
    ],
    transform: (json): ReportRow[] => {
      const data = json as Record<string, unknown>;
      const records = (data.records || data.transactions || []) as Record<string, unknown>[];
      if (!Array.isArray(records) || records.length === 0) return [];

      // Group by month
      const monthMap = new Map<string, { totalSales: number; totalPurchases: number; totalExpenses: number; count: number }>();

      for (const record of records) {
        const date = new Date(String(record.date));
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, { totalSales: 0, totalPurchases: 0, totalExpenses: 0, count: 0 });
        }

        const entry = monthMap.get(monthKey)!;
        entry.count += 1;

        const amount = Number(record.amount) || 0;
        const recordType = String(record.type);

        if (recordType === 'sale') {
          entry.totalSales += amount;
        } else if (recordType === 'purchase') {
          entry.totalPurchases += amount;
        } else {
          entry.totalExpenses += amount;
        }
      }

      // Sort by month key (newest first) and build rows
      return Array.from(monthMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, vals]): ReportRow => ({
          month: new Date(key + '-01').toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' }),
          totalSales: vals.totalSales,
          totalPurchases: vals.totalPurchases,
          totalExpenses: vals.totalExpenses,
          netProfit: vals.totalSales - vals.totalPurchases - vals.totalExpenses,
          transactionCount: vals.count,
        }));
    },
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
    transform: (json): ReportRow[] => {
      const data = json as Record<string, unknown>;
      const quotes = (data.quotes || data || []) as Record<string, unknown>[];
      if (!Array.isArray(quotes)) return [];
      return quotes.map((q): ReportRow => ({
        id: String(q.id ?? ''),
        clientName: String(q.customerName ?? ''),
        totalPrice: Number(q.totalPrice ?? 0),
        status: String(q.status ?? ''),
        createdAt: String(q.createdAt ?? ''),
      }));
    },
  },
  {
    id: 'forecast',
    title: 'Previsão de Demanda',
    description: 'Tendências, previsões e recomendações de estoque.',
    icon: reportIcons.forecast,
    endpoint: '/api/demand-forecast',
    columns: [
      { key: 'productName', label: 'Produto' },
      { key: 'variableName', label: 'Variável' },
      { key: 'groupName', label: 'Grupo' },
      { key: 'currentStock', label: 'Estoque Atual' },
      { key: 'avgWeeklyDemand', label: 'Demanda Semanal' },
      { key: 'avgMonthlyDemand', label: 'Demanda Mensal' },
      { key: 'trend', label: 'Tendência' },
      { key: 'riskLevel', label: 'Risco' },
      { key: 'daysOfStock', label: 'Dias de Estoque' },
      { key: 'recommendation', label: 'Recomendação' },
    ],
    transform: (json): ReportRow[] => {
      const data = json as Record<string, unknown>;
      const summary = data.summary as Record<string, unknown> | undefined;
      if (!summary) return [];

      // Merge all forecast categories into one flat list
      const allForecasts: Record<string, unknown>[] = [];
      const categories = ['highDemand', 'lowDemand', 'criticalRisk', 'watchRisk', 'overstocked'] as const;

      for (const cat of categories) {
        const items = (summary[cat] || []) as Record<string, unknown>[];
        if (Array.isArray(items)) {
          for (const item of items) {
            // Avoid duplicates by checking if variableId already added
            if (!allForecasts.some((f) => f.variableId === item.variableId)) {
              allForecasts.push(item);
            }
          }
        }
      }

      return allForecasts.map((f): ReportRow => ({
        productName: String(f.productName ?? ''),
        variableName: String(f.variableName ?? ''),
        groupName: String(f.groupName ?? ''),
        currentStock: Number(f.currentStock ?? 0),
        avgWeeklyDemand: Number(f.avgWeeklyDemand ?? 0),
        avgMonthlyDemand: Number(f.avgMonthlyDemand ?? 0),
        trend: `${f.trend} (${f.trendPercent !== undefined ? (Number(f.trendPercent) > 0 ? '+' : '') + f.trendPercent + '%' : '—'})`,
        riskLevel: String(f.riskLabel || f.riskLevel || ''),
        daysOfStock: Number(f.daysOfStock ?? 0),
        recommendation: f.suggestedReplenishment && Number(f.suggestedReplenishment) > 0
          ? `Repor ${f.suggestedReplenishment} un.`
          : (f.alerts && Array.isArray(f.alerts) && f.alerts.length > 0 ? String(f.alerts[0]) : 'Estoque adequado'),
      }));
    },
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
  const [rawData, setRawData] = useState<Record<string, ReportRow[]>>({});
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Date range filter
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Date field key per report (the field used for filtering)
  const dateFieldMap: Record<string, string> = {
    sales: 'createdAt',
    finance: 'month',
    quotes: 'createdAt',
    inventory: '',
    forecast: '',
  };

  async function fetchReport(report: ReportConfig) {
    setLoading(report.id);
    setError(null);
    try {
      const res = await fetch(report.endpoint, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();

      // Use custom transform if available, else fall back to generic
      let rows: ReportRow[] = [];
      if (report.transform) {
        rows = report.transform(json);
      } else {
        if (Array.isArray(json)) rows = json;
        else if (json.orders) rows = json.orders;
        else if (json.products) rows = json.products;
        else if (json.transactions) rows = json.transactions;
        else if (json.quotes) rows = json.quotes;
        else if (json.forecasts) rows = json.forecasts;
        else if (json.data) rows = Array.isArray(json.data) ? json.data : [];
      }

      setRawData((prev) => ({ ...prev, [report.id]: rows }));
      setData((prev) => ({ ...prev, [report.id]: rows }));
      setPreviewData(rows);
      setSelectedReport(report.id);
      // Reset date filter when switching reports
      setFromDate('');
      setToDate('');
    } catch {
      setError(`Falha ao carregar dados de ${report.title}.`);
    } finally {
      setLoading(null);
    }
  }

  // Apply date filter when dates or rawData change
  useEffect(() => {
    if (!selectedReport) return;
    const report = REPORTS.find((r) => r.id === selectedReport);
    if (!report) return;

    const dateField = dateFieldMap[selectedReport];
    const raw = rawData[selectedReport] || [];

    if (!fromDate && !toDate) {
      setData((prev) => ({ ...prev, [selectedReport]: raw }));
      setPreviewData(raw);
      return;
    }

    // Finance report uses month labels (e.g. "janeiro de 2026"), filter differently
    if (selectedReport === 'finance' && dateField === 'month') {
      const filtered = raw.filter((row) => {
        const monthStr = String(row.month || '');
        // Parse month label to a comparable date
        const parsed = parseBrazilianMonth(monthStr);
        if (!parsed) return true;
        if (fromDate && parsed < new Date(fromDate + '-01')) return false;
        if (toDate && parsed > new Date(toDate + '-28')) return false;
        return true;
      });
      setData((prev) => ({ ...prev, [selectedReport]: filtered }));
      setPreviewData(filtered);
      return;
    }

    // Standard date filtering for other reports
    if (dateField) {
      const filtered = raw.filter((row) => {
        const dateVal = row[dateField];
        if (!dateVal) return true;
        const d = new Date(String(dateVal));
        if (fromDate && d < new Date(`${fromDate}T00:00:00`)) return false;
        if (toDate && d > new Date(`${toDate}T23:59:59`)) return false;
        return true;
      });
      setData((prev) => ({ ...prev, [selectedReport]: filtered }));
      setPreviewData(filtered);
    }
  }, [fromDate, toDate, rawData, selectedReport]);

  function handleExport(report: ReportConfig) {
    const rows = data[report.id];
    if (!rows || rows.length === 0) {
      fetchReport(report).then(() => {
        // Will export after data loads
      });
      return;
    }
    exportCSV(report, rows);
  }

  const activeReport = REPORTS.find((r) => r.id === selectedReport);
  const hasDateFilter = selectedReport && dateFieldMap[selectedReport];

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

        {/* Date range filter */}
        {hasDateFilter && (
          <div
            className="mt-6 rounded-2xl p-5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[160px]">
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Data inicial
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Data final
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => { setFromDate(''); setToDate(''); }}
                  className="rounded-xl px-4 py-2 text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--surface-muted)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Limpar filtro
                </button>
              )}
            </div>
          </div>
        )}

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
                  {(fromDate || toDate) && ` · Filtrado por período`}
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

// ==========================================
// HELPER: Parse Brazilian month name to Date
// ==========================================
function parseBrazilianMonth(monthStr: string): Date | null {
  const months: Record<string, number> = {
    'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3,
    'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7,
    'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11,
  };

  // Try format like "janeiro de 2026" or "mai de 2026"
  const lower = monthStr.toLowerCase().trim();

  for (const [name, idx] of Object.entries(months)) {
    if (lower.includes(name)) {
      const yearMatch = lower.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
      return new Date(year, idx, 1);
    }
  }

  // Try format "YYYY-MM"
  const isoMatch = monthStr.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, 1);
  }

  return null;
}
