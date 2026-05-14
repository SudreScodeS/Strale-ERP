// lib/product-ai.ts
// Motor local de IA de Produtos. Nao usa API externa nem modelo remoto.
// As recomendacoes sao heuristicas sobre dados locais do ERP.

import { globalConfig } from '../../config/global';
import { Group, Order, Product, Quote, Variable } from '../../types';
import { groupData, orderData, priceHistoryData, productData, quoteData, variableData } from './data';
import { forecastVariable, type DemandForecast } from './demand-forecast';

export type ProductAIPriority = 'critical' | 'attention' | 'opportunity';

export interface ProductAIMetric {
  label: string;
  value: string;
  tone?: ProductAIPriority | 'neutral';
}

export interface ProductAINextAction {
  label: string;
  href?: string;
}

export interface ProductAIInsight {
  id: string;
  priority: ProductAIPriority;
  category: 'stock' | 'demand' | 'margin' | 'commercial';
  title: string;
  subject: string;
  productName: string;
  groupName: string;
  variableName: string;
  recommendation: string;
  nextAction: ProductAINextAction;
  evidence: string[];
  metrics: ProductAIMetric[];
}

export interface ProductAIPriorityCard {
  priority: ProductAIPriority;
  title: string;
  count: number;
  headline: string;
  description: string;
}

export interface ProductAIReport {
  generatedAt: string;
  executiveSummary: string;
  analysisScope: {
    products: number;
    variables: number;
    completedOrders: number;
    quotes: number;
    orphanReferences: number;
  };
  priorityCards: ProductAIPriorityCard[];
  insights: ProductAIInsight[];
  dataQualityNotes: string[];
}

interface VariableStats {
  variable: Variable;
  group?: Group;
  product?: Product;
  forecast: DemandForecast;
  soldQuantity: number;
  orderIds: Set<string>;
  lastSoldAt?: Date;
  activeQuoteQuantity: number;
  rejectedQuoteQuantity: number;
  convertedQuoteQuantity: number;
  quoteIds: Set<string>;
  revenue: number;
  grossProfit: number;
}

