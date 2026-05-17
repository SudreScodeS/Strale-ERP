// lib/demand-forecast.ts
// Sistema de previsão de demanda LOCAL — sem APIs externas, sem ML externo
// Usa apenas dados reais do sistema (pedidos, estoque, produtos) para gerar previsões
// Arquitetura: Funções puras que recebem dados e retornam análises, facilitando testes

import { Order, Product, Group, Variable } from '../../types';
import { productData, groupData, variableData, orderData } from './data';

// ==========================================
// TIPOS DE DADOS DA PREVISÃO
// ==========================================

/** Período de tempo para agrupamento de vendas */
export interface SalesPeriod {
  label: string;        // Rótulo legível (ex: "2026-W18", "2026-04")
  startDate: Date;
  endDate: Date;
  totalQuantity: number; // Quantidade total vendida no período
  totalRevenue: number;  // Receita total do período
  orderCount: number;    // Número de pedidos no período
}

/** Dados de vendas de uma variável específica ao longo do tempo */
export interface VariableSalesHistory {
  variableId: string;
  variableName: string;
  groupName: string;
  productName: string;
  periods: SalesPeriod[];
  totalSold: number;       // Total vendido em todo o histórico
  avgPerPeriod: number;    // Média por período
  trend: 'crescente' | 'estável' | 'decrescente';
  trendPercent: number;    // % de variação da tendência
}

/** Resultado da previsão de demanda para uma variável */
export interface DemandForecast {
  variableId: string;
  variableName: string;
  groupName: string;
  productName: string;
  productId: string;
  currentStock: number;
  unitOfMeasure?: string;          // Unidade de medida da variável
  // Previsão
  avgWeeklyDemand: number;     // Demanda média semanal
  avgMonthlyDemand: number;    // Demanda média mensal
  forecastNextWeek: number;    // Previsão próxima semana
  forecastNextMonth: number;   // Previsão próximo mês
  // Tendência
  trend: 'crescente' | 'estável' | 'decrescente';
  trendPercent: number;
  // Recomendações
  suggestedReplenishment: number;  // Quantidade sugerida de reposição
  daysOfStock: number;             // Dias estimados de estoque restante
  riskLevel: 'alto' | 'médio' | 'baixo' | 'sem_risco';
  riskLabel: string;               // Descrição legível do risco
  // Alertas
  alerts: string[];
}

/** Resumo geral de previsão para o dashboard */
export interface ForecastSummary {
  totalVariablesAnalyzed: number;
  highDemand: DemandForecast[];         // Alta demanda (top sellers)
  lowDemand: DemandForecast[];          // Baixa saída
  criticalRisk: DemandForecast[];       // Risco alto de falta
  watchRisk: DemandForecast[];          // Risco médio — ficar de olho
  overstocked: DemandForecast[];        // Excesso de estoque
  forecastAccuracy: string;             // Descrição da confiabilidade
  generatedAt: string;
}

// ==========================================
// FUNÇÕES AUXILIARES DE CÁLCULO
// ==========================================

/**
 * Agrupa pedidos por semana usando ISO week numbers.
 * Retorna períodos semanais com totais de quantidade e receita.
 */
export function groupOrdersByWeek(orders: Order[]): SalesPeriod[] {
  if (orders.length === 0) return [];

  // Filtra apenas pedidos completados
  const completed = orders.filter(o => o.status === 'completed');
  if (completed.length === 0) return [];

  // Ordena por data
  const sorted = [...completed].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const periodMap = new Map<string, SalesPeriod>();

  for (const order of sorted) {
    const date = new Date(order.createdAt);
    const weekKey = getWeekKey(date);

    if (!periodMap.has(weekKey)) {
      const { start, end } = getWeekRange(date);
      periodMap.set(weekKey, {
        label: weekKey,
        startDate: start,
        endDate: end,
        totalQuantity: 0,
        totalRevenue: 0,
        orderCount: 0,
      });
    }

    const period = periodMap.get(weekKey)!;
    const orderQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
    period.totalQuantity += orderQty;
    period.totalRevenue += order.totalPrice;
    period.orderCount += 1;
  }

  return Array.from(periodMap.values());
}

/**
 * Gera chave da semana no formato YYYY-Wnn
 */
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Calcula o range (início e fim) da semana de uma data
 */
function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajusta para segunda-feira
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Calcula tendência linear simples (regressão linear sobre valores numéricos).
 * Retorna a inclinação (slope) como percentual da média.
 */
export function calculateTrend(values: number[]): { direction: 'crescente' | 'estável' | 'decrescente'; percent: number } {
  if (values.length < 2) return { direction: 'estável', percent: 0 };

  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avg = sumY / n;

  // Converte slope em percentual da média
  const percent = avg === 0 ? 0 : (slope / avg) * 100;

  if (percent > 10) return { direction: 'crescente', percent: Math.round(percent) };
  if (percent < -10) return { direction: 'decrescente', percent: Math.round(Math.abs(percent)) };
  return { direction: 'estável', percent: Math.round(Math.abs(percent)) };
}

