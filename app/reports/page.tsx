'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders, getCurrentUser } from '../lib/authClient';

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
    id: 'faturamento',
    title: 'Faturamento',
    description: 'Vendas por produto com margem de lucro e quantidade vendida.',
    icon: reportIcons.finance,
    endpoint: '/api/reports/faturamento',
    columns: [
      { key: 'productName', label: 'Produto' },
      { key: 'totalSales', label: 'Vendas' },
      { key: 'totalQuantity', label: 'Qtd. Vendida' },
      { key: 'totalRevenue', label: 'Receita (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'totalCost', label: 'Custo (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'totalProfit', label: 'Lucro (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'averageMargin', label: 'Margem Média (%)', format: (v) => Number(v).toFixed(1) },
      { key: 'productMargin', label: 'Margem Config. (%)', format: (v) => Number(v).toFixed(1) },
    ],
    transform: (json): ReportRow[] => {
      const data = json as Record<string, unknown>;
      const products = (data.products || []) as Record<string, unknown>[];
      if (!Array.isArray(products)) return [];
      return products.map((p): ReportRow => ({
        productName: String(p.productName ?? ''),
        totalSales: Number(p.totalSales ?? 0),
        totalQuantity: Number(p.totalQuantity ?? 0),
        totalRevenue: Number(p.totalRevenue ?? 0),
        totalCost: Number(p.totalCost ?? 0),
        totalProfit: Number(p.totalProfit ?? 0),
        averageMargin: Number(p.averageMargin ?? 0),
        productMargin: Number(p.productMargin ?? 0),
      }));
    },
  },
  {
    id: 'sales',
    title: 'Vendas',
    description: 'Todos os pedidos com valores, status e responsáveis.',
    icon: reportIcons.sales,
    endpoint: '/api/orders',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Pedido' },
      { key: 'totalPrice', label: 'Total (R$)', format: (v) => Number(v).toFixed(2) },
      { key: 'status', label: 'Status' },
      { key: 'createdByName', label: 'Vendedor' },
      { key: 'createdAt', label: 'Data', format: (v) => new Date(String(v)).toLocaleDateString('pt-BR') },
    ],
    transform: (json): ReportRow[] => {
      const data = json as Record<string, unknown>;
      const orders = (data.orders || data) as Record<string, unknown>[];
      if (!Array.isArray(orders)) return [];
      const statusLabels: Record<string, string> = {
        pending: 'Pendente',
        completed: 'Concluído',
        cancelled: 'Cancelado',
      };
      return orders.map((o): ReportRow => ({
        ...o,
        status: statusLabels[String(o.status)] || String(o.status),
        createdAt: String(o.createdAt ?? ''),
      }));
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
          return vars.map((v): ReportRow => {
            const unit = (v.unitOfMeasure as string) || 'un';
            const unitLabel = unit === 'cento' ? 'ct.' : unit === 'milhar' ? 'ml.' : 'un.';
            return {
              productName: String(p.name ?? ''),
              groupName: String(g.name ?? ''),
              variableName: String(v.name ?? ''),
              stock: `${Number(v.stock ?? 0)} ${unitLabel}`,
              price: Number(v.additionalPrice ?? 0),
              basePrice: Number(p.basePrice ?? 0),
              totalValue: Number(v.stock ?? 0) * (Number(p.basePrice ?? 0) + Number(v.additionalPrice ?? 0)),
            };
          });
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
          date: r.date instanceof Date ? r.date.toISOString() : String(r.date ?? ''),
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
      const statusLabels: Record<string, string> = {
        draft: 'Rascunho',
        sent: 'Enviado',
        approved: 'Aprovado',
        rejected: 'Rejeitado',
        converted: 'Convertido',
      };
      return quotes.map((q): ReportRow => ({
        id: String(q.id ?? ''),
        clientName: String(q.customerName ?? ''),
        totalPrice: Number(q.totalPrice ?? 0),
        status: statusLabels[String(q.status)] || String(q.status),
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

      const allForecasts: Record<string, unknown>[] = [];
      const categories = ['highDemand', 'lowDemand', 'criticalRisk', 'watchRisk', 'overstocked'] as const;

      for (const cat of categories) {
        const items = (summary[cat] || []) as Record<string, unknown>[];
        if (Array.isArray(items)) {
          for (const item of items) {
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
// SORT PRESETS PER REPORT TYPE
// ==========================================

interface SortPreset {
  key: string;
  label: string;
  col: string;
  dir: 'asc' | 'desc';
}

const SORT_PRESETS: Record<string, SortPreset[]> = {
  faturamento: [
    { key: 'product-asc', label: 'Produto (A-Z)', col: 'productName', dir: 'asc' },
    { key: 'product-desc', label: 'Produto (Z-A)', col: 'productName', dir: 'desc' },
    { key: 'sales-desc', label: 'Mais vendido', col: 'totalSales', dir: 'desc' },
    { key: 'sales-asc', label: 'Menos vendido', col: 'totalSales', dir: 'asc' },
    { key: 'qty-desc', label: 'Maior quantidade', col: 'totalQuantity', dir: 'desc' },
    { key: 'revenue-desc', label: 'Maior receita', col: 'totalRevenue', dir: 'desc' },
    { key: 'revenue-asc', label: 'Menor receita', col: 'totalRevenue', dir: 'asc' },
    { key: 'profit-desc', label: 'Maior lucro', col: 'totalProfit', dir: 'desc' },
    { key: 'margin-desc', label: 'Maior margem média', col: 'averageMargin', dir: 'desc' },
    { key: 'margin-asc', label: 'Menor margem média', col: 'averageMargin', dir: 'asc' },
    { key: 'config-margin-desc', label: 'Maior margem config.', col: 'productMargin', dir: 'desc' },
  ],
  sales: [
    { key: 'price-desc', label: 'Maior valor', col: 'totalPrice', dir: 'desc' },
    { key: 'price-asc', label: 'Menor valor', col: 'totalPrice', dir: 'asc' },
    { key: 'date-desc', label: 'Mais recente', col: 'createdAt', dir: 'desc' },
    { key: 'date-asc', label: 'Mais antigo', col: 'createdAt', dir: 'asc' },
    { key: 'status-asc', label: 'Status (A-Z)', col: 'status', dir: 'asc' },
    { key: 'vendor-asc', label: 'Vendedor (A-Z)', col: 'createdByName', dir: 'asc' },
    { key: 'name-asc', label: 'Pedido (A-Z)', col: 'name', dir: 'asc' },
  ],
  inventory: [
    { key: 'stock-desc', label: 'Maior estoque', col: 'stock', dir: 'desc' },
    { key: 'stock-asc', label: 'Menor estoque', col: 'stock', dir: 'asc' },
    { key: 'price-desc', label: 'Maior preço', col: 'price', dir: 'desc' },
    { key: 'price-asc', label: 'Menor preço', col: 'price', dir: 'asc' },
    { key: 'total-desc', label: 'Maior valor total', col: 'totalValue', dir: 'desc' },
    { key: 'total-asc', label: 'Menor valor total', col: 'totalValue', dir: 'asc' },
    { key: 'product-asc', label: 'Produto (A-Z)', col: 'productName', dir: 'asc' },
    { key: 'group-asc', label: 'Grupo (A-Z)', col: 'groupName', dir: 'asc' },
  ],
  finance: [
    { key: 'amount-desc', label: 'Maior valor', col: 'amount', dir: 'desc' },
    { key: 'amount-asc', label: 'Menor valor', col: 'amount', dir: 'asc' },
    { key: 'date-desc', label: 'Mais recente', col: 'date', dir: 'desc' },
    { key: 'date-asc', label: 'Mais antigo', col: 'date', dir: 'asc' },
    { key: 'sale-first', label: 'Vendas primeiro', col: 'type', dir: 'asc' },
    { key: 'purchase-first', label: 'Compras primeiro', col: 'type', dir: 'desc' },
    { key: 'desc-asc', label: 'Descrição (A-Z)', col: 'description', dir: 'asc' },
  ],
  quotes: [
    { key: 'price-desc', label: 'Maior valor', col: 'totalPrice', dir: 'desc' },
    { key: 'price-asc', label: 'Menor valor', col: 'totalPrice', dir: 'asc' },
    { key: 'date-desc', label: 'Mais recente', col: 'createdAt', dir: 'desc' },
    { key: 'date-asc', label: 'Mais antigo', col: 'createdAt', dir: 'asc' },
    { key: 'status-asc', label: 'Status (A-Z)', col: 'status', dir: 'asc' },
    { key: 'client-asc', label: 'Cliente (A-Z)', col: 'clientName', dir: 'asc' },
  ],
  forecast: [
    { key: 'stock-desc', label: 'Maior estoque', col: 'currentStock', dir: 'desc' },
    { key: 'stock-asc', label: 'Menor estoque', col: 'currentStock', dir: 'asc' },
    { key: 'weekly-desc', label: 'Maior demanda semanal', col: 'avgWeeklyDemand', dir: 'desc' },
    { key: 'monthly-desc', label: 'Maior demanda mensal', col: 'avgMonthlyDemand', dir: 'desc' },
    { key: 'days-asc', label: 'Menos dias de estoque', col: 'daysOfStock', dir: 'asc' },
    { key: 'days-desc', label: 'Mais dias de estoque', col: 'daysOfStock', dir: 'desc' },
    { key: 'product-asc', label: 'Produto (A-Z)', col: 'productName', dir: 'asc' },
    { key: 'risk-asc', label: 'Risco (A-Z)', col: 'riskLevel', dir: 'asc' },
  ],
};

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
// STYLED HTML REPORT EXPORT
// ==========================================

function exportStyledReport(report: ReportConfig, data: ReportRow[], stats: { label: string; value: string }[] | null) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const statsHtml = stats && stats.length > 0
    ? `<div class="stats-grid">${stats.map(s => `
        <div class="stat-card">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value">${s.value}</div>
        </div>`).join('')}
      </div>`
    : '';

  const tableHeader = report.columns.map(c => `<th>${c.label}</th>`).join('');
  const tableRows = data.map((row, i) => {
    const cells = report.columns.map(c => {
      const raw = row[c.key];
      const formatted = c.format ? c.format(raw) : raw;
      return `<td>${String(formatted ?? '—')}</td>`;
    }).join('');
    return `<tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">${cells}</tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title} — Elitium ERP</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc; color: #0f172a; padding: 2rem;
      -webkit-font-smoothing: antialiased;
    }
    .report-container {
      max-width: 1100px; margin: 0 auto; background: #fff;
      border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .report-header {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: #fff; padding: 2rem 2.5rem;
      display: flex; justify-content: space-between; align-items: center;
    }
    .report-header-left { flex: 1; }
    .report-header-right { flex-shrink: 0; margin-left: 2rem; display: flex; align-items: center; }
    .report-header-right img { height: 64px; width: auto; opacity: 0.9; }
    .report-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }
    .report-header p { opacity: 0.85; font-size: 0.9rem; }
    .report-header .meta { margin-top: 0.75rem; display: flex; gap: 2rem; font-size: 0.8rem; opacity: 0.7; }
    .report-body { padding: 2rem 2.5rem; }
    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem; margin-bottom: 2rem;
    }
    .stat-card {
      background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 1rem 1.25rem;
    }
    .stat-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 600; }
    .stat-value { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-top: 0.25rem; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .data-table th {
      text-align: left; padding: 0.75rem 1rem; font-size: 0.7rem;
      text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;
      border-bottom: 2px solid #e2e8f0; font-weight: 600;
    }
    .data-table td {
      padding: 0.6rem 1rem; border-bottom: 1px solid #f1f5f9; color: #0f172a;
    }
    .row-even { background: #fff; }
    .row-odd { background: #f8fafc; }
    .data-table tr:hover { background: #f1f5f9; }
    .report-footer {
      padding: 1.25rem 2.5rem; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.75rem; color: #94a3b8;
    }
    .report-footer .brand { font-weight: 700; color: #334155; }
    .summary-row {
      display: flex; justify-content: space-between; padding: 0.4rem 0;
      font-size: 0.85rem;
    }
    .summary-row .label { color: #64748b; }
    .summary-row .value { font-weight: 600; color: #0f172a; }
    .summary-total {
      border-top: 2px solid #334155; margin-top: 0.5rem; padding-top: 0.5rem;
      font-size: 1rem; font-weight: 700;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .report-container { box-shadow: none; border-radius: 0; }
      .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .row-even, .row-odd { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <div class="report-header-left">
        <h1>${report.title}</h1>
        <p>${report.description}</p>
        <div class="meta">
          <span>${dateStr}</span>
          <span>${timeStr}</span>
          <span>${data.length} registro${data.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="report-header-right">
        <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODQ3IiBoZWlnaHQ9IjM2OSIgdmlld0JveD0iMCAwIDg0NyAzNjkiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0yNDQuOTc0IDIyNy43MzlMMjkwIDI1Ny45NDdWMTA1LjMxNkwyNDQuOTc0IDEzNi4zMzdWMjI3LjczOVoiIGZpbGw9IiM0ODM3N0MiLz4KPHBhdGggZD0iTTAgOTAuMzMwMUwxNDMuNTM1IDBMMjkwIDkwLjMzMDFDMjc1LjM1NCAxMDAuMDQzIDI0NC45NzQgMTIyLjQ4NyAyNDQuOTc0IDEyMi40ODdDMjQ0Ljk3NCAxMjQuODE4IDE3Ny43MSA4Mi41NTk4IDE0My41MzUgNjEuMTkxNEw0OS43OTggMTIyLjM4M1YxODAuNjZMMCAyMTIuNzEzVjkwLjMzMDFaIiBmaWxsPSIjRjZGOUVBIi8+CjxwYXRoIGQ9Ik0yMTYuNzY4IDE1NC40MzVMMTY0LjA0IDEyMi4zODNMMCAyMjguNzM5VjI4NC4xMDNMMTQzLjUzNSAzNjguNjA1TDI5MCAyNzMuOTA0TDI0NC45NzQgMjQ0LjU5MkwxNDMuNTM1IDMwNS45NTdMNTQuMTkxOSAyNTYuNDIxTDIxNi43NjggMTU0LjQzNVoiIGZpbGw9IiNGNkY5RUEiLz4KPHBhdGggZD0iTTM5NC40NjYgMjIxVjExMy40MzhINDQwLjg3NlYxMjEuNjI4SDQwNi4yOTZWMTYwLjIxMkg0MzMuOTZWMTY5LjMxMkg0MDYuMjk2VjIxMi44MUg0NDAuODc2VjIyMUgzOTQuNDY2Wk00NjUuNzczIDIyMVYxMTMuNDM4SDQ3Ny4wNTdWMjEyLjgxSDUwNy4wODdWMjIxSDQ2NS43NzNaTTUyOC45MDQgMjIxVjExMy40MzhINTQwLjM3VjIyMUg1MjguOTA0Wk01ODAuODYxIDIyMVYxMjEuNjI4SDU2Mi44NDNWMTEzLjQzOEg2MTAuNzA5VjEyMS42MjhINTkyLjMyN1YyMjFINTgwLjg2MVpNNjMzLjMwNSAyMjFWMTEzLjQzOEg2NDQuNzcxVjIyMUg2MzMuMzA1Wk03MDIuOTE2IDIyMy4xODRDNjk5LjE1NSAyMjMuMTg0IDY5NS42MzYgMjIyLjg4MSA2OTIuMzYgMjIyLjI3NEM2ODkuMDg0IDIyMS42NjcgNjg2LjE3MiAyMjAuNTE1IDY4My42MjQgMjE4LjgxNkM2ODEuMTk4IDIxNy4xMTcgNjc5LjI1NiAyMTQuNjMgNjc3LjggMjExLjM1NEM2NzYuNDY2IDIwNy45NTcgNjc1Ljc5OCAyMDMuNDY3IDY3NS43OTggMTk3Ljg4NlYxMTMuNDM4SDY4Ny4yNjRWMjAwLjI1MkM2ODcuMjY0IDIwNC42MiA2ODcuOTkyIDIwNy44OTYgNjg5LjQ0OCAyMTAuMDhDNjkwLjkwNCAyMTIuMjY0IDY5Mi43ODUgMjEzLjc4MSA2OTUuMDkgMjE0LjYzQzY5Ny41MTcgMjE1LjM1OCA3MDAuMTI2IDIxNS43MjIgNzAyLjkxNiAyMTUuNzIyQzcwNS41ODYgMjE1LjcyMiA3MDguMTM0IDIxNS4zNTggNzEwLjU2IDIxNC42M0M3MTIuOTg3IDIxMy43ODEgNzE0LjkyOCAyMTIuMjY0IDcxNi4zODQgMjEwLjA4QzcxNy44NCAyMDcuODk2IDcxOC41NjggMjA0LjYyIDcxOC41NjggMjAwLjI1MlYxMTMuNDM4SDcyOS44NTJWMTk3Ljg4NkM3MjkuODUyIDIwMy40NjcgNzI5LjEyNCAyMDcuOTU3IDcyNy42NjggMjExLjM1NEM3MjYuMzM0IDIxNC42MyA3MjQuNDUzIDIxNy4xMTcgNzIyLjAyNiAyMTguODE2QzcxOS42IDIyMC41MTUgNzE2LjY4OCAyMjEuNjY3IDcxMy4yOSAyMjIuMjc0QzcxMC4wMTQgMjIyLjg4MSA3MDYuNTU2IDIyMy4xODQgNzAyLjkxNiAyMjMuMTg0Wk03NjAuOTkgMjIxVjExMy40MzhINzc0LjQ1OEw3OTcuNzU0IDIwMC45OEw4MjEuNTk2IDExMy40MzhIODM0LjUxOFYyMjFIODI0LjMyNlYxMzQuMDA0TDgwMS45NCAyMjFINzkzLjc1TDc3MS4zNjQgMTM0LjAwNFYyMjFINzYwLjk5WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTM5NC43MjUgMjg5VjI0NC42NzVINDEzLjg1VjI0OC4wNUgzOTkuNlYyNjMuOTVINDExVjI2Ny43SDM5OS42VjI4NS42MjVINDEzLjg1VjI4OUgzOTQuNzI1Wk00MjAuMzYgMjg5VjI0NC42NzVINDM0LjMxQzQzNi44MSAyNDQuNjc1IDQzOC44MzUgMjQ1LjI3NSA0NDAuMzg1IDI0Ni40NzVDNDQxLjkzNSAyNDcuNjI1IDQ0Mi43MSAyNDkuNDc1IDQ0Mi43MSAyNTIuMDI1VjI1OS4yMjVDNDQyLjcxIDI2MS43NzUgNDQxLjkzNSAyNjMuNzUgNDQwLjM4NSAyNjUuMTVDNDM4Ljg4NSAyNjYuNTUgNDM2LjgzNSAyNjcuMyA0MzQuMjM1IDI2Ny40VjI2Ny4zMjVDNDM1LjgzNSAyNjcuNDI1IDQzNy4wMzUgMjY4IDQzNy44MzUgMjY5LjA1QzQzOC42MzUgMjcwLjA1IDQzOS4zMzUgMjcxLjYyNSA0MzkuOTM1IDI3My43NzVMNDQ0LjUxIDI4OUg0MzkuMjZMNDM1LjIxIDI3NC4wNzVDNDM0LjgxIDI3Mi42NzUgNDM0LjI4NSAyNzEuNDI1IDQzMy42MzUgMjcwLjMyNUM0MzMuMDM1IDI2OS4xNzUgNDMyLjAzNSAyNjguNiA0MzAuNjM1IDI2OC42SDQyNS4yMzVWMjg5SDQyMC4zNlpNNDI1LjIzNSAyNjUuMjI1SDQzMS44MzVDNDM0LjEzNSAyNjUuMjI1IDQzNS43MzUgMjY0LjcgNDM2LjYzNSAyNjMuNjVDNDM3LjU4NSAyNjIuNTUgNDM4LjA2IDI2MC45NSA0MzguMDYgMjU4Ljg1VjI1Mi44NUM0MzguMDYgMjUxIDQzNy42MSAyNDkuNjUgNDM2LjcxIDI0OC44QzQzNS44NiAyNDcuOSA0MzQuNTM1IDI0Ny40NSA0MzIuNzM1IDI0Ny40NUg0MjUuMjM1VjI2NS4yMjVaTTQ1MS40MTQgMjg5VjI0NC42NzVINDY1LjEzOUM0NjcuNjg5IDI0NC42NzUgNDY5LjczOSAyNDUuMjc1IDQ3MS4yODkgMjQ2LjQ3NUM0NzIuODM5IDI0Ny42MjUgNDczLjYxNCAyNDkuNDc1IDQ3My42MTQgMjUyLjAyNVYyNjAuMkM0NzMuNjE0IDI2MS45IDQ3My4zNjQgMjYzLjUgNDcyLjg2NCAyNjVDNDcyLjM2NCAyNjYuNDUgNDcxLjQzOSAyNjcuNjI1IDQ3MC4wODkgMjY4LjUyNUM0NjguNzM5IDI2OS40MjUgNDY2Ljc4OSAyNjkuODc1IDQ2NC4yMzkgMjY5Ljg3NUg0NTYuMjg5VjI4OUg0NTEuNDE0Wk00NTYuMjg5IDI2Ny4xSDQ2Mi44MTRDNDY0LjgxNCAyNjcuMSA0NjYuMzE0IDI2Ni41IDQ2Ny4zMTQgMjY1LjNDNDY4LjM2NCAyNjQuMDUgNDY4Ljg4OSAyNjIuMTUgNDY4Ljg4OSAyNTkuNlYyNTMuODI1QzQ2OC44ODkgMjUxLjYyNSA0NjguNDE0IDI1MC4wMjUgNDY3LjQ2NCAyNDkuMDI1QzQ2Ni41MTQgMjQ3Ljk3NSA0NjUuMzY0IDI0Ny40NSA0NjQuMDE0IDI0Ny40NUg0NTYuMjg5VjI2Ny4xWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==" alt="Elitium" />
      </div>
    </div>
    <div class="report-body">
      ${statsHtml}
      <table class="data-table">
        <thead><tr>${tableHeader}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div class="report-footer">
      <span class="brand">Elitium ERP</span>
      <span>Gerado em ${dateStr} às ${timeStr}</span>
    </div>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Revoke after a delay to allow the new window to load
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ==========================================
// HELPERS
// ==========================================

function computeStats(rows: ReportRow[], reportId: string) {
  if (rows.length === 0) return null;

  const stats: { label: string; value: string; icon: React.ReactNode }[] = [];

  stats.push({
    label: 'Total de Registros',
    value: rows.length.toLocaleString('pt-BR'),
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
  });

  const valueFields: Record<string, string> = {
    sales: 'totalPrice',
    inventory: 'totalValue',
    finance: 'amount',
    quotes: 'totalPrice',
    forecast: 'currentStock',
  };
  const valueField = valueFields[reportId];

  // Finance: show sales and expenses separately
  if (reportId === 'finance') {
    const totalSales = rows.filter(r => r.type === 'Venda').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const totalExpenses = rows.filter(r => r.type !== 'Venda').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    stats.push({
      label: 'Total Vendas',
      value: `R$ ${totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    });
    stats.push({
      label: 'Total Despesas',
      value: `R$ ${totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
        </svg>
      ),
    });
    stats.push({
      label: 'Lucro',
      value: `R$ ${(totalSales - totalExpenses).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    });
  } else if (valueField) {
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

  if (reportId === 'sales') {
    const uniqueVendors = new Set(rows.map((r) => String(r.createdByName || '')).filter(Boolean));
    const completedCount = rows.filter(r => r.status === 'Concluído').length;
    stats.push({
      label: 'Vendedores',
      value: uniqueVendors.size.toLocaleString('pt-BR'),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    });
    stats.push({
      label: 'Concluídos',
      value: completedCount.toLocaleString('pt-BR'),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    });
  }

  if (reportId === 'quotes') {
    const uniqueClients = new Set(rows.map((r) => String(r.clientName || '')).filter(Boolean));
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

  if (reportId === 'faturamento') {
    const totalRevenue = rows.reduce((acc, r) => acc + (Number(r.totalRevenue) || 0), 0);
    const totalProfit = rows.reduce((acc, r) => acc + (Number(r.totalProfit) || 0), 0);
    const totalSales = rows.reduce((acc, r) => acc + (Number(r.totalSales) || 0), 0);
    const totalQuantity = rows.reduce((acc, r) => acc + (Number(r.totalQuantity) || 0), 0);
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    stats.push({
      label: 'Receita Total',
      value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    });
    stats.push({
      label: 'Lucro Total',
      value: `R$ ${totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    });
    stats.push({
      label: 'Vendas Totais',
      value: `${totalSales} pedidos · ${totalQuantity.toLocaleString('pt-BR')} itens`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      ),
    });
    stats.push({
      label: 'Margem Média',
      value: `${avgMargin.toFixed(1)}%`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
      ),
    });
  }

  return stats;
}

const PAGE_SIZE = 50;

// ==========================================
// COMPACT REPORT CARD
// ==========================================

function CompactReportCard({
  report,
  isActive,
  isLoading,
  rows,
  onClick,
  onExport,
}: {
  report: ReportConfig;
  isActive: boolean;
  isLoading: boolean;
  rows: ReportRow[] | undefined;
  onClick: () => void;
  onExport: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-150 cursor-pointer ${
        isActive ? 'shadow-sm' : 'hover:shadow-sm'
      }`}
      style={{
        background: isActive ? 'var(--brand-muted)' : 'var(--card-bg)',
        border: `1.5px solid ${isActive ? 'var(--brand)' : 'var(--card-border)'}`,
      }}
      onClick={onClick}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors"
        style={{
          background: isActive ? 'var(--brand)' : 'var(--surface-muted)',
          color: isActive ? '#fff' : 'var(--text-muted)',
        }}
      >
        {report.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{report.title}</p>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{report.description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
        ) : rows ? (
          <>
            <span className="text-xs tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {rows.length.toLocaleString('pt-BR')}
            </span>
            <button
              type="button"
              onClick={onExport}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:opacity-80"
              style={{ background: 'var(--brand)', color: '#fff' }}
              title="Gerar relatório"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
          </>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-faint)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ==========================================
// PAGE
// ==========================================

export default function ReportsPage() {
  const currentUser = getCurrentUser();
  const isSeller = currentUser?.role === 'seller';
  const availableReports = isSeller ? REPORTS.filter(r => r.id === 'sales' || r.id === 'quotes') : REPORTS;

  const [loading, setLoading] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, ReportRow[]>>({});
  const [rawData, setRawData] = useState<Record<string, ReportRow[]>>({});
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Tab state: 'select' or 'data'
  const [activeTab, setActiveTab] = useState<'select' | 'data'>('select');

  // Date range filter
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Search, sort, pagination
  const [searchText, setSearchText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortPreset, setSortPreset] = useState<string>('');
  const [visibleRows, setVisibleRows] = useState(PAGE_SIZE);

  const dateFieldMap: Record<string, string> = {
    faturamento: '',
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
      setFromDate('');
      setToDate('');
      setSearchText('');
      setSortCol(null);
      setSortDir('asc');
      setSortPreset('');
      setVisibleRows(PAGE_SIZE);
      setActiveTab('data');
    } catch {
      setError(`Falha ao carregar dados de ${report.title}.`);
    } finally {
      setLoading(null);
    }
  }

  // Date filter
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
      fetchReport(report);
      return;
    }
    const reportStats = computeStats(rows, report.id);
    const simpleStats = reportStats ? reportStats.map(s => ({ label: s.label, value: s.value })) : null;
    exportStyledReport(report, rows, simpleStats);
  }

  // Search filtering
  // Determine if search should be scoped to a specific column (from preset)
  const activePresetCol = useMemo(() => {
    if (!sortPreset || !selectedReport) return null;
    const presets = SORT_PRESETS[selectedReport] || [];
    const preset = presets.find((p) => p.key === sortPreset);
    return preset?.col ?? null;
  }, [sortPreset, selectedReport]);

  const searchFilteredData = useMemo(() => {
    if (!searchText.trim()) return previewData;
    const query = searchText.toLowerCase().trim();

    // When a sort preset is active, scope search to that column only
    if (activePresetCol) {
      return previewData.filter((row) => {
        const val = row[activePresetCol];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      });
    }

    // Default: search across all fields
    return previewData.filter((row) =>
      Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      })
    );
  }, [previewData, searchText, activePresetCol]);

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

  const paginatedData = useMemo(() => sortedData.slice(0, visibleRows), [sortedData, visibleRows]);

  function handleSort(colKey: string) {
    let newDir: 'asc' | 'desc';
    if (sortCol === colKey) {
      newDir = sortDir === 'asc' ? 'desc' : 'asc';
      setSortDir(newDir);
    } else {
      newDir = 'asc';
      setSortCol(colKey);
      setSortDir('asc');
    }
    // Sync dropdown: find a preset matching this column + direction
    if (selectedReport) {
      const presets = SORT_PRESETS[selectedReport] || [];
      const match = presets.find((p) => p.col === colKey && p.dir === newDir);
      setSortPreset(match?.key ?? '');
    }
  }

  function handlePresetChange(presetKey: string) {
    setSortPreset(presetKey);
    setSearchText(''); // reset search when switching preset scope
    setVisibleRows(PAGE_SIZE);
    if (!presetKey || !selectedReport) {
      setSortCol(null);
      setSortDir('asc');
      return;
    }
    const presets = SORT_PRESETS[selectedReport] || [];
    const preset = presets.find((p) => p.key === presetKey);
    if (preset) {
      setSortCol(preset.col);
      setSortDir(preset.dir);
    }
  }

  const activeReport = REPORTS.find((r) => r.id === selectedReport);
  const hasDateFilter = selectedReport && dateFieldMap[selectedReport];
  const stats = activeReport ? computeStats(previewData, activeReport.id) : null;

  const activePresetColLabel = useMemo(() => {
    if (!activePresetCol || !activeReport) return null;
    const col = activeReport.columns.find((c) => c.key === activePresetCol);
    return col?.label ?? null;
  }, [activePresetCol, activeReport]);

  return (
    <ProtectedPage allowedRoles={['admin', 'seller']}>
      <div>
        <PageHeader
          title="Relatórios"
          description={isSeller ? "Seus relatórios de vendas e orçamentos." : "Gere relatórios estilizados para impressão ou exporte dados em CSV para análise externa."}
        />

        {/* Tabs */}
        <div
          className="mb-6 inline-flex gap-1 rounded-xl p-1"
          style={{ background: 'var(--surface-muted)' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('select')}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: activeTab === 'select' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'select' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'select' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Relatórios
          </button>
          <button
            type="button"
            onClick={() => { if (selectedReport) setActiveTab('data'); }}
            disabled={!selectedReport}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-40"
            style={{
              background: activeTab === 'data' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'data' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'data' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {activeReport ? `Dados — ${activeReport.title}` : 'Dados'}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="mb-6 rounded-xl p-4 text-sm"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}
          >
            {error}
          </div>
        )}

        {/* ==================== TAB: SELECT ==================== */}
        {activeTab === 'select' && (
          <div>
            {/* Empty state */}
            {!selectedReport && (
              <div
                className="mb-6 flex items-center gap-3 rounded-xl p-4"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'var(--card-bg)', color: 'var(--text-faint)' }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Selecione um relatório</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Clique em um dos relatórios abaixo para carregar os dados. Depois você poderá filtrar, ordenar e exportar.
                  </p>
                </div>
              </div>
            )}

            {/* Report list */}
            <div className="space-y-2">
              {availableReports.map((report) => (
                <CompactReportCard
                  key={report.id}
                  report={report}
                  isActive={selectedReport === report.id}
                  isLoading={loading === report.id}
                  rows={data[report.id]}
                  onClick={() => fetchReport(report)}
                  onExport={(e) => { e.stopPropagation(); handleExport(report); }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ==================== TAB: DATA ==================== */}
        {activeTab === 'data' && activeReport && (
          <div>
            {/* Summary stats */}
            {stats && stats.length > 0 && (
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 rounded-xl p-3"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                  >
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
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

            {/* Filters + Search bar — single row */}
            <div
              className="mb-4 rounded-xl p-4"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="flex flex-wrap items-end gap-3">
                {/* Date filters (if applicable) */}
                {hasDateFilter && (
                  <>
                    <div className="min-w-[140px]">
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Data inicial
                      </label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full rounded-lg px-3 py-1.5 text-sm"
                        style={{
                          background: 'var(--input-bg)',
                          border: '1px solid var(--input-border)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <div className="min-w-[140px]">
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Data final
                      </label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full rounded-lg px-3 py-1.5 text-sm"
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
                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{
                          background: 'var(--surface-muted)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        Limpar
                      </button>
                    )}
                    <div className="mx-1 h-8 w-px" style={{ background: 'var(--border)' }} />
                  </>
                )}

                {/* Sort presets */}
                {selectedReport && SORT_PRESETS[selectedReport] && (
                  <>
                    <div className="min-w-[180px]">
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Ordenar por
                      </label>
                      <select
                        value={sortPreset}
                        onChange={(e) => handlePresetChange(e.target.value)}
                        className="w-full rounded-lg px-3 py-1.5 text-sm"
                        style={{
                          background: 'var(--input-bg)',
                          border: `1px solid ${sortPreset ? 'var(--brand)' : 'var(--input-border)'}`,
                          color: sortPreset ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        <option value="">Padrão</option>
                        {SORT_PRESETS[selectedReport].map((p) => (
                          <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    {sortPreset && (
                      <button
                        type="button"
                        onClick={() => handlePresetChange('')}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{
                          background: 'var(--surface-muted)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        Limpar
                      </button>
                    )}
                    <div className="mx-1 h-8 w-px" style={{ background: 'var(--border)' }} />
                  </>
                )}

                {/* Search */}
                <div className="relative min-w-[200px] flex-1">
                  <svg
                    className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    style={{ color: 'var(--text-faint)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder={activePresetColLabel ? `Buscar em ${activePresetColLabel}…` : "Buscar nos dados…"}
                    value={searchText}
                    onChange={(e) => { setSearchText(e.target.value); setVisibleRows(PAGE_SIZE); }}
                    className="w-full rounded-lg py-1.5 pl-8 pr-3 text-sm"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Export buttons */}
                <button
                  type="button"
                  onClick={() => {
                    const reportStats = computeStats(sortedData, activeReport.id);
                    const simpleStats = reportStats ? reportStats.map(s => ({ label: s.label, value: s.value })) : null;
                    exportStyledReport(activeReport, sortedData, simpleStats);
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: 'var(--brand)', color: '#fff' }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Gerar Relatório
                </button>
                <button
                  type="button"
                  onClick={() => exportCSV(activeReport, sortedData)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  title="Exportar como CSV"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  CSV
                </button>
              </div>

              {/* Result count */}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  {sortedData.length} registro{sortedData.length !== 1 ? 's' : ''}
                  {searchText && ` (filtrado de ${previewData.length})`}
                  {(fromDate || toDate) && ' · Filtrado por período'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('select')}
                  className="text-xs font-medium transition-colors hover:underline"
                  style={{ color: 'var(--brand)' }}
                >
                  ← Trocar relatório
                </button>
              </div>
            </div>

            {/* Data table */}
            {previewData.length > 0 ? (
              <div
                className="rounded-xl"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        {activeReport.columns.map((col) => (
                          <th
                            key={col.key}
                            className="group/th cursor-pointer select-none px-4 pb-3 pt-4 text-xs font-semibold uppercase tracking-wider transition-colors hover:opacity-80"
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
                                <td key={col.key} className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>
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

                {/* Load more */}
                {visibleRows < sortedData.length && (
                  <div className="flex justify-center border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setVisibleRows((v) => v + PAGE_SIZE)}
                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all hover:opacity-80"
                      style={{
                        background: 'var(--surface-muted)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Carregar mais ({Math.min(PAGE_SIZE, sortedData.length - visibleRows)} de {sortedData.length - visibleRows} restantes)
                    </button>
                  </div>
                )}

                {/* Footer info */}
                <div className="flex items-center justify-between border-t px-4 py-2" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                    Exibindo {paginatedData.length} de {sortedData.length}
                  </p>
                  {activeReport && previewData.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const reportStats = computeStats(sortedData, activeReport.id);
                        const simpleStats = reportStats ? reportStats.map(s => ({ label: s.label, value: s.value })) : null;
                        exportStyledReport(activeReport, sortedData, simpleStats);
                      }}
                      className="text-xs font-medium transition-colors hover:underline"
                      style={{ color: 'var(--brand)' }}
                    >
                      Gerar relatório completo ({sortedData.length} registros)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* No data state */
              <div
                className="flex flex-col items-center justify-center rounded-xl p-12 text-center"
                style={{ background: 'var(--card-bg)', border: '2px dashed var(--border)' }}
              >
                <div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
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
                    ? 'Tente ajustar o período do filtro ou limpe os filtros.'
                    : `O relatório de ${activeReport.title} não retornou dados no momento.`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
