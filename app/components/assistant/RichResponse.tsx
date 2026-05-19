'use client';

// ── RichResponse.tsx — Renders structured data in chat responses ─
// Automatically detects data type and renders the best visualization.

import { useState } from 'react';

interface RichResponseProps {
  data: unknown;
  compact?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────

function fmtCurrency(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : v;
  if (isNaN(n)) return String(v);
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

function isMoneyValue(v: unknown): boolean {
  if (typeof v === 'number') return v > 0 && v < 1_000_000;
  if (typeof v === 'string') return /R\$|total|price|valor|preco|receita|lucro|despesa/i.test(v);
  return false;
}

function getStatusColor(status: string): { bg: string; text: string; border: string } {
  const s = status.toLowerCase();
  if (['completed', 'concluido', 'concluído', 'approved', 'aprovado', 'delivered', 'entregue'].includes(s))
    return { bg: 'var(--success-bg)', text: 'var(--success)', border: 'var(--success-border)' };
  if (['pending', 'pendente', 'draft', 'rascunho', 'sent', 'enviado'].includes(s))
    return { bg: 'var(--warning-bg)', text: 'var(--warning)', border: 'var(--warning-border)' };
  if (['cancelled', 'cancelado', 'rejected', 'rejeitado'].includes(s))
    return { bg: 'var(--danger-bg)', text: 'var(--danger)', border: 'var(--danger-border)' };
  if (['converted', 'convertido'].includes(s))
    return { bg: 'var(--info-bg)', text: 'var(--info)', border: 'var(--info-border)' };
  return { bg: 'var(--surface-muted)', text: 'var(--text-muted)', border: 'var(--border)' };
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: 'Concluído', pending: 'Pendente', cancelled: 'Cancelado',
    draft: 'Rascunho', sent: 'Enviado', approved: 'Aprovado',
    rejected: 'Rejeitado', converted: 'Convertido', delivered: 'Entregue',
  };
  return map[status.toLowerCase()] || status;
}

// ── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors = getStatusColor(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {getStatusLabel(status)}
    </span>
  );
}

// ── Metric Cards ─────────────────────────────────────────────

