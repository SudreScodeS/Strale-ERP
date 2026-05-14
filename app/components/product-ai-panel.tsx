'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ProductAIInsight, ProductAIReport, ProductAIPriority } from '../lib/product-ai';

interface ProductAIPanelProps {
  report: ProductAIReport | null;
  loading: boolean;
  error?: string | null;
}

type InsightFilter = 'all' | ProductAIPriority;

const INITIAL_VISIBLE_INSIGHTS = 5;

const priorityConfig: Record<ProductAIPriority, { label: string; bg: string; border: string; color: string }> = {
  critical: {
    label: 'Critica',
    bg: 'var(--danger-bg)',
    border: 'var(--danger-border)',
    color: 'var(--danger)',
  },
  attention: {
    label: 'Atencao',
    bg: 'var(--warning-bg)',
    border: 'var(--warning-border)',
    color: 'var(--warning)',
  },
  opportunity: {
    label: 'Oportunidade',
    bg: 'var(--success-bg)',
    border: 'var(--success-border)',
    color: 'var(--success)',
  },
};

const filterLabels: Record<InsightFilter, string> = {
  all: 'Todos',
  critical: 'Criticos',
  attention: 'Atencao',
  opportunity: 'Oportunidades',
};

const priorityMeaning: Record<ProductAIPriority, string> = {
  critical: 'Risco imediato de impacto em venda, estoque ou operacao.',
  attention: 'Ponto que precisa de revisao antes de repetir a mesma condicao.',
  opportunity: 'Chance de melhorar margem, giro ou decisao comercial.',
};

function getImpactCopy(insight: ProductAIInsight): string {
  if (insight.priority === 'critical') {
    return 'Pode afetar venda, prazo ou disponibilidade se nao for tratado primeiro.';
  }
  if (insight.priority === 'attention') {
    return 'Vale revisar antes de repetir compra, preco ou condicao comercial.';
  }
  if (insight.category === 'margin') {
    return 'Ajuda a proteger rentabilidade em pedidos e orcamentos parecidos.';
  }
  if (insight.category === 'commercial') {
    return 'Indica uma acao comercial que pode destravar venda ou conversao.';
  }
  return 'Pode melhorar giro de estoque ou priorizacao de venda.';
}

function getActionExplanation(insight: ProductAIInsight): string {
  if (insight.nextAction.href === '/purchases') {
    return 'Abra compras para planejar reposicao deste item.';
  }
  if (insight.nextAction.href === '/quotes') {
    return 'Revise orcamentos para entender preco, prazo ou conversao.';
  }
  if (insight.nextAction.href === '/sales') {
    return 'Abra pedidos para usar este insight na proxima venda.';
  }
  if (insight.nextAction.href === '/inventory') {
    return 'Verifique o estoque antes de decidir nova compra ou promocao.';
  }
  if (insight.nextAction.href === '/demand-forecast') {
    return 'Compare com a previsao operacional antes de agir.';
  }
  return insight.nextAction.label;
}

