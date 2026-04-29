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
  recentOrders: Order[]       // Últimos 5 pedidos por data
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
