// app/demand-forecast/page.tsx
// Página de Previsão de Demanda do ERP
// Exibe análise completa de demanda, tendências, alertas e recomendações de estoque
// Usa dados reais do sistema — sem APIs externas, sem machine learning externo
// Acesso restrito: apenas usuários com role 'admin'

import { getDemandForecastSummary, getWeeklySalesData } from '../lib/demand-forecast';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';

// ==========================================
// COMPONENTES INTERNOS DA PÁGINA
// ==========================================

/** Card de métrica compacto para o topo da página */
function StatCard({ title, value, note, color }: { title: string; value: string | number; note?: string; color?: string }) {
  const colorClass = color === 'red' ? 'border-red-200 bg-red-50' :
    color === 'yellow' ? 'border-amber-200 bg-amber-50' :
    color === 'green' ? 'border-emerald-200 bg-emerald-50' :
    'border-slate-200 bg-white';

  return (
    <div className={`rounded-3xl border p-6 shadow-sm ${colorClass}`}>
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      {note ? <p className="mt-2 text-sm text-slate-500">{note}</p> : null}
    </div>
  );
}

/** Badge de risco colorido */
function RiskBadge({ level }: { level: 'alto' | 'médio' | 'baixo' | 'sem_risco' }) {
  const styles = {
    alto: 'bg-red-100 text-red-800 border-red-200',
    médio: 'bg-amber-100 text-amber-800 border-amber-200',
    baixo: 'bg-blue-100 text-blue-800 border-blue-200',
    sem_risco: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };

  return (
    <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${styles[level]}`}>
      {level === 'alto' ? '🔴 Alto' : level === 'médio' ? '🟡 Médio' : level === 'baixo' ? '🔵 Baixo' : '🟢 Sem risco'}
    </span>
  );
}

/** Seta de tendência */
function TrendIndicator({ trend, percent }: { trend: 'crescente' | 'estável' | 'decrescente'; percent: number }) {
  if (trend === 'crescente') {
    return <span className="text-emerald-600 font-semibold">📈 +{percent}%</span>;
  }
  if (trend === 'decrescente') {
    return <span className="text-red-600 font-semibold">📉 -{percent}%</span>;
  }
  return <span className="text-slate-500 font-semibold">→ Estável</span>;
}

/** Tabela de previsão de variáveis */
function ForecastTable({ title, forecasts, emptyMessage }: {
  title: string;
  forecasts: Array<{
    variableId: string;
    variableName: string;
    groupName: string;
    productName: string;
    currentStock: number;
    avgWeeklyDemand: number;
    forecastNextWeek: number;
    forecastNextMonth: number;
    trend: 'crescente' | 'estável' | 'decrescente';
    trendPercent: number;
    suggestedReplenishment: number;
    daysOfStock: number;
    riskLevel: 'alto' | 'médio' | 'baixo' | 'sem_risco';
    riskLabel: string;
    alerts: string[];
  }>;
  emptyMessage: string;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      {forecasts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 font-semibold text-slate-600">Variável</th>
                <th className="pb-3 font-semibold text-slate-600">Produto</th>
                <th className="pb-3 font-semibold text-slate-600">Grupo</th>
                <th className="pb-3 text-right font-semibold text-slate-600">Estoque</th>
                <th className="pb-3 text-right font-semibold text-slate-600">Média Sem.</th>
                <th className="pb-3 text-right font-semibold text-slate-600">Previsão Sem.</th>
                <th className="pb-3 text-right font-semibold text-slate-600">Previsão Mês</th>
                <th className="pb-3 text-center font-semibold text-slate-600">Tendência</th>
                <th className="pb-3 text-right font-semibold text-slate-600">Dias Estoque</th>
                <th className="pb-3 text-center font-semibold text-slate-600">Risco</th>
                <th className="pb-3 text-right font-semibold text-slate-600">Sugestão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {forecasts.map((f) => (
                <tr key={f.variableId} className="hover:bg-slate-50 transition">
                  <td className="py-3 font-medium text-slate-900">{f.variableName}</td>
                  <td className="py-3 text-slate-600">{f.productName}</td>
                  <td className="py-3 text-slate-500">{f.groupName}</td>
                  <td className="py-3 text-right font-mono text-slate-700">{f.currentStock}</td>
                  <td className="py-3 text-right font-mono text-slate-700">{f.avgWeeklyDemand}</td>
                  <td className="py-3 text-right font-mono font-semibold text-slate-900">{f.forecastNextWeek}</td>
                  <td className="py-3 text-right font-mono font-semibold text-slate-900">{f.forecastNextMonth}</td>
                  <td className="py-3 text-center">
                    <TrendIndicator trend={f.trend} percent={f.trendPercent} />
                  </td>
                  <td className="py-3 text-right font-mono">
                    <span className={f.daysOfStock <= 7 ? 'text-red-600 font-semibold' : f.daysOfStock <= 14 ? 'text-amber-600' : 'text-slate-700'}>
                      {f.daysOfStock >= 999 ? '∞' : `${f.daysOfStock}d`}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <RiskBadge level={f.riskLevel} />
                  </td>
                  <td className="py-3 text-right">
                    {f.suggestedReplenishment > 0 ? (
                      <span className="font-semibold text-blue-700">+{f.suggestedReplenishment}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Seção de alertas ativos */
function AlertsSection({ forecasts }: { forecasts: Array<{ variableName: string; alerts: string[] }> }) {
  const allAlerts = forecasts.flatMap(f =>
    f.alerts.map(alert => ({ variable: f.variableName, message: alert }))
  );

  if (allAlerts.length === 0) return null;

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-amber-900">🔔 Alertas Ativos</h3>
      <div className="mt-4 space-y-2">
        {allAlerts.map((alert, i) => (
          <div key={i} className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm">
            <span className="font-semibold text-amber-800">{alert.variable}:</span>{' '}
            <span className="text-amber-700">{alert.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Mini gráfico de barras CSS puro (sem bibliotecas externas) */
function MiniBarChart({ labels, values, title }: { labels: string[]; values: number[]; title: string }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 flex items-end gap-1" style={{ height: '120px' }}>
        {values.map((val, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
            <span className="mb-1 text-[10px] font-mono text-slate-500">{val}</span>
            <div
              className="w-full rounded-t-lg bg-blue-500 transition-all hover:bg-blue-600"
              style={{ height: `${Math.max(2, (val / max) * 100)}%`, minHeight: '4px' }}
              title={`${labels[i]}: ${val}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        {labels.map((label, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-slate-400 truncate" title={label}>
            {label.replace(/^\d{4}-/, '')}
          </div>
        ))}
      </div>
    </section>
  );
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function DemandForecastPage() {
  const summary = getDemandForecastSummary();
  const weeklyData = getWeeklySalesData();

  // Todas as variáveis com previsão para a tabela completa
  const allForecasts = [
    ...summary.highDemand,
    ...summary.lowDemand,
    ...summary.criticalRisk,
    ...summary.watchRisk,
    ...summary.overstocked,
  ];
  // Remove duplicatas
  const uniqueForecasts = allForecasts.filter((f, i, arr) =>
    arr.findIndex(x => x.variableId === f.variableId) === i
  );

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader
          title="Previsão de Demanda"
          description="Análise local baseada em dados reais do sistema. Sem APIs externas, sem machine learning — lógica pura sobre seus pedidos."
        />

        {/* CONFIABILIDADE DA PREVISÃO */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          <span className="font-semibold">Confiabilidade da análise:</span> {summary.forecastAccuracy}
          <span className="ml-2 text-slate-400">• Gerado em {new Date(summary.generatedAt).toLocaleString('pt-BR')}</span>
        </div>

        {/* MÉTRICAS RESUMO */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Variáveis analisadas"
            value={summary.totalVariablesAnalyzed}
            note="Todas as variações de produto"
          />
          <StatCard
            title="Risco alto"
            value={summary.criticalRisk.length}
            note="Precisam de reposição urgente"
            color={summary.criticalRisk.length > 0 ? 'red' : undefined}
          />
          <StatCard
            title="Em atenção"
            value={summary.watchRisk.length}
            note="Estoque em nível de alerta"
            color={summary.watchRisk.length > 0 ? 'yellow' : undefined}
          />
          <StatCard
            title="Excesso"
            value={summary.overstocked.length}
            note="Estoque acima da demanda"
            color={summary.overstocked.length > 0 ? 'green' : undefined}
          />
        </div>

        {/* GRÁFICO DE VENDAS SEMANAIS */}
        <div className="mt-6">
          <MiniBarChart
            labels={weeklyData.labels}
            values={weeklyData.quantities}
            title="📊 Vendas Semanais (quantidade por período)"
          />
        </div>

        {/* ALERTAS ATIVOS */}
        <div className="mt-6">
          <AlertsSection forecasts={uniqueForecasts} />
        </div>

        {/* TABELA: ALTA DEMANDA */}
        <div className="mt-6">
          <ForecastTable
            title="🔥 Produtos com Alta Demanda"
            forecasts={summary.highDemand}
            emptyMessage="Nenhum produto com demanda alta identificado ainda. Registre mais pedidos para gerar análises."
          />
        </div>

        {/* TABELA: RISCO CRÍTICO */}
        <div className="mt-6">
          <ForecastTable
            title="🚨 Risco de Falta — Reposição Urgente"
            forecasts={summary.criticalRisk}
            emptyMessage="Nenhum item em estado crítico. ✅"
          />
        </div>

        {/* TABELA: EM ATENÇÃO */}
        <div className="mt-6">
          <ForecastTable
            title="⚠️ Em Atenção — Ficar de Olho"
            forecasts={summary.watchRisk}
            emptyMessage="Nenhum item em nível de atenção. ✅"
          />
        </div>

        {/* TABELA: BAIXA DEMANDA */}
        <div className="mt-6">
          <ForecastTable
            title="📉 Produtos com Baixa Saída"
            forecasts={summary.lowDemand}
            emptyMessage="Todos os produtos têm demanda razoável."
          />
        </div>

        {/* TABELA: EXCESSO DE ESTOQUE */}
        <div className="mt-6">
          <ForecastTable
            title="📦 Excesso de Estoque"
            forecasts={summary.overstocked}
            emptyMessage="Nenhum excesso de estoque identificado. ✅"
          />
        </div>

        {/* NOTA METODOLÓGICA */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          <h3 className="font-semibold text-slate-800">📐 Como funciona a previsão</h3>
          <ul className="mt-3 space-y-2 list-disc list-inside">
            <li><strong>Dados reais:</strong> A análise usa apenas pedidos registrados no sistema com status &quot;completed&quot;</li>
            <li><strong>Média semanal:</strong> Pedidos são agrupados por semana ISO e calculada a média de vendas por período</li>
            <li><strong>Tendência:</strong> Regressão linear simples sobre os dados semanais — identifica se demanda sobe ou desce</li>
            <li><strong>Previsão:</strong> Média semanal ajustada pelo multiplicador de tendência (±%)</li>
            <li><strong>Risco:</strong> Calculado por dias de estoque restante vs demanda diária estimada</li>
            <li><strong>Reposição:</strong> Sugerida para cobrir ~4 semanas de demanda, descontando estoque atual</li>
            <li><strong>Sem ML externo:</strong> Toda a lógica é implementada localmente em TypeScript puro</li>
          </ul>
        </section>
      </div>
    </ProtectedPage>
  );
}
