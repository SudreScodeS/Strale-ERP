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
    description: 'Todas as compras e vendas registradas no sistema.',
    icon: reportIcons.finance,
    endpoint: '/api/finance',
    columns: [
      { key: 'type', label: 'Tipo' },
      { key: 'description', label: 'Descrição' },
      { key: 'amount', label: 'Valor (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'date', label: 'Data', format: (v) => new Date(String(v)).toLocaleDateString('pt-BR') },
    ],
    transform: (json): ReportRow[] => {
      const data = json as Record<string, unknown>;
      const records = (data.records || data.transactions || []) as Record<string, unknown>[];
      if (!Array.isArray(records)) return [];

      const typeLabels: Record<string, string> = {
        sale: 'Venda',
        purchase: 'Compra',
        expense: 'Despesa',
      };

      return records
        .sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime())
        .map((r): ReportRow => ({
          type: typeLabels[String(r.type)] || String(r.type),
          description: String(r.description ?? ''),
          amount: Number(r.amount ?? 0),
          date: String(r.date ?? ''),
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
// HELPERS
// ==========================================

function computeStats(rows: ReportRow[], reportId: string) {
  if (rows.length === 0) return null;

  const stats: { label: string; value: string; icon: React.ReactNode }[] = [];

  // Total records
  stats.push({
    label: 'Total de Registros',
    value: rows.length.toLocaleString('pt-BR'),
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
  });

  // Value sum for numeric "total" fields
  const valueFields: Record<string, string> = {
    sales: 'totalPrice',
    inventory: 'totalValue',
    finance: 'amount',
    quotes: 'totalPrice',
    forecast: 'currentStock',
  };
  const valueField = valueFields[reportId];
  if (valueField) {
    const sum = rows.reduce((acc, row) => acc + (Number(row[valueField]) || 0), 0);
    const avg = sum / rows.length;
    stats.push({
      label: reportId === 'forecast' ? 'Total Estoque' : 'Valor Total',
      value: `R$ ${sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    });
    if (reportId !== 'forecast') {
      stats.push({
        label: 'Valor Médio',
        value: `R$ ${avg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
          </svg>
        ),
      });
    }
  }

  // Unique clients for sales/quotes
  if (reportId === 'sales' || reportId === 'quotes') {
    const clientField = reportId === 'sales' ? 'name' : 'clientName';
    const uniqueClients = new Set(rows.map((r) => String(r[clientField] || '')).filter(Boolean));
    stats.push({
      label: 'Clientes Únicos',
      value: uniqueClients.size.toLocaleString('pt-BR'),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    });
  }

  // Unique products for inventory
  if (reportId === 'inventory') {
    const uniqueProducts = new Set(rows.map((r) => String(r.productName || '')).filter(Boolean));
    stats.push({
      label: 'Produtos Únicos',
      value: uniqueProducts.size.toLocaleString('pt-BR'),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      ),
    });
  }

  return stats;
}

const PAGE_SIZE = 50;

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

  // Search, sort, pagination
  const [searchText, setSearchText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [visibleRows, setVisibleRows] = useState(PAGE_SIZE);

  // Date field key per report (the field used for filtering)
  const dateFieldMap: Record<string, string> = {
    sales: 'createdAt',
    finance: 'date',
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
      // Reset filters when switching reports
      setFromDate('');
      setToDate('');
      setSearchText('');
      setSortCol(null);
      setSortDir('asc');
      setVisibleRows(PAGE_SIZE);
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

    // Standard date filtering
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

  // Search filtering
  const searchFilteredData = useMemo(() => {
    if (!searchText.trim()) return previewData;
    const query = searchText.toLowerCase().trim();
    return previewData.filter((row) =>
      Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      })
    );
  }, [previewData, searchText]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortCol) return searchFilteredData;
    return [...searchFilteredData].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), 'pt-BR', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [searchFilteredData, sortCol, sortDir]);

  // Paginated data
  const paginatedData = useMemo(() => sortedData.slice(0, visibleRows), [sortedData, visibleRows]);

  function handleSort(colKey: string) {
    if (sortCol === colKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colKey);
      setSortDir('asc');
    }
  }

  const activeReport = REPORTS.find((r) => r.id === selectedReport);
  const hasDateFilter = selectedReport && dateFieldMap[selectedReport];
  const stats = activeReport ? computeStats(previewData, activeReport.id) : null;

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader
          title="Relatórios"
          description="Exporte dados do sistema em formato CSV para análise externa."
        />

        {/* Section: Select Report */}
        <div className="mb-2">
          <h2
            className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Selecione um Relatório
          </h2>
        </div>

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

        {/* Summary stats */}
        {stats && stats.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl p-4"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}
                >
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section: Filters */}
        {(hasDateFilter || selectedReport) && (
          <div className="mt-8 mb-2">
            <h2
              className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              Filtros
            </h2>
          </div>
        )}

        {/* Date range filter */}
        {hasDateFilter && (
          <div
            className="rounded-2xl p-5"
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

        {/* Empty state when no report selected */}
        {!selectedReport && !error && (
          <div
            className="mt-12 flex flex-col items-center justify-center rounded-2xl p-12 text-center"
            style={{ background: 'var(--card-bg)', border: '2px dashed var(--border)' }}
          >
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-faint)' }}
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Nenhum relatório selecionado
            </h3>
            <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--text-muted)' }}>
              Escolha um dos relatórios acima para visualizar os dados. Você poderá filtrar, ordenar e exportar em CSV.
            </p>
          </div>
        )}

        {/* Section: Data preview */}
        {activeReport && previewData.length > 0 && (
          <section
            className="mt-8 rounded-2xl p-6"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="mb-2">
              <h2
                className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.375" />
                </svg>
                Dados
              </h2>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {activeReport.title}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {sortedData.length} registro{sortedData.length !== 1 ? 's' : ''}
                  {searchText && ` (filtrado de ${previewData.length})`}
                  {(fromDate || toDate) && ' · Filtrado por período'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Search input */}
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    style={{ color: 'var(--text-faint)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar nos dados…"
                    value={searchText}
                    onChange={(e) => { setSearchText(e.target.value); setVisibleRows(PAGE_SIZE); }}
                    className="w-56 rounded-xl py-2 pl-9 pr-3 text-sm"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {searchText && (
                    <button
                      type="button"
                      onClick={() => setSearchText('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => exportCSV(activeReport, sortedData)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: 'var(--brand)', color: '#fff' }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Exportar CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {activeReport.columns.map((col) => (
                      <th
                        key={col.key}
                        className="group/th cursor-pointer select-none pb-3 pr-4 text-xs font-semibold uppercase tracking-wider transition-colors hover:opacity-80"
                        style={{ color: sortCol === col.key ? 'var(--brand)' : 'var(--text-muted)' }}
                        onClick={() => handleSort(col.key)}
                        title={`Ordenar por ${col.label}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortCol === col.key ? (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={sortDir === 'asc' ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'} />
                            </svg>
                          ) : (
                            <svg className="h-3 w-3 opacity-0 transition-opacity group-hover/th:opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                            </svg>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length > 0 ? (
                    paginatedData.map((row, i) => (
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
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={activeReport.columns.length}
                        className="py-8 text-center text-sm"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Nenhum resultado encontrado para a busca.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Load more button */}
            {visibleRows < sortedData.length && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleRows((v) => v + PAGE_SIZE)}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80"
                  style={{
                    background: 'var(--surface-muted)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Carregar mais ({Math.min(PAGE_SIZE, sortedData.length - visibleRows)} de {sortedData.length - visibleRows} restantes)
                </button>
              </div>
            )}

            {/* Showing X of Y */}
            <p className="mt-3 text-center text-xs" style={{ color: 'var(--text-faint)' }}>
              Exibindo {paginatedData.length} de {sortedData.length} registro{sortedData.length !== 1 ? 's' : ''}
              {searchText && ` (busca: "${searchText}")`}
            </p>
          </section>
        )}

        {/* No data state after report load */}
        {activeReport && previewData.length === 0 && !loading && !error && (
          <div
            className="mt-8 flex flex-col items-center justify-center rounded-2xl p-12 text-center"
            style={{ background: 'var(--card-bg)', border: '2px dashed var(--border)' }}
          >
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-faint)' }}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Nenhum dado encontrado
            </h3>
            <p className="mt-1 max-w-xs text-xs" style={{ color: 'var(--text-muted)' }}>
              {hasDateFilter && (fromDate || toDate)
                ? 'Tente ajustar o período do filtro ou limpe os filtros para ver todos os dados.'
                : `O relatório de ${activeReport.title} não retornou dados no momento.`}
            </p>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
