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
                  <td className="py-2.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{f.currentStock}</td>
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

        {/* Confiabilidade bar */}
        <div className="mb-5 rounded-lg px-4 py-2 text-xs" style={{ background: 'var(--surface-muted)', color: 'var(--text-faint)' }}>
          Confiabilidade: {summary.forecastAccuracy} · Gerado em {new Date(summary.generatedAt).toLocaleString('pt-BR')}
        </div>

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
            {/* Metrics */}
            <section
              className="rounded-xl p-5"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>Indicadores</p>
                <h3 className="mt-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Visao geral</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Analisados" value={summary.totalVariablesAnalyzed} note="variaveis" />
                <StatCard title="Risco alto" value={summary.criticalRisk.length} note="reposicao urgente" color={summary.criticalRisk.length > 0 ? 'red' : undefined} />
                <StatCard title="Atencao" value={summary.watchRisk.length} note="estoque baixo" color={summary.watchRisk.length > 0 ? 'yellow' : undefined} />
                <StatCard title="Excesso" value={summary.overstocked.length} note="acima da demanda" color={summary.overstocked.length > 0 ? 'green' : undefined} />
              </div>
            </section>

            {/* Chart */}
            {weeklyData && weeklyData.quantities.length > 0 && (
              <section
                className="rounded-xl p-5"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>Previsao operacional</p>
                  <h3 className="mt-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Comportamento de vendas</h3>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Leitura agregada para validar tendencia antes de entrar nos dados detalhados.</p>
                </div>
                <MiniBarChart labels={weeklyData.labels} values={weeklyData.quantities} title="Vendas semanais (quantidade)" />
              </section>
            )}

            {/* Alerts */}
            {allAlerts.length > 0 && (
              <section
                className="rounded-xl p-5"
                style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}
              >
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>Alertas</p>
                  <h3 className="mt-1 text-sm font-semibold" style={{ color: 'var(--warning)' }}>Sinais que precisam de acompanhamento</h3>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {allAlerts.slice(0, 8).map((alert, i) => (
                    <p key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-semibold">{alert.variable}:</span> {alert.message}
                    </p>
                  ))}
                </div>
                {allAlerts.length > 8 && (
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-faint)' }}>
                    + {allAlerts.length - 8} outros alertas
                  </p>
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