/**
 * Média móvel simples de uma janela N.
 * Suaviza flutuações para melhor leitura de tendência.
 */
export function movingAverage(values: number[], window: number): number[] {
  if (values.length === 0) return [];
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

// ==========================================
// MOTOR DE PREVISÃO DE DEMANDA
// ==========================================

/**
 * Extrai a quantidade vendida de uma variável específica a partir dos pedidos.
 * Para cada pedido, verifica se a variável aparece em algum item.
 */
function extractVariableDemand(orders: Order[], targetVariableId: string): number[] {
  // Agrupa por semana e retorna array de quantidades semanais
  const weeklyMap = new Map<string, number>();

  const completed = orders.filter(o => o.status === 'completed');
  const sorted = [...completed].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const order of sorted) {
    const weekKey = getWeekKey(new Date(order.createdAt));
    let qty = 0;

    for (const item of order.items) {
      for (const sv of item.selectedVariables) {
        if (sv.variableId === targetVariableId) {
          // A quantidade da variável pode ser diferente da quantidade do item
          qty += Math.max(sv.quantity, item.quantity);
        }
      }
    }

    if (qty > 0) {
      weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + qty);
    }
  }

  return Array.from(weeklyMap.values());
}

/**
 * Calcula previsão de demanda para uma variável individual.
 * Função central do motor de previsão.
 */
export function forecastVariable(
  variable: Variable,
  group: Group | undefined,
  product: Product | undefined,
  orders: Order[]
): DemandForecast {
  const weeklyDemand = extractVariableDemand(orders, variable.id);
  const totalSold = weeklyDemand.reduce((a, b) => a + b, 0);
  const numWeeks = Math.max(weeklyDemand.length, 1);
  const avgWeekly = totalSold / numWeeks;
  const avgMonthly = avgWeekly * 4.33; // ~4.33 semanas por mês

  // Tendência
  const trendResult = calculateTrend(weeklyDemand);

  // Previsão com ajuste de tendência
  let trendMultiplier = 1;
  if (trendResult.direction === 'crescente') trendMultiplier = 1 + (trendResult.percent / 200);
  if (trendResult.direction === 'decrescente') trendMultiplier = 1 - (trendResult.percent / 200);

  const forecastWeek = Math.max(0, Math.round(avgWeekly * trendMultiplier));
  const forecastMonth = Math.max(0, Math.round(avgMonthly * trendMultiplier));

  // Dias de estoque restante
  const dailyDemand = avgWeekly / 7;
  const daysOfStock = dailyDemand > 0 ? Math.round(variable.stock / dailyDemand) : 999;

  // Nível de risco
  let riskLevel: DemandForecast['riskLevel'] = 'sem_risco';
  let riskLabel = 'Estoque adequado';
  const alerts: string[] = [];

  if (dailyDemand > 0 && daysOfStock <= 3) {
    riskLevel = 'alto';
    riskLabel = `RISCO ALTO — ${daysOfStock} dias de estoque`;
    alerts.push(`Estoque pode acabar em ${daysOfStock} dias com demanda atual`);
  } else if (dailyDemand > 0 && daysOfStock <= 7) {
    riskLevel = 'alto';
    riskLabel = `Risco alto — ${daysOfStock} dias de estoque`;
    alerts.push(`Estoque baixo para ~1 semana de demanda`);
  } else if (dailyDemand > 0 && daysOfStock <= 14) {
    riskLevel = 'médio';
    riskLabel = `Atenção — ${daysOfStock} dias de estoque`;
  } else if (dailyDemand > 0 && daysOfStock <= 30) {
    riskLevel = 'baixo';
    riskLabel = `${daysOfStock} dias de estoque`;
  }

  // Alertas de tendência
  if (trendResult.direction === 'crescente' && trendResult.percent > 20) {
    alerts.push(`Demanda crescente (+${trendResult.percent}%) — considere aumentar estoque`);
  }
  if (trendResult.direction === 'decrescente' && trendResult.percent > 20) {
    alerts.push(`Demanda em queda (-${trendResult.percent}%) — avalie reduzir compras`);
  }

  // Sugestão de reposição: cobrir ~4 semanas de demanda
  const targetWeeks = 4;
  const targetStock = Math.ceil(avgWeekly * targetWeeks * trendMultiplier);
  const suggestedReplenishment = Math.max(0, targetStock - variable.stock);

  // Excesso de estoque: se tem mais de 8 semanas de demanda parada
  if (avgWeekly > 0 && variable.stock > avgWeekly * 8 && trendResult.direction !== 'crescente') {
    alerts.push(`Excesso de estoque — ${Math.round(variable.stock / avgWeekly)} semanas de demanda parada`);
  }

  return {
    variableId: variable.id,
    variableName: variable.name,
    groupName: group?.name || 'Sem grupo',
    productName: product?.name || 'Sem produto',
    productId: product?.id || '',
    currentStock: variable.stock,
    unitOfMeasure: variable.unitOfMeasure || 'un',
    avgWeeklyDemand: Math.round(avgWeekly * 10) / 10,
    avgMonthlyDemand: Math.round(avgMonthly * 10) / 10,
    forecastNextWeek: forecastWeek,
    forecastNextMonth: forecastMonth,
    trend: trendResult.direction,
    trendPercent: trendResult.percent,
    suggestedReplenishment,
    daysOfStock,
    riskLevel,
    riskLabel,
    alerts,
  };
}