function HowToUseAnalysis() {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Como usar esta analise</p>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {[
          ['1', 'Resolva criticos', 'Proteja estoque e operacao antes de vender mais.'],
          ['2', 'Revise atencao', 'Confirme preco, margem, prazo ou baixa saida.'],
          ['3', 'Aproveite oportunidades', 'Use boas margens e excesso de estoque a favor da venda.'],
        ].map(([step, title, description]) => (
          <div key={step} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold" style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}>
              {step}
            </span>
            <div>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriorityGuide() {
  return (
    <details className="rounded-xl p-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
      <summary className="cursor-pointer text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
        Entenda os niveis de prioridade
      </summary>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {(Object.keys(priorityConfig) as ProductAIPriority[]).map((priority) => {
          const config = priorityConfig[priority];
          return (
            <div key={priority} className="rounded-lg px-3 py-2" style={{ background: config.bg, border: `1px solid ${config.border}` }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: config.color }}>
                {config.label}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {priorityMeaning[priority]}
              </p>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function SkeletonPanel() {
  return (
    <section className="rounded-xl p-5 animate-pulse" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="h-4 w-32 rounded" style={{ background: 'var(--surface-muted)' }} />
          <div className="h-7 w-64 rounded" style={{ background: 'var(--surface-muted)' }} />
          <div className="h-4 w-full max-w-2xl rounded" style={{ background: 'var(--surface-muted)' }} />
        </div>
        <div className="h-9 w-36 rounded-lg" style={{ background: 'var(--surface-muted)' }} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 rounded-xl" style={{ background: 'var(--surface-muted)' }} />
        ))}
      </div>
    </section>
  );
}

function PriorityBadge({ priority }: { priority: ProductAIPriority }) {
  const config = priorityConfig[priority];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      {config.label}
    </span>
  );
}

function ScopeMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  );
}

function InsightCard({ insight }: { insight: ProductAIInsight }) {
  const config = priorityConfig[insight.priority];
  const actionExplanation = getActionExplanation(insight);

  return (
    <article
      className="rounded-xl p-3.5 transition-all hover:-translate-y-0.5"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${config.border}`,
        boxShadow: 'var(--shadow-chrome)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PriorityBadge priority={insight.priority} />
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
            Problema encontrado
          </p>
          <h4 className="mt-2 text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {insight.title}
          </h4>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {insight.productName} - {insight.subject}
          </p>
        </div>
        <span
          className="rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ background: config.bg, color: config.color }}
        >
          {insight.category}
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-muted)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
            Por que importa
          </p>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {getImpactCopy(insight)}
          </p>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-muted)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
            O que fazer agora
          </p>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {insight.recommendation}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {insight.metrics.map((metric) => {
          const metricTone = metric.tone && metric.tone !== 'neutral' ? priorityConfig[metric.tone] : null;
          return (
            <div key={`${insight.id}-${metric.label}`} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-muted)' }}>
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-faint)' }}>{metric.label}</p>
              <p className="mt-0.5 font-mono text-xs font-semibold" style={{ color: metricTone?.color || 'var(--text-primary)' }}>
                {metric.value}
              </p>
            </div>
          );
        })}
      </div>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-[11px] font-medium transition-colors" style={{ color: 'var(--text-muted)' }}>
          Esta recomendacao foi gerada porque...
        </summary>
        <div className="mt-2 space-y-1.5">
          {insight.evidence.map((item) => (
            <p key={`${insight.id}-${item}`} className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {item}
            </p>
          ))}
        </div>
      </details>

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
            Proxima acao
          </span>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {actionExplanation}
          </p>
        </div>
        {insight.nextAction.href ? (
          <Link
            href={insight.nextAction.href}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'var(--brand-muted)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}
          >
            {insight.nextAction.label}
          </Link>
        ) : (
          <span className="text-right text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {insight.nextAction.label}
          </span>
        )}
      </div>
    </article>
  );
}

function InsightList({
  insights,
  total,
}: {
  insights: ProductAIInsight[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      {insights.length > 0 ? (
        insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)
      ) : (
        <div className="rounded-xl p-4 text-xs" style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          Nao ha itens que precisem desse tipo de acao agora.
        </div>
      )}
      {total > 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
          Exibindo {insights.length} de {total} insight(s) desta visao.
        </p>
      ) : null}
    </div>
  );
}

export function ProductAIPanel({ report, loading, error }: ProductAIPanelProps) {
  const [activeFilter, setActiveFilter] = useState<InsightFilter>('all');
  const [showAllInsights, setShowAllInsights] = useState(false);

  if (loading) return <SkeletonPanel />;

  if (error) {
    return (
      <section className="rounded-xl p-5" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>IA de Produtos indisponivel</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{error}</p>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>IA de Produtos</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Sem dados suficientes para gerar recomendacoes.</p>
      </section>
    );
  }

  const filteredInsights = activeFilter === 'all'
    ? report.insights
    : report.insights.filter((insight) => insight.priority === activeFilter);
  const visibleInsights = showAllInsights
    ? filteredInsights
    : filteredInsights.slice(0, INITIAL_VISIBLE_INSIGHTS);

  return (
    <section className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-chrome)' }}>
        <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: 'var(--brand-muted)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}>
                Analise local
              </span>
              <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                Gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              IA de Produtos
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              A IA cruza estoque, pedidos, orcamentos e previsao de demanda para sugerir o que resolver primeiro.
            </p>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {report.executiveSummary}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ScopeMetric label="Produtos" value={report.analysisScope.products} />
              <ScopeMetric label="Variacoes" value={report.analysisScope.variables} />
              <ScopeMetric label="Pedidos" value={report.analysisScope.completedOrders} />
              <ScopeMetric label="Orcamentos" value={report.analysisScope.quotes} />
            </div>
          </div>

          <div className="grid gap-2">
            {report.priorityCards.map((card) => {
              const config = priorityConfig[card.priority];
              return (
                <div
                  key={card.priority}
                  className="rounded-xl px-4 py-3"
                  style={{ background: config.bg, border: `1px solid ${config.border}` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: config.color }}>
                        {card.title}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{card.headline}</p>
                    </div>
                    <p className="font-mono text-xl font-bold leading-none" style={{ color: config.color }}>{card.count}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
        <HowToUseAnalysis />
        <PriorityGuide />
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recomendacoes priorizadas</h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Use os filtros para focar na decisao mais urgente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(filterLabels) as InsightFilter[]).map((filter) => {
              const active = activeFilter === filter;
              const count = filter === 'all'
                ? report.insights.length
                : report.insights.filter((insight) => insight.priority === filter).length;
              const tone = filter === 'all' ? null : priorityConfig[filter];
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    setActiveFilter(filter);
                    setShowAllInsights(false);
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
                  style={{
                    background: active ? (tone?.bg || 'var(--brand-muted)') : 'var(--surface-muted)',
                    color: active ? (tone?.color || 'var(--brand)') : 'var(--text-muted)',
                    border: `1px solid ${active ? (tone?.border || 'var(--brand-border)') : 'var(--border)'}`,
                  }}
                >
                  {filterLabels[filter]} <span className="font-mono">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <InsightList insights={visibleInsights} total={filteredInsights.length} />
        </div>

        {filteredInsights.length > INITIAL_VISIBLE_INSIGHTS ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllInsights((current) => !current)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              {showAllInsights ? 'Mostrar menos' : `Mostrar todos (${filteredInsights.length})`}
            </button>
          </div>
        ) : null}
      </div>

      {report.dataQualityNotes.length > 0 ? (
        <details className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
          <summary className="cursor-pointer text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Notas da analise
          </summary>
          <div className="mt-2 grid gap-1">
            {report.dataQualityNotes.map((note) => (
              <p key={note} className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{note}</p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
