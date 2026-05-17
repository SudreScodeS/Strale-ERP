'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';
import { ProductAIPanel } from '../components/product-ai-panel';
import type { ProductAIReport } from '../lib/product-ai';

interface DemandForecast {
  variableId: string;
  variableName: string;
  groupName: string;
  productName: string;
  currentStock: number;
  unitOfMeasure?: string;
  avgWeeklyDemand: number;
  forecastNextWeek: number;
  forecastNextMonth: number;
  trend: 'crescente' | 'estavel' | 'decrescente';
  trendPercent: number;
  suggestedReplenishment: number;
  daysOfStock: number;
  riskLevel: 'alto' | 'medio' | 'baixo' | 'sem_risco';
  riskLabel: string;
  alerts: string[];
}

interface ForecastSummary {
  totalVariablesAnalyzed: number;
  highDemand: DemandForecast[];
  lowDemand: DemandForecast[];
  criticalRisk: DemandForecast[];
  watchRisk: DemandForecast[];
  overstocked: DemandForecast[];
  forecastAccuracy: string;
  generatedAt: string;
}

interface WeeklyData {
  labels: string[];
  quantities: number[];
  revenues: number[];
}

const PAGE_PATH = '/demand-forecast';

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'metrics', visible: true, order: 0, colSpan: 2 },
  { id: 'product-ai', visible: true, order: 1, colSpan: 2 },
  { id: 'chart', visible: true, order: 2, colSpan: 2 },
  { id: 'alerts', visible: true, order: 3, colSpan: 2 },
  { id: 'tables', visible: true, order: 4, colSpan: 2 },
];

// ==========================================
// COMPONENTS
// ==========================================

function StatCard({ title, value, note, color }: { title: string; value: string | number; note?: string; color?: string }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: color === 'red' ? 'var(--danger-bg)' : color === 'yellow' ? 'var(--warning-bg)' : color === 'green' ? 'var(--success-bg)' : 'var(--card-bg)',
        border: `1px solid ${color === 'red' ? 'var(--danger-border)' : color === 'yellow' ? 'var(--warning-border)' : color === 'green' ? 'var(--success-border)' : 'var(--card-border)'}`,
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</p>
      <p className="mt-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {note && <p className="mt-1 text-xs" style={{ color: 'var(--text-faint)' }}>{note}</p>}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    alto: { bg: 'var(--danger-bg)', color: 'var(--danger)', label: 'Alto' },
    medio: { bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'Medio' },
    baixo: { bg: 'var(--info-bg)', color: 'var(--info)', label: 'Baixo' },
    sem_risco: { bg: 'var(--success-bg)', color: 'var(--success)', label: 'OK' },
  };
  const s = styles[level] || styles.sem_risco;
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function TrendBadge({ trend, percent }: { trend: string; percent: number }) {
  if (trend === 'crescente') return <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>+{percent}%</span>;
  if (trend === 'decrescente') return <span className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>-{percent}%</span>;
  return <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Estavel</span>;
}