const DEFAULT_WATCH_LIMIT = 30;
const DEFAULT_CRITICAL_LIMIT = 10;

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function daysSince(date: Date | undefined): number | null {
  if (!date) return null;
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getVariableQuantity(
  selected: { variableId: string; quantity: number },
  itemQuantity: number,
): number {
  return Math.max(0, selected.quantity || itemQuantity || 0);
}

function getMarginPercent(stats: VariableStats): number | null {
  if (stats.revenue <= 0) return null;
  return (stats.grossProfit / stats.revenue) * 100;
}

function getStockLimits(group: Group | undefined) {
  return {
    watchLimit: group?.watchStockAlert ?? DEFAULT_WATCH_LIMIT,
    criticalLimit: group?.criticalStockAlert ?? DEFAULT_CRITICAL_LIMIT,
  };
}

function buildSubject(stats: VariableStats): string {
  return `${stats.group?.name || 'Variavel'}: ${stats.variable.name}`;
}

function createInsight(
  stats: VariableStats,
  id: string,
  priority: ProductAIPriority,
  category: ProductAIInsight['category'],
  title: string,
  recommendation: string,
  nextAction: ProductAINextAction,
  evidence: string[],
  metrics: ProductAIMetric[],
): ProductAIInsight {
  return {
    id,
    priority,
    category,
    title,
    subject: buildSubject(stats),
    productName: stats.product?.name || 'Produto sem vinculo',
    groupName: stats.group?.name || 'Sem grupo',
    variableName: stats.variable.name,
    recommendation,
    nextAction,
    evidence,
    metrics,
  };
}

function collectOrphanReferences(
  orders: Order[],
  quotes: Quote[],
  currentVariableIds: Set<string>,
): number {
  const orphanIds = new Set<string>();

  for (const order of orders) {
    for (const item of order.items) {
      for (const selected of item.selectedVariables) {
        if (!currentVariableIds.has(selected.variableId)) {
          orphanIds.add(selected.variableId);
        }
      }
    }
  }

  for (const quote of quotes) {
    for (const item of quote.items) {
      for (const selected of item.selectedVariables) {
        if (!currentVariableIds.has(selected.variableId)) {
          orphanIds.add(selected.variableId);
        }
      }
    }
  }

  return orphanIds.size;
}

function buildVariableStats(
  products: Product[],
  groups: Group[],
  variables: Variable[],
  orders: Order[],
  quotes: Quote[],
): VariableStats[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const statsByVariable = new Map<string, VariableStats>();

  for (const variable of variables) {
    const group = groupById.get(variable.groupId);
    const product = group ? productById.get(group.productId) : undefined;
    statsByVariable.set(variable.id, {
      variable,
      group,
      product,
      forecast: forecastVariable(variable, group, product, orders),
      soldQuantity: 0,
      orderIds: new Set<string>(),
      activeQuoteQuantity: 0,
      rejectedQuoteQuantity: 0,
      convertedQuoteQuantity: 0,
      quoteIds: new Set<string>(),
      revenue: 0,
      grossProfit: 0,
    });
  }

  for (const order of orders) {
    const createdAt = new Date(order.createdAt);
    for (const item of order.items) {
      const unitProfit = item.unitPrice - item.unitCost;
      for (const selected of item.selectedVariables) {
        const stats = statsByVariable.get(selected.variableId);
        if (!stats) continue;

        const quantity = getVariableQuantity(selected, item.quantity);
        stats.soldQuantity += quantity;
        stats.orderIds.add(order.id);
        stats.revenue += item.unitPrice * quantity;
        stats.grossProfit += unitProfit * quantity;

        if (!stats.lastSoldAt || createdAt > stats.lastSoldAt) {
          stats.lastSoldAt = createdAt;
        }
      }
    }
  }

  for (const quote of quotes) {
    for (const item of quote.items) {
      for (const selected of item.selectedVariables) {
        const stats = statsByVariable.get(selected.variableId);
        if (!stats) continue;

        const quantity = getVariableQuantity(selected, item.quantity);
        stats.quoteIds.add(quote.id);

        if (quote.status === 'draft' || quote.status === 'sent' || quote.status === 'approved') {
          stats.activeQuoteQuantity += quantity;
        }
        if (quote.status === 'rejected') {
          stats.rejectedQuoteQuantity += quantity;
        }
        if (quote.status === 'converted') {
          stats.convertedQuoteQuantity += quantity;
        }
      }
    }
  }

  return Array.from(statsByVariable.values());
}

function buildInsights(statsList: VariableStats[]): ProductAIInsight[] {
  const insights: ProductAIInsight[] = [];
  const targetMargin = globalConfig.profitMargin;

  for (const stats of statsList) {
    const { watchLimit, criticalLimit } = getStockLimits(stats.group);
    const marginPercent = getMarginPercent(stats);
    const lastSaleDays = daysSince(stats.lastSoldAt);
    const stock = stats.variable.stock;
    const forecast = stats.forecast;
    const subject = buildSubject(stats);

    if (stock <= criticalLimit) {
      insights.push(createInsight(
        stats,
        `critical-stock-${stats.variable.id}`,
        'critical',
        'stock',
        `Risco de ruptura em ${subject}`,
        forecast.suggestedReplenishment > 0
          ? `Comprar pelo menos ${forecast.suggestedReplenishment} unidades para cobrir a demanda projetada.`
          : 'Revisar estoque e disponibilidade antes de aceitar novos pedidos desta variacao.',
        { label: 'Abrir compras', href: '/purchases' },
        [
          `Estoque atual: ${stock} un.`,
          `Limite critico do grupo: ${criticalLimit} un.`,
          `Demanda media semanal: ${formatNumber(forecast.avgWeeklyDemand)} un.`,
        ],
        [
          { label: 'Estoque', value: `${stock} un.`, tone: 'critical' },
          { label: 'Repor', value: `${forecast.suggestedReplenishment} un.`, tone: forecast.suggestedReplenishment > 0 ? 'critical' : 'neutral' },
          { label: 'Pedidos', value: String(stats.orderIds.size), tone: 'neutral' },
        ],
      ));
    } else if (forecast.riskLevel !== 'baixo' && forecast.riskLevel !== 'sem_risco') {
      insights.push(createInsight(
        stats,
        `attention-risk-${stats.variable.id}`,
        'attention',
        'demand',
        `Estoque em observacao para ${subject}`,
        'Acompanhar na previsao e programar reposicao se houver novo pedido aberto.',
        { label: 'Ver previsao', href: '/demand-forecast' },
        [
          `Dias estimados de estoque: ${forecast.daysOfStock >= 999 ? 'sem consumo recente' : `${forecast.daysOfStock} dias`}.`,
          `Previsao para a proxima semana: ${forecast.forecastNextWeek} un.`,
          `Estoque atual: ${stock} un.`,
        ],
        [
          { label: 'Risco', value: forecast.riskLabel, tone: 'attention' },
          { label: 'Demanda/sem', value: `${formatNumber(forecast.avgWeeklyDemand)} un.`, tone: 'neutral' },
        ],
      ));
    }

    if (marginPercent !== null && marginPercent < targetMargin && stats.soldQuantity > 0) {
      insights.push(createInsight(
        stats,
        `attention-margin-${stats.variable.id}`,
        'attention',
        'margin',
        `Margem abaixo da meta em ${subject}`,
        'Revisar custo, preco aplicado ou desconto antes de repetir a mesma condicao comercial.',
        { label: 'Revisar orcamentos', href: '/quotes' },
        [
          `Margem media historica: ${formatPercent(marginPercent)}.`,
          `Meta configurada: ${formatPercent(targetMargin)}.`,
          `Receita atribuida aos pedidos: ${formatMoney(stats.revenue)}.`,
        ],
        [
          { label: 'Margem', value: formatPercent(marginPercent), tone: 'attention' },
          { label: 'Lucro bruto', value: formatMoney(stats.grossProfit), tone: 'neutral' },
        ],
      ));
    }

    if (stats.soldQuantity === 0 && stock > watchLimit) {
      insights.push(createInsight(
        stats,
        `attention-no-sales-${stats.variable.id}`,
        'attention',
        'demand',
        `Sem saida registrada em ${subject}`,
        'Validar se esta variacao deve aparecer nos orcamentos ou se o estoque precisa de acao comercial.',
        { label: 'Abrir orcamentos', href: '/quotes' },
        [
          `Estoque atual: ${stock} un.`,
          'Nao ha pedidos concluidos com esta variacao atual.',
          `Limite de atencao do grupo: ${watchLimit} un.`,
        ],
        [
          { label: 'Estoque', value: `${stock} un.`, tone: 'attention' },
          { label: 'Pedidos', value: '0', tone: 'attention' },
        ],
      ));
    }

    if (forecast.avgWeeklyDemand > 0 && stock > forecast.avgWeeklyDemand * 8 && forecast.trend !== 'crescente') {
      insights.push(createInsight(
        stats,
        `opportunity-overstock-${stats.variable.id}`,
        'opportunity',
        'stock',
        `Oportunidade de giro em ${subject}`,
        'Criar uma condicao comercial controlada para reduzir estoque sem comprometer margem.',
        { label: 'Abrir vendas', href: '/sales' },
        [
          `Estoque cobre aproximadamente ${Math.round(stock / forecast.avgWeeklyDemand)} semanas de demanda.`,
          `Tendencia atual: ${forecast.trend}.`,
          `Demanda media semanal: ${formatNumber(forecast.avgWeeklyDemand)} un.`,
        ],
        [
          { label: 'Cobertura', value: `${Math.round(stock / forecast.avgWeeklyDemand)} sem.`, tone: 'opportunity' },
          { label: 'Estoque', value: `${stock} un.`, tone: 'neutral' },
        ],
      ));
    }

    if (stats.activeQuoteQuantity > 0) {
      const hasEnoughStock = stock >= stats.activeQuoteQuantity;
      insights.push(createInsight(
        stats,
        `commercial-quotes-${stats.variable.id}`,
        hasEnoughStock ? 'opportunity' : 'attention',
        'commercial',
        `${hasEnoughStock ? 'Follow-up comercial' : 'Orcamento acima do estoque'} em ${subject}`,
        hasEnoughStock
          ? 'Priorizar follow-up dos orcamentos abertos enquanto o estoque ainda suporta a demanda.'
          : 'Antes de aprovar novos orcamentos, alinhar reposicao ou ajustar prazo de entrega.',
        { label: 'Abrir orcamentos', href: '/quotes' },
        [
          `Quantidade em orcamentos ativos: ${stats.activeQuoteQuantity} un.`,
          `Estoque atual: ${stock} un.`,
          `Orcamentos relacionados: ${stats.quoteIds.size}.`,
        ],
        [
          { label: 'Em orcamento', value: `${stats.activeQuoteQuantity} un.`, tone: hasEnoughStock ? 'opportunity' : 'attention' },
          { label: 'Estoque', value: `${stock} un.`, tone: hasEnoughStock ? 'neutral' : 'attention' },
        ],
      ));
    }

    if (marginPercent !== null && marginPercent >= targetMargin + 10 && stats.soldQuantity > 0) {
      insights.push(createInsight(
        stats,
        `opportunity-margin-${stats.variable.id}`,
        'opportunity',
        'margin',
        `Boa margem em ${subject}`,
        'Usar esta variacao como referencia de preco em novos orcamentos e pedidos similares.',
        { label: 'Abrir pedidos', href: '/sales' },
        [
          `Margem media historica: ${formatPercent(marginPercent)}.`,
          `Quantidade vendida: ${stats.soldQuantity} un.`,
          `Lucro bruto atribuido: ${formatMoney(stats.grossProfit)}.`,
        ],
        [
          { label: 'Margem', value: formatPercent(marginPercent), tone: 'opportunity' },
          { label: 'Vendido', value: `${stats.soldQuantity} un.`, tone: 'neutral' },
        ],
      ));
    }

    if (lastSaleDays !== null && lastSaleDays >= 30 && stock > watchLimit) {
      insights.push(createInsight(
        stats,
        `attention-stale-${stats.variable.id}`,
        'attention',
        'demand',
        `Baixa atividade recente em ${subject}`,
        'Revisar exposicao comercial e evitar nova compra desta variacao ate confirmar demanda.',
        { label: 'Ver estoque', href: '/inventory' },
        [
          `Ultima venda ha ${lastSaleDays} dias.`,
          `Estoque atual: ${stock} un.`,
          `Quantidade historica vendida: ${stats.soldQuantity} un.`,
        ],
        [
          { label: 'Ultima venda', value: `${lastSaleDays} dias`, tone: 'attention' },
          { label: 'Estoque', value: `${stock} un.`, tone: 'neutral' },
        ],
      ));
    }
  }

  const priorityRank: Record<ProductAIPriority, number> = {
    critical: 0,
    attention: 1,
    opportunity: 2,
  };

  return insights.sort((a, b) => {
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.title.localeCompare(b.title, 'pt-BR');
  });
}

function buildPriorityCards(insights: ProductAIInsight[]): ProductAIPriorityCard[] {
  const count = (priority: ProductAIPriority) => insights.filter((item) => item.priority === priority).length;
  const first = (priority: ProductAIPriority) => insights.find((item) => item.priority === priority);

  return [
    {
      priority: 'critical',
      title: 'Criticos',
      count: count('critical'),
      headline: first('critical')?.subject || 'Sem ruptura imediata',
      description: first('critical')?.recommendation || 'Nenhuma variacao atual ficou abaixo do limite critico.',
    },
    {
      priority: 'attention',
      title: 'Atencao',
      count: count('attention'),
      headline: first('attention')?.subject || 'Base sem alerta relevante',
      description: first('attention')?.recommendation || 'Nao ha margem, estoque ou demanda exigindo revisao agora.',
    },
    {
      priority: 'opportunity',
      title: 'Oportunidades',
      count: count('opportunity'),
      headline: first('opportunity')?.subject || 'Sem oportunidade forte',
      description: first('opportunity')?.recommendation || 'A IA local nao encontrou acao comercial prioritaria nos dados atuais.',
    },
  ];
}

function buildExecutiveSummary(insights: ProductAIInsight[], variablesCount: number, completedOrders: number): string {
  const critical = insights.filter((item) => item.priority === 'critical').length;
  const attention = insights.filter((item) => item.priority === 'attention').length;
  const opportunity = insights.filter((item) => item.priority === 'opportunity').length;

  if (critical > 0) {
    return `Analise local revisou ${variablesCount} variacoes e encontrou ${critical} risco(s) critico(s), ${attention} ponto(s) de atencao e ${opportunity} oportunidade(s). A prioridade e proteger estoque antes de aceitar novas vendas sensiveis.`;
  }

  if (attention > 0) {
    return `Analise local revisou ${variablesCount} variacoes com ${completedOrders} pedido(s) concluido(s). Nao ha ruptura imediata, mas existem ${attention} ponto(s) que pedem revisao operacional.`;
  }

  return `Analise local revisou ${variablesCount} variacoes com ${completedOrders} pedido(s) concluido(s). O cenario esta estavel e as oportunidades podem ser tratadas como melhoria comercial.`;
}

export function getProductAIReport(): ProductAIReport {
  const products = productData.getAll();
  const groups = groupData.getAll();
  const variables = variableData.getAll();
  const orders = orderData.getAll().filter((order) => order.status === 'completed');
  const quotes = quoteData.getAll();
  const priceHistory = priceHistoryData.getAll();
  const currentVariableIds = new Set(variables.map((variable) => variable.id));

  const stats = buildVariableStats(products, groups, variables, orders, quotes);
  const insights = buildInsights(stats);
  const orphanReferences = collectOrphanReferences(orders, quotes, currentVariableIds);

  const dataQualityNotes: string[] = [];
  if (products.length <= 1) {
    dataQualityNotes.push('Catalogo atual tem um produto base; a IA prioriza leitura por material, cor e variacao.');
  }
  if (orphanReferences > 0) {
    dataQualityNotes.push(`${orphanReferences} variacao(oes) historica(s) aparecem em pedidos/orcamentos, mas nao existem mais no estoque atual.`);
  }
  if (priceHistory.length === 0) {
    dataQualityNotes.push('Historico de precos vazio; margem calculada pelos snapshots de custo e preco em pedidos/orcamentos.');
  }

  return {
    generatedAt: new Date().toISOString(),
    executiveSummary: buildExecutiveSummary(insights, variables.length, orders.length),
    analysisScope: {
      products: products.length,
      variables: variables.length,
      completedOrders: orders.length,
      quotes: quotes.length,
      orphanReferences,
    },
    priorityCards: buildPriorityCards(insights),
    insights,
    dataQualityNotes,
  };
}
