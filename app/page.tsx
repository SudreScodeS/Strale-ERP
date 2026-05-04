// app/page.tsx
// Página principal do Dashboard Administrativo
// Exibe visão geral completa do sistema ERP
// Acesso restrito: apenas usuários com role 'admin'
// Funcionalidade: Métricas principais + últimos pedidos

import { getDashboardSummary } from './lib/dashboard';
import { MetricCard, PageHeader } from './components/ui';
import { ProtectedPage } from './components/protected';

// ==========================================
// COMPONENTE DA PÁGINA PRINCIPAL
// ==========================================

// DASHBOARD ADMINISTRATIVO PRINCIPAL
// Página inicial após login de admin
// Mostra KPIs principais e atividade recente
export default function Home() {
  // Busca dados consolidados do dashboard
  // Inclui contadores, totais financeiros, alertas de estoque
  const summary = getDashboardSummary();

  return (
    // PROTEÇÃO DE ACESSO: Apenas admins podem ver esta página
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        {/* CABEÇALHO DA PÁGINA */}
        <PageHeader
          title="Dashboard"
          description="Visão geral dos módulos de estoque, vendas, finanças e notas fiscais."
        />

        {/* PRIMEIRA LINHA: MÉTRICAS DE ESTOQUE E VENDAS */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* CONTADOR DE PRODUTOS BASE */}
          <MetricCard
            title="Produtos"
            value={`${summary.productsCount}`}
            note="Produtos base cadastrados"
          />

          {/* CONTADOR DE VARIAÇÕES DE PRODUTO */}
          <MetricCard
            title="Variações"
            value={`${summary.variablesCount}`}
            note="Itens de configuração dinâmica"
          />

          {/* CONTADOR TOTAL DE PEDIDOS */}
          <MetricCard
            title="Pedidos"
            value={`${summary.ordersCount}`}
            note="Pedidos finalizados até agora"
          />
        </div>

        {/* SEGUNDA LINHA: MÉTRICAS FINANCEIRAS E ALERTAS */}
        <div className="mt-6 grid gap-6 lg:grid-cols-4">
          {/* TOTAL DE VENDAS ACUMULADO */}
          <MetricCard
            title="Total vendido"
            value={`R$ ${summary.totalSales.toFixed(2)}`}
            note="Registro financeiro automático"
          />

          {/* LUCRO CALCULADO (VENDAS - DESPESAS) */}
          <MetricCard
            title="Lucro"
            value={`R$ ${summary.profit.toFixed(2)}`}
            note="Vendas menos despesas"
          />

          {/* CONTADOR DE ITENS EM ESTADO DE ATENÇÃO */}
          <MetricCard
            title="Estoque em atenção"
            value={`${summary.watchStockCount}`}
            note="Itens abaixo do limite de observação"
          />

          {/* CONTADOR DE ITENS COM ESTOQUE CRÍTICO */}
          <MetricCard
            title="Estoque crítico"
            value={`${summary.lowStockCount}`}
            note="Itens abaixo do limite crítico"
          />
        </div>

        {/* TERCEIRA LINHA: ALERTAS DE PREVISÃO DE DEMANDA */}
        {summary.demandForecast.criticalRiskCount > 0 || summary.demandForecast.watchRiskCount > 0 ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <MetricCard
              title="Previsão — Risco alto"
              value={`${summary.demandForecast.criticalRiskCount}`}
              note="Itens que podem faltar em breve"
            />
            <MetricCard
              title="Previsão — Atenção"
              value={`${summary.demandForecast.watchRiskCount}`}
              note="Itens em nível de alerta de demanda"
            />
            <MetricCard
              title="Previsão — Excesso"
              value={`${summary.demandForecast.overstockedCount}`}
              note="Estoque acima da demanda estimada"
            />
          </div>
        ) : null}

        {/* ALERTAS RESUMIDOS DE PREVISÃO */}
        {summary.demandForecast.topAlerts.length > 0 ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-amber-900">🔔 Alertas de Previsão de Demanda</h3>
            <div className="mt-3 space-y-2">
              {summary.demandForecast.topAlerts.map((alert, i) => (
                <div key={i} className="rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm">
                  <span className="font-semibold text-amber-800">{alert.variable}:</span>{' '}
                  <span className="text-amber-700">{alert.message}</span>
                </div>
              ))}
            </div>
            <a
              href="/demand-forecast"
              className="mt-3 inline-block text-sm font-semibold text-amber-700 hover:text-amber-900 transition"
            >
              Ver análise completa →
            </a>
          </section>
        ) : null}

        {/* DETECÇÃO DE FRAUDE — RESUMO */}
        {summary.fraudDetection.flaggedTotal > 0 || summary.fraudDetection.pendingReviewCount > 0 ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <MetricCard
              title="Fraude — Sinalizados"
              value={`${summary.fraudDetection.flaggedTotal}`}
              note="Pedidos suspeitos ou bloqueados"
            />
            <MetricCard
              title="Fraude — Pendentes"
              value={`${summary.fraudDetection.pendingReviewCount}`}
              note="Aguardando revisão do admin"
            />
            <MetricCard
              title="Fraude — Score médio"
              value={`${summary.fraudDetection.avgRiskScore}`}
              note="Risco médio de todos os pedidos"
            />
          </div>
        ) : null}

        {summary.fraudDetection.pendingReviewCount > 0 ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-red-900">🛡️ Alertas de Fraude</h3>
            <p className="mt-1 text-sm text-red-700">
              {summary.fraudDetection.pendingReviewCount} pedido(s) sinalizado(s) aguardando revisão.
            </p>
            <a
              href="/fraud"
              className="mt-3 inline-block text-sm font-semibold text-red-700 hover:text-red-900 transition"
            >
              Ver detalhes e revisar →
            </a>
          </section>
        ) : null}

        {/* SEÇÃO DE ÚLTIMOS PEDIDOS */}
        <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Últimos pedidos</h3>

          <div className="mt-4 space-y-4 text-slate-700">
            {/* VERIFICA SE HÁ PEDIDOS PARA EXIBIR */}
            {summary.recentOrders.length === 0 ? (
              // MENSAGEM QUANDO NÃO HÁ PEDIDOS
              <p className="text-sm text-slate-500">Nenhum pedido registrado ainda.</p>
            ) : (
              // LISTA OS ÚLTIMOS PEDIDOS
              summary.recentOrders.map((order) => (
                <div key={order.id} className="rounded-3xl border border-slate-200 p-4">
                  {/* ID DO PEDIDO */}
                  <p className="font-semibold text-slate-900">{order.name || `Pedido ${order.id}`}</p>
                  <p className="text-sm text-slate-500">ID: {order.id}</p>
                  <p className="text-sm text-slate-500">Criado por: {order.createdByName}</p>

                  {/* VALOR TOTAL DO PEDIDO */}
                  <p className="text-sm text-slate-500">Total: R$ {order.totalPrice.toFixed(2)}</p>

                  {/* STATUS ATUAL DO PEDIDO */}
                  <p className="text-sm text-slate-500">Status: {order.status}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </ProtectedPage>
  );
}

// ==========================================
// ESTRUTURA DOS DADOS EXIBIDOS
// ==========================================

/*
summary (retornado por getDashboardSummary):
{
  productsCount: number,      // Total de produtos base
  variablesCount: number,     // Total de variações de produto
  ordersCount: number,        // Total de pedidos finalizados
  totalSales: number,         // Soma de todas as vendas
  profit: number,             // Lucro total (vendas - despesas)
  lowStockCount: number,      // Número de itens com estoque crítico
  watchStockCount: number,    // Número de itens em atenção
  recentOrders: Order[],      // Últimos 5 pedidos por data
  demandForecast: {           // Previsão de demanda
    criticalRiskCount: number,    // Itens com risco alto de falta
    watchRiskCount: number,       // Itens em atenção
    overstockedCount: number,     // Itens com excesso de estoque
    highDemandCount: number,      // Itens com alta demanda
    topAlerts: Alert[],           // Alertas mais importantes
    forecastAccuracy: string,     // Confiabilidade da análise
  },
  fraudDetection: {           // Detecção de fraude
    totalAnalyzed: number,        // Total de pedidos analisados
    flaggedTotal: number,         // Pedidos sinalizados
    suspicious24h: number,        // Sinalizados nas últimas 24h
    avgRiskScore: number,         // Score médio de risco
    pendingReviewCount: number,   // Pendentes de revisão
  }
}
*/

// ==========================================
// FUNCIONALIDADES DO DASHBOARD
// ==========================================

// MÉTRICAS PRINCIPAIS:
// - Visão geral do negócio em tempo real
// - Alertas visuais para situações críticas (estoque baixo)
// - Tendências de vendas e lucros

// INTERAÇÕES POSSÍVEIS:
// - Clicar nos cards para ir para páginas detalhadas
// - Expandir seção de últimos pedidos
// - Filtros por período (futuro)

// MELHORIAS FUTURAS:
// 1. Gráficos de tendência (vendas por mês)
// 2. Alertas mais detalhados (produtos específicos em falta)
// 3. Links diretos para ações (reposição de estoque)
// 4. Notificações em tempo real
// 5. Export de relatório do dashboard