function MiniBarChart({ labels, values, title }: { labels: string[]; values: number[]; title: string }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <div className="mt-3 flex items-end gap-1" style={{ height: '80px' }}>
        {values.map((val, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${Math.max(4, (val / max) * 100)}%`,
                background: 'var(--brand)',
                opacity: 0.8,
                minHeight: '3px',
              }}
              title={`${labels[i]}: ${val}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {labels.map((label, i) => (
          <div key={i} className="flex-1 text-center text-[9px] truncate" style={{ color: 'var(--text-faint)' }}>
            {label.replace(/^\d{4}-/, '')}
          </div>
        ))}
      </div>
    </div>
  );
}

function ForecastTable({ title, forecasts, color }: { title: string; forecasts: DemandForecast[]; color?: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: `1px solid ${color === 'red' ? 'var(--danger-border)' : color === 'yellow' ? 'var(--warning-border)' : 'var(--card-border)'}` }}>
      <div className="mb-3 flex items-center gap-2">
        {color === 'red' && <span className="h-2 w-2 rounded-full" style={{ background: 'var(--danger)' }} />}
        {color === 'yellow' && <span className="h-2 w-2 rounded-full" style={{ background: 'var(--warning)' }} />}
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-faint)' }}>{forecasts.length} item{forecasts.length !== 1 ? 's' : ''}</span>
      </div>
      {forecasts.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Nenhum item nesta categoria.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="pb-2 font-semibold" style={{ color: 'var(--text-muted)' }}>Variavel</th>
                <th className="pb-2 font-semibold" style={{ color: 'var(--text-muted)' }}>Produto</th>
                <th className="pb-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Estoque</th>
                <th className="pb-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Demanda/sem</th>
                <th className="pb-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Previsao</th>
                <th className="pb-2 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>Tendencia</th>
                <th className="pb-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Dias rest.</th>
                <th className="pb-2 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>Risco</th>
                <th className="pb-2 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Repor</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f) => (
                <tr key={f.variableId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{f.variableName}</td>
                  <td className="py-2.5" style={{ color: 'var(--text-muted)' }}>{f.productName}</td>
                  <td className="py-2.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{f.currentStock} {f.unitOfMeasure === 'cento' ? 'ct.' : f.unitOfMeasure === 'milhar' ? 'ml.' : 'un.'}</td>
                  <td className="py-2.5 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{f.avgWeeklyDemand}</td>
                  <td className="py-2.5 text-right font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{f.forecastNextWeek}</td>
                  <td className="py-2.5 text-center"><TrendBadge trend={f.trend} percent={f.trendPercent} /></td>
                  <td className="py-2.5 text-right font-mono">
                    <span style={{ color: f.daysOfStock <= 7 ? 'var(--danger)' : f.daysOfStock <= 14 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                      {f.daysOfStock >= 999 ? '—' : `${f.daysOfStock}d`}
                    </span>
                  </td>
                  <td className="py-2.5 text-center"><RiskBadge level={f.riskLevel} /></td>
                  <td className="py-2.5 text-right">
                    {f.suggestedReplenishment > 0 ? (
                      <span className="font-semibold" style={{ color: 'var(--brand)' }}>+{f.suggestedReplenishment}</span>
                    ) : (
                      <span style={{ color: 'var(--text-faint)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================
// PAGE
// ==========================================

type TabId = 'resumo' | 'tabelas' | 'ia';

export default function DemandForecastPage() {
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [productAIReport, setProductAIReport] = useState<ProductAIReport | null>(null);
  const [productAIError, setProductAIError] = useState<string | null>(null);
  const [productAILoading, setProductAILoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('resumo');

  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  useEffect(() => {
    fetch('/api/demand-forecast', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => setSummary(d.summary))
      .catch(() => {});
    fetch('/api/demand-forecast?mode=weekly', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => setWeeklyData(d.weeklyData))
      .catch(() => {});
    fetch('/api/product-ai', { headers: getAuthHeaders() })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.error || 'Falha ao carregar IA de Produtos.');
        }
        return r.json();
      })
      .then((d) => {
        setProductAIReport(d.report);
        setProductAIError(null);
      })
      .catch((error) => {
        setProductAIError(error instanceof Error ? error.message : 'Falha ao carregar IA de Produtos.');
      })
      .finally(() => setProductAILoading(false));
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

  const allForecasts = [...summary.highDemand, ...summary.lowDemand, ...summary.criticalRisk, ...summary.watchRisk, ...summary.overstocked];
  const uniqueForecasts = allForecasts.filter((f, i, arr) => arr.findIndex((x) => x.variableId === f.variableId) === i);
  const allAlerts = uniqueForecasts.flatMap((f) => f.alerts.map((a) => ({ variable: f.variableName, message: a })));

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'tabelas', label: 'Tabelas', badge: uniqueForecasts.length },
    { id: 'ia', label: 'IA de Produtos' },
  ];

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Previsao de Demanda" description="Analise baseada em dados reais de pedidos e estoque." />
        <LayoutToolbar pagePath={PAGE_PATH} />

        {/* Tabs */}
        <div
          className="mb-6 inline-flex gap-1 rounded-xl p-1"
          style={{ background: 'var(--surface-muted)' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="relative rounded-lg px-4 py-2 text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id ? 'var(--card-bg)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
                  style={{
                    background: activeTab === tab.id ? 'var(--brand-muted)' : 'var(--surface-muted)',
                    color: activeTab === tab.id ? 'var(--brand)' : 'var(--text-faint)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ==================== TAB: RESUMO ==================== */}
        {activeTab === 'resumo' && (
          <div className="space-y-6">
            {/* Distribution bar — visual health overview */}
            <section
              className="rounded-xl p-5"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>Saude do estoque</p>
                  <h3 className="mt-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {summary.totalVariablesAnalyzed} variaveis analisadas
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Confiabilidade</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>{summary.forecastAccuracy}</p>
                </div>
              </div>

              {/* Distribution bar */}
              {uniqueForecasts.length > 0 && (
                <div>
                  <div className="mb-2 flex h-3 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}>
                    {summary.criticalRisk.length > 0 && (
                      <div
                        className="transition-all"
                        style={{
                          width: `${(summary.criticalRisk.length / uniqueForecasts.length) * 100}%`,
                          background: 'var(--danger)',
                          minWidth: '4px',
                        }}
                        title={`Risco alto: ${summary.criticalRisk.length}`}
                      />
                    )}
                    {summary.watchRisk.length > 0 && (
                      <div
                        className="transition-all"
                        style={{
                          width: `${(summary.watchRisk.length / uniqueForecasts.length) * 100}%`,
                          background: 'var(--warning)',
                          minWidth: '4px',
                        }}
                        title={`Atencao: ${summary.watchRisk.length}`}
                      />
                    )}
                    {summary.highDemand.length > 0 && (
                      <div
                        className="transition-all"
                        style={{
                          width: `${(summary.highDemand.length / uniqueForecasts.length) * 100}%`,
                          background: 'var(--success)',
                          minWidth: '4px',
                        }}
                        title={`Alta demanda: ${summary.highDemand.length}`}
                      />
                    )}
                    {summary.lowDemand.length > 0 && (
                      <div
                        className="transition-all"
                        style={{
                          width: `${(summary.lowDemand.length / uniqueForecasts.length) * 100}%`,
                          background: 'var(--text-faint)',
                          minWidth: '4px',
                        }}
                        title={`Baixa saida: ${summary.lowDemand.length}`}
                      />
                    )}
                    {summary.overstocked.length > 0 && (
                      <div
                        className="transition-all"
                        style={{
                          width: `${(summary.overstocked.length / uniqueForecasts.length) * 100}%`,
                          background: 'var(--info)',
                          minWidth: '4px',
                        }}
                        title={`Excesso: ${summary.overstocked.length}`}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {summary.criticalRisk.length > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--danger)' }} />
                        Risco alto ({summary.criticalRisk.length})
                      </span>
                    )}
                    {summary.watchRisk.length > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--warning)' }} />
                        Atencao ({summary.watchRisk.length})
                      </span>
                    )}
                    {summary.highDemand.length > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--success)' }} />
                        Alta demanda ({summary.highDemand.length})
                      </span>
                    )}
                    {summary.lowDemand.length > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--text-faint)' }} />
                        Baixa saida ({summary.lowDemand.length})
                      </span>
                    )}
                    {summary.overstocked.length > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--info)' }} />
                        Excesso ({summary.overstocked.length})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Stat cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Risco alto" value={summary.criticalRisk.length} note="reposicao urgente" color={summary.criticalRisk.length > 0 ? 'red' : undefined} />
              <StatCard title="Atencao" value={summary.watchRisk.length} note="estoque baixo" color={summary.watchRisk.length > 0 ? 'yellow' : undefined} />
              <StatCard title="Alta demanda" value={summary.highDemand.length} note="tendencia crescente" color="green" />
              <StatCard title="Excesso" value={summary.overstocked.length} note="acima da demanda" color={summary.overstocked.length > 0 ? 'green' : undefined} />
            </div>

            {/* Two-column: Critical items + Trend */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Top critical items */}
              {summary.criticalRisk.length > 0 && (
                <section
                  className="rounded-xl p-5"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--danger-border)' }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: 'var(--danger)' }} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--danger)' }}>Acao urgente</p>
                  </div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Itens com risco de falta</h3>
                  <div className="mt-3 space-y-2">
                    {summary.criticalRisk.slice(0, 5).map((f) => (
                      <div
                        key={f.variableId}
                        className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{ background: 'var(--danger-bg)' }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{f.variableName}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{f.productName}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <div className="text-right">
                            <p className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{f.currentStock} {f.unitOfMeasure === 'cento' ? 'ct.' : f.unitOfMeasure === 'milhar' ? 'ml.' : 'un.'}</p>
                            <p className="text-[10px]" style={{ color: f.daysOfStock >= 999 ? 'var(--text-faint)' : 'var(--danger)' }}>
                              {f.daysOfStock >= 999 ? 'sem estoque' : `${f.daysOfStock}d restantes`}
                            </p>
                          </div>
                          {f.suggestedReplenishment > 0 && (
                            <span
                              className="rounded-md px-2 py-0.5 text-[10px] font-bold"
                              style={{ background: 'var(--brand)', color: '#fff' }}
                            >
                              +{f.suggestedReplenishment}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {summary.criticalRisk.length > 5 && (
                      <p className="text-xs text-center" style={{ color: 'var(--text-faint)' }}>
                        + {summary.criticalRisk.length - 5} outros itens
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* Trend breakdown */}
              <section
                className="rounded-xl p-5"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>Tendencias</p>
                <h3 className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Direcao da demanda</h3>

                {(() => {
                  const ascending = uniqueForecasts.filter((f) => f.trend === 'crescente');
                  const stable = uniqueForecasts.filter((f) => f.trend === 'estavel');
                  const descending = uniqueForecasts.filter((f) => f.trend === 'decrescente');
                  const total = uniqueForecasts.length || 1;

                  return (
                    <div className="mt-4 space-y-3">
                      {/* Ascending */}
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--success)' }}>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                            </svg>
                            Crescente
                          </span>
                          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{ascending.length} ({Math.round((ascending.length / total) * 100)}%)</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(ascending.length / total) * 100}%`, background: 'var(--success)' }} />
                        </div>
                      </div>

                      {/* Stable */}
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5" />
                            </svg>
                            Estavel
                          </span>
                          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{stable.length} ({Math.round((stable.length / total) * 100)}%)</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(stable.length / total) * 100}%`, background: 'var(--text-faint)' }} />
                        </div>
                      </div>

                      {/* Descending */}
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--danger)' }}>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
                            </svg>
                            Decrescente
                          </span>
                          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{descending.length} ({Math.round((descending.length / total) * 100)}%)</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(descending.length / total) * 100}%`, background: 'var(--danger)' }} />
                        </div>
                      </div>

                      {/* Top ascending items */}
                      {ascending.length > 0 && (
                        <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Maiores altas</p>
                          <div className="space-y-1">
                            {ascending
                              .sort((a, b) => b.trendPercent - a.trendPercent)
                              .slice(0, 3)
                              .map((f) => (
                                <div key={f.variableId} className="flex items-center justify-between text-xs">
                                  <span className="truncate" style={{ color: 'var(--text-primary)' }}>{f.variableName}</span>
                                  <span className="font-mono font-semibold ml-2" style={{ color: 'var(--success)' }}>+{f.trendPercent}%</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </section>
            </div>

            {/* Chart */}
            {weeklyData && weeklyData.quantities.length > 0 && (
              <section
                className="rounded-xl p-5"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>Previsao operacional</p>
                  <h3 className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Comportamento de vendas</h3>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Leitura agregada para validar tendencia.</p>
                </div>
                <MiniBarChart labels={weeklyData.labels} values={weeklyData.quantities} title="Vendas semanais (quantidade)" />
              </section>
            )}

            {/* Alerts */}
            {allAlerts.length > 0 && (
              <section
                className="rounded-xl p-5"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--warning-border)' }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--warning)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>Alertas ({allAlerts.length})</h3>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {allAlerts.slice(0, 6).map((alert, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg px-3 py-2"
                      style={{ background: 'var(--warning-bg)' }}
                    >
                      <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: 'var(--warning)' }} />
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-semibold">{alert.variable}:</span> {alert.message}
                      </p>
                    </div>
                  ))}
                </div>
                {allAlerts.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('tabelas')}
                    className="mt-3 text-xs font-medium transition-colors hover:underline"
                    style={{ color: 'var(--brand)' }}
                  >
                    Ver todos os {allAlerts.length} alertas nas tabelas →
                  </button>
                )}
              </section>
            )}
          </div>
        )}

        {/* ==================== TAB: TABELAS ==================== */}
        {activeTab === 'tabelas' && (
          <div className="space-y-4">
            {/* Inline metrics summary for context */}
            <div className="flex flex-wrap gap-2">
              {summary.criticalRisk.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--danger)' }} />
                  {summary.criticalRisk.length} risco alto
                </span>
              )}
              {summary.watchRisk.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-border)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--warning)' }} />
                  {summary.watchRisk.length} em atencao
                </span>
              )}
              {summary.highDemand.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                  {summary.highDemand.length} alta demanda
                </span>
              )}
              {summary.overstocked.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--info-bg)', color: 'var(--info)', border: '1px solid var(--info-border)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--info)' }} />
                  {summary.overstocked.length} excesso
                </span>
              )}
              {summary.lowDemand.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {summary.lowDemand.length} baixa saida
                </span>
              )}
            </div>

            {/* Tables — collapsible sections */}
            <ForecastTable title="Risco de falta — reposicao urgente" forecasts={summary.criticalRisk} color="red" />
            <ForecastTable title="Em atencao" forecasts={summary.watchRisk} color="yellow" />
            <ForecastTable title="Alta demanda" forecasts={summary.highDemand} />
            <ForecastTable title="Baixa saida" forecasts={summary.lowDemand} />
            <ForecastTable title="Excesso de estoque" forecasts={summary.overstocked} />
          </div>
        )}

        {/* ==================== TAB: IA ==================== */}
        {activeTab === 'ia' && (
          <div>
            <DraggableSection
              key="product-ai-0"
              pagePath={PAGE_PATH}
              section={sections.find((s) => s.id === 'product-ai') || { id: 'product-ai', visible: true, order: 0, colSpan: 2 }}
              index={0}
              totalSections={1}
              className="sm:col-span-2"
            >
              <ProductAIPanel report={productAIReport} loading={productAILoading} error={productAIError} />
            </DraggableSection>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