// ==========================================
// FUNÇÃO PRINCIPAL — GERA RESUMO COMPLETO
// ==========================================

/**
 * Gera o resumo completo de previsão de demanda para o dashboard.
 * Lê todos os dados necessários e executa análises para todas as variáveis.
 */
export function getDemandForecastSummary(): ForecastSummary {
  const orders = orderData.getAll();
  const products = productData.getAll();
  const groups = groupData.getAll();
  const variables = variableData.getAll();

  // Gera previsão para cada variável
  const forecasts: DemandForecast[] = variables.map(variable => {
    const group = groups.find(g => g.id === variable.groupId);
    const product = group ? products.find(p => p.id === group.productId) : undefined;
    return forecastVariable(variable, group, product, orders);
  });

  // Classifica por categorias
  const highDemand = forecasts
    .filter(f => f.avgWeeklyDemand > 0)
    .sort((a, b) => b.avgWeeklyDemand - a.avgWeeklyDemand)
    .slice(0, 5);

  const lowDemand = forecasts
    .filter(f => f.avgWeeklyDemand >= 0 && f.avgWeeklyDemand <= 2)
    .sort((a, b) => a.avgWeeklyDemand - b.avgWeeklyDemand);

  const criticalRisk = forecasts.filter(f => f.riskLevel === 'alto');
  const watchRisk = forecasts.filter(f => f.riskLevel === 'médio');

  const overstocked = forecasts.filter(f =>
    f.avgWeeklyDemand > 0 &&
    f.currentStock > f.avgWeeklyDemand * 8 &&
    f.trend !== 'crescente'
  );

  // Confiabilidade baseada em quantidade de dados
  const totalOrders = orders.filter(o => o.status === 'completed').length;
  let accuracy = 'Baixa — poucos pedidos registrados';
  if (totalOrders >= 20) accuracy = 'Alta — boa base de dados históricos';
  else if (totalOrders >= 10) accuracy = 'Média — dados suficientes para tendências';
  else if (totalOrders >= 5) accuracy = 'Moderada — tendências iniciais identificáveis';

  return {
    totalVariablesAnalyzed: variables.length,
    highDemand,
    lowDemand,
    criticalRisk,
    watchRisk,
    overstocked,
    forecastAccuracy: accuracy,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Retorna histórico de vendas semanais de uma variável específica.
 * Útil para gráficos de tendência.
 */
export function getVariableSalesHistory(variableId: string): VariableSalesHistory | null {
  const orders = orderData.getAll();
  const variable = variableData.getAll().find(v => v.id === variableId);
  if (!variable) return null;

  const group = groupData.getAll().find(g => g.id === variable.groupId);
  const product = group ? productData.getAll().find(p => p.id === group.productId) : undefined;

  const weeklyDemand = extractVariableDemand(orders, variableId);
  const weeklyPeriods = groupOrdersByWeek(orders);

  // Mapeia demanda da variável para períodos
  const periods: SalesPeriod[] = weeklyPeriods.map((period, i) => ({
    ...period,
    totalQuantity: weeklyDemand[i] || 0,
  }));

  const totalSold = weeklyDemand.reduce((a, b) => a + b, 0);
  const avgPerPeriod = weeklyDemand.length > 0 ? totalSold / weeklyDemand.length : 0;
  const trend = calculateTrend(weeklyDemand);

  return {
    variableId,
    variableName: variable.name,
    groupName: group?.name || 'Sem grupo',
    productName: product?.name || 'Sem produto',
    periods,
    totalSold,
    avgPerPeriod: Math.round(avgPerPeriod * 10) / 10,
    trend: trend.direction,
    trendPercent: trend.percent,
  };
}

/**
 * Retorna dados de vendas semanais agregados para o gráfico do dashboard.
 * Agrupa todos os pedidos por semana e retorna totais.
 */
export function getWeeklySalesData(): { labels: string[]; quantities: number[]; revenues: number[] } {
  const orders = orderData.getAll();
  const periods = groupOrdersByWeek(orders);

  return {
    labels: periods.map(p => p.label),
    quantities: periods.map(p => p.totalQuantity),
    revenues: periods.map(p => Math.round(p.totalRevenue * 100) / 100),
  };
}