function MetricCards({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => typeof v === 'number' || typeof v === 'string');
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map(([key, value]) => {
        const label = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, s => s.toUpperCase())
          .replace(/total|count|sum/i, m => m);
        const displayValue = typeof value === 'number'
          ? (isMoneyValue(value) ? fmtCurrency(value) : value.toLocaleString('pt-BR'))
          : String(value);

        return (
          <div
            key={key}
            className="rounded-lg px-3 py-2"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {label}
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {displayValue}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────

function DataTable({ items, compact }: { items: Record<string, unknown>[]; compact?: boolean }) {
  if (items.length === 0) return null;

  // Collect all keys
  const allKeys = Array.from(new Set(items.flatMap(item => Object.keys(item))));
  // Filter out long text fields and IDs for display
  const displayKeys = allKeys.filter(k =>
    !['id', 'userId', 'productId', 'variableId', 'groupId', 'selectedVariables', 'breakdown'].includes(k)
  );

  // Detect status columns
  const statusCols = displayKeys.filter(k => /status/i.test(k));
  // Detect money columns
  const moneyCols = displayKeys.filter(k => /price|total|valor|receita|lucro|despesa|cost/i.test(k));

  const maxRows = compact ? 5 : 15;
  const shown = items.slice(0, maxRows);

  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: 'var(--surface-muted)' }}>
            {displayKeys.map(key => (
              <th
                key={key}
                className="px-3 py-2 text-left font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
              >
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((item, i) => (
            <tr
              key={i}
              className="transition-colors"
              style={{ borderBottom: i < shown.length - 1 ? '1px solid var(--border)' : 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-muted)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {displayKeys.map(key => {
                const val = item[key];
                const isStatus = statusCols.includes(key);
                const isMoney = moneyCols.includes(key) && typeof val === 'number';

                return (
                  <td key={key} className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                    {isStatus && typeof val === 'string' ? (
                      <StatusBadge status={val} />
                    ) : isMoney ? (
                      <span className="tabular-nums font-medium">{fmtCurrency(val as number)}</span>
                    ) : val === null || val === undefined ? (
                      <span style={{ color: 'var(--text-faint)' }}>—</span>
                    ) : (
                      String(val)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > maxRows && (
        <div className="px-3 py-1.5 text-[10px]" style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          + {items.length - maxRows} mais itens
        </div>
      )}
    </div>
  );
}

// ── Bar Chart (CSS-based) ────────────────────────────────────

function BarChart({ data, labelKey, valueKey }: { data: Record<string, unknown>[]; labelKey: string; valueKey: string }) {
  const maxVal = Math.max(...data.map(d => (typeof d[valueKey] === 'number' ? d[valueKey] as number : 0)), 1);

  return (
    <div className="space-y-1.5">
      {data.map((item, i) => {
        const val = typeof item[valueKey] === 'number' ? item[valueKey] as number : 0;
        const pct = (val / maxVal) * 100;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-24 truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {String(item[labelKey])}
            </span>
            <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: 'var(--brand)' }}
              />
            </div>
            <span className="w-16 text-right text-[11px] font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {typeof val === 'number' ? val.toLocaleString('pt-BR') : val}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress Bar ─────────────────────────────────────────────

function ProgressBar({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct < 20 ? 'var(--danger)' : pct < 50 ? 'var(--warning)' : 'var(--success)';

  return (
    <div>
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
          <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}/{max}</span>
        </div>
      )}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Auto-detect and render ───────────────────────────────────

function detectAndRender(data: unknown, compact?: boolean): React.ReactNode {
  if (!data || typeof data !== 'object') return null;

  // Array of objects → table or chart
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    if (typeof data[0] === 'object' && data[0] !== null) {
      return <DataTable items={data as Record<string, unknown>[]} compact={compact} />;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);

  // Detect nested arrays (orders, quotes, products, etc.)
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      // This is a list of items — render as table
      const items = val as Record<string, unknown>[];
      // Also render summary metrics from sibling keys
      const summaryKeys = keys.filter(k => k !== key && (typeof obj[k] === 'number' || typeof obj[k] === 'string'));
      return (
        <div className="space-y-3">
          {summaryKeys.length > 0 && (
            <MetricCards data={Object.fromEntries(summaryKeys.map(k => [k, obj[k]]))} />
          )}
          <DataTable items={items} compact={compact} />
        </div>
      );
    }
  }

  // Detect metric-only objects (all values are numbers or short strings)
  const allMetrics = keys.every(k => {
    const v = obj[k];
    return typeof v === 'number' || (typeof v === 'string' && v.length < 30);
  });
  if (allMetrics && keys.length >= 2) {
    return <MetricCards data={obj} />;
  }

  // Detect critical/watch stock pattern
  if ('critical' in obj && 'watch' in obj) {
    const critical = obj.critical as Array<Record<string, unknown>> | undefined;
    const watch = obj.watch as Array<Record<string, unknown>> | undefined;
    return (
      <div className="space-y-3">
        {critical && critical.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--danger)' }}>Crítico ({critical.length})</p>
            <DataTable items={critical} compact />
          </div>
        )}
        {watch && watch.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--warning)' }}>Atenção ({watch.length})</p>
            <DataTable items={watch} compact />
          </div>
        )}
      </div>
    );
  }

  // Detect late/today/pending delivery pattern
  if ('late' in obj || 'today' in obj || 'pending' in obj) {
    return (
      <div className="space-y-3">
        {(['late', 'today', 'pending'] as const).map(key => {
          const items = obj[key] as Array<Record<string, unknown>> | undefined;
          if (!items || items.length === 0) return null;
          const labels = { late: 'Atrasados', today: 'Hoje', pending: 'Pendentes' };
          return (
            <div key={key}>
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {labels[key]} ({items.length})
              </p>
              <DataTable items={items} compact />
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: render as metric cards
  return <MetricCards data={obj} />;
}

// ── Main Component ───────────────────────────────────────────

export function RichResponse({ data, compact = true }: RichResponseProps) {
  const [expanded, setExpanded] = useState(false);
  if (!data) return null;

  const rendered = detectAndRender(data, compact && !expanded);
  if (!rendered) return null;

  return (
    <div className="mt-2 rounded-xl p-3" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}>
      {rendered}
      {!compact && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[10px] font-medium"
          style={{ color: 'var(--brand)' }}
        >
          {expanded ? 'Recolher' : 'Expandir'}
        </button>
      )}
    </div>
  );
}

export { StatusBadge, MetricCards, DataTable, BarChart, ProgressBar, fmtCurrency, detectAndRender };
