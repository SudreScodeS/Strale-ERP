// lib/fraud-detection.ts
// Sistema de detecção de fraude LOCAL — sem IA externa, sem APIs externas
// Usa regras inteligentes baseadas em comportamento, frequência e valores
// Arquitetura: Motor de pontuação modular — cada regra contribui com pontos parciais

import { v4 as uuidv4 } from 'uuid';
import { Order, OrderItem, FraudAnalysisLog, UserRiskProfile } from '../../types';
import { orderData, userData, fraudLogData } from './data';

// ==========================================
// CONSTANTES E LIMITES DO MOTOR
// ==========================================

// Thresholds configuráveis — ajuste conforme o negócio
const THRESHOLDS = {
  // Valores de pedido
  HIGH_VALUE_ABSOLUTE: 5000,       // Pedido acima deste valor em R$ é suspeito
  HIGH_VALUE_MULTIPLIER: 3,        // Pedido > 3x a média do usuário é suspeito
  VERY_HIGH_VALUE_MULTIPLIER: 5,   // Pedido > 5x a média = risco alto

  // Frequência de pedidos
  MAX_ORDERS_24H: 5,               // Mais de 5 pedidos em 24h é suspeito
  MAX_ORDERS_7D: 15,               // Mais de 15 pedidos em 7 dias é suspeito
  MIN_HOURS_BETWEEN_ORDERS: 0.5,   // Menos de 30min entre pedidos é suspeito

  // Quantidades
  MAX_QUANTITY_PER_ITEM: 100,      // Quantidade > 100 por item é suspeita
  MAX_ITEMS_PER_ORDER: 10,         // Mais de 10 itens distintos é suspeito

  // Perfil do usuário
  NEW_USER_DAYS: 7,                // Usuário com menos de 7 dias é "novo"
  CANCELLED_ORDER_RATIO: 0.3,      // >30% de cancelamentos é suspeito

  // Scores parciais (somam até 100)
  SCORE_HIGH_VALUE: 25,
  SCORE_VERY_HIGH_VALUE: 35,
  SCORE_VALUE_OUTLIER: 20,
  SCORE_FREQUENCY_24H: 20,
  SCORE_FREQUENCY_7D: 10,
  SCORE_RAPID_ORDERS: 15,
  SCORE_HIGH_QUANTITY: 15,
  SCORE_MANY_ITEMS: 10,
  SCORE_NEW_USER: 10,
  SCORE_HIGH_CANCEL_RATE: 15,
  SCORE_NO_HISTORY: 10,
  SCORE_UNUSUAL_PRODUCT: 10,
};

// ==========================================
// CONSTRução DO PERFIL DE RISCO DO USUÁRIO
// ==========================================

/**
 * Constrói o perfil de risco completo de um usuário
 * baseado em todo o histórico de pedidos.
 */
export function buildUserRiskProfile(userId: string): UserRiskProfile {
  const allOrders = orderData.getAll();
  const userOrders = allOrders.filter(o => o.userId === userId);
  const completedOrders = userOrders.filter(o => o.status === 'completed');
  const cancelledOrders = userOrders.filter(o => o.status === 'cancelled');

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Pedidos recentes
  const ordersLast24h = completedOrders.filter(o => new Date(o.createdAt) >= oneDayAgo).length;
  const ordersLast7d = completedOrders.filter(o => new Date(o.createdAt) >= sevenDaysAgo).length;

  // Valores
  const totals = completedOrders.map(o => o.totalPrice);
  const totalSpent = totals.reduce((a, b) => a + b, 0);
  const avgOrderValue = completedOrders.length > 0 ? totalSpent / completedOrders.length : 0;
  const maxOrderValue = totals.length > 0 ? Math.max(...totals) : 0;

  // Tempo
  const sortedDates = completedOrders
    .map(o => new Date(o.createdAt).getTime())
    .sort((a, b) => a - b);

  const daysSinceFirstOrder = sortedDates.length > 0
    ? Math.floor((now.getTime() - sortedDates[0]) / (24 * 60 * 60 * 1000))
    : 999;

  const daysSinceLastOrder = sortedDates.length > 0
    ? Math.floor((now.getTime() - sortedDates[sortedDates.length - 1]) / (24 * 60 * 60 * 1000))
    : 999;

  // Taxa de cancelamento
  const cancelledRatio = userOrders.length > 0
    ? cancelledOrders.length / userOrders.length
    : 0;

  // Score do perfil (0-100)
  let riskScore = 0;
  if (daysSinceFirstOrder < THRESHOLDS.NEW_USER_DAYS) riskScore += 15;
  if (cancelledRatio > THRESHOLDS.CANCELLED_ORDER_RATIO) riskScore += 20;
  if (ordersLast24h > 3) riskScore += 15;
  if (completedOrders.length === 0) riskScore += 10;
  if (avgOrderValue > 0 && maxOrderValue > avgOrderValue * THRESHOLDS.VERY_HIGH_VALUE_MULTIPLIER) riskScore += 15;

  return {
    userId,
    totalOrders: completedOrders.length,
    totalSpent: Math.round(totalSpent * 100) / 100,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    maxOrderValue: Math.round(maxOrderValue * 100) / 100,
    ordersLast24h,
    ordersLast7d,
    daysSinceFirstOrder,
    daysSinceLastOrder,
    cancelledOrders: cancelledOrders.length,
    riskScore: Math.min(100, riskScore),
  };
}

// ==========================================
// MOTOR DE ANÁLISE DE FRAUDE
// ==========================================

/**
 * Analisa um pedido em busca de indicadores de fraude.
 * Retorna score de 0-100 e lista de flags encontradas.
 *
 * REGRAS DE ANÁLISE:
 * 1. Valor absoluto alto
 * 2. Valor muito acima da média do usuário
 * 3. Frequência excessiva de pedidos (24h e 7d)
 * 4. Intervalo muito curto entre pedidos
 * 5. Quantidades anormais por item
 * 6. Muitos itens distintos em um pedido
 * 7. Usuário novo com pedido alto
 * 8. Histórico de cancelamentos elevado
 * 9. Produto atípico para o usuário
 */
export function analyzeOrderRisk(order: Order, profile: UserRiskProfile): { score: number; flags: string[]; level: FraudAnalysisLog['riskLevel'] } {
  let score = 0;
  const flags: string[] = [];

  // ── REGRA 1: Valor absoluto alto ──
  if (order.totalPrice > THRESHOLDS.HIGH_VALUE_ABSOLUTE) {
    score += THRESHOLDS.SCORE_HIGH_VALUE;
    flags.push(`Valor alto: R$ ${order.totalPrice.toFixed(2)} (limite: R$ ${THRESHOLDS.HIGH_VALUE_ABSOLUTE})`);
  }

  // ── REGRA 2: Valor acima da média do usuário ──
  if (profile.avgOrderValue > 0 && profile.totalOrders >= 2) {
    const multiplier = order.totalPrice / profile.avgOrderValue;
    if (multiplier >= THRESHOLDS.VERY_HIGH_VALUE_MULTIPLIER) {
      score += THRESHOLDS.SCORE_VERY_HIGH_VALUE;
      flags.push(`Valor ${multiplier.toFixed(1)}x acima da média do usuário (R$ ${profile.avgOrderValue.toFixed(2)})`);
    } else if (multiplier >= THRESHOLDS.HIGH_VALUE_MULTIPLIER) {
      score += THRESHOLDS.SCORE_VALUE_OUTLIER;
      flags.push(`Valor ${multiplier.toFixed(1)}x acima da média do usuário`);
    }
  }

  // ── REGRA 3: Frequência de pedidos em 24h ──
  if (profile.ordersLast24h >= THRESHOLDS.MAX_ORDERS_24H) {
    score += THRESHOLDS.SCORE_FREQUENCY_24H;
    flags.push(`${profile.ordersLast24h} pedidos nas últimas 24h (limite: ${THRESHOLDS.MAX_ORDERS_24H})`);
  }

  // ── REGRA 4: Frequência de pedidos em 7 dias ──
  if (profile.ordersLast7d >= THRESHOLDS.MAX_ORDERS_7D) {
    score += THRESHOLDS.SCORE_FREQUENCY_7D;
    flags.push(`${profile.ordersLast7d} pedidos nos últimos 7 dias (limite: ${THRESHOLDS.MAX_ORDERS_7D})`);
  }

  // ── REGRA 5: Intervalo muito curto entre pedidos ──
  const lastOrder = orderData.getAll()
    .filter(o => o.userId === order.userId && o.id !== order.id && o.status === 'completed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (lastOrder) {
    const hoursBetween = (new Date(order.createdAt).getTime() - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursBetween < THRESHOLDS.MIN_HOURS_BETWEEN_ORDERS) {
      score += THRESHOLDS.SCORE_RAPID_ORDERS;
      flags.push(`Intervalo de ${(hoursBetween * 60).toFixed(0)}min desde último pedido (mínimo: ${THRESHOLDS.MIN_HOURS_BETWEEN_ORDERS * 60}min)`);
    }
  }

  // ── REGRA 6: Quantidades anormais por item ──
  for (const item of order.items) {
    if (item.quantity > THRESHOLDS.MAX_QUANTITY_PER_ITEM) {
      score += THRESHOLDS.SCORE_HIGH_QUANTITY;
      flags.push(`Quantidade alta: ${item.quantity} unidades de um item (limite: ${THRESHOLDS.MAX_QUANTITY_PER_ITEM})`);
      break; // Conta apenas uma vez
    }
  }

  // ── REGRA 7: Muitos itens distintos ──
  if (order.items.length > THRESHOLDS.MAX_ITEMS_PER_ORDER) {
    score += THRESHOLDS.SCORE_MANY_ITEMS;
    flags.push(`${order.items.length} itens distintos no pedido (limite: ${THRESHOLDS.MAX_ITEMS_PER_ORDER})`);
  }

  // ── REGRA 8: Usuário novo com pedido alto ──
  if (profile.daysSinceFirstOrder < THRESHOLDS.NEW_USER_DAYS && profile.totalOrders <= 2) {
    if (order.totalPrice > THRESHOLDS.HIGH_VALUE_ABSOLUTE / 2) {
      score += THRESHOLDS.SCORE_NEW_USER;
      flags.push(`Usuário novo (${profile.daysSinceFirstOrder} dias) com pedido de R$ ${order.totalPrice.toFixed(2)}`);
    }
  }

  // ── REGRA 9: Taxa de cancelamento elevada ──
  const totalUserOrders = profile.totalOrders + profile.cancelledOrders;
  if (totalUserOrders >= 3) {
    const cancelRate = profile.cancelledOrders / totalUserOrders;
    if (cancelRate > THRESHOLDS.CANCELLED_ORDER_RATIO) {
      score += THRESHOLDS.SCORE_HIGH_CANCEL_RATE;
      flags.push(`Taxa de cancelamento alta: ${(cancelRate * 100).toFixed(0)}% (${profile.cancelledOrders}/${totalUserOrders})`);
    }
  }

  // ── REGRA 10: Sem histórico (primeiro pedido) ──
  if (profile.totalOrders === 0) {
    score += THRESHOLDS.SCORE_NO_HISTORY;
    flags.push('Primeiro pedido do usuário — sem histórico para comparação');
  }

  // ── REGRA 11: Produto atípico ──
  const allUserOrders = orderData.getAll().filter(o => o.userId === order.userId && o.status === 'completed');
  const usualProductIds = new Set(allUserOrders.flatMap(o => o.items.map(i => i.productId)));
  const currentProductIds = order.items.map(i => i.productId);
  const unusualProducts = currentProductIds.filter(pid => !usualProductIds.has(pid));

  if (unusualProducts.length > 0 && allUserOrders.length >= 3) {
    score += THRESHOLDS.SCORE_UNUSUAL_PRODUCT;
    flags.push(`Produto(s) nunca comprado(s) por este usuário anteriormente`);
  }

  // Limita score a 100
  score = Math.min(100, score);

  // Classificação do nível
  let level: FraudAnalysisLog['riskLevel'];
  if (score >= 70) level = 'crítico';
  else if (score >= 50) level = 'alto';
  else if (score >= 30) level = 'médio';
  else level = 'baixo';

  return { score, flags, level };
}

/**
 * Determina o status do pedido com base no score de fraude.
 */
function determineStatus(score: number): FraudAnalysisLog['status'] {
  if (score >= 70) return 'bloqueado';
  if (score >= 40) return 'suspeito';
  return 'aprovado';
}

// ==========================================
// FUNÇÃO PRINCIPAL — EXECUTA ANÁLISE COMPLETA
// ==========================================

/**
 * Executa análise completa de fraude para um pedido.
 * Esta é a função chamada pelo fluxo de finalização.
 *
 * 1. Constrói perfil do usuário
 * 2. Analisa o pedido contra regras
 * 3. Salva log de análise
 * 4. Retorna resultado
 */
export function runFraudAnalysis(order: Order): FraudAnalysisLog {
  const user = userData.getById(order.userId);
  const profile = buildUserRiskProfile(order.userId);
  const analysis = analyzeOrderRisk(order, profile);
  const status = determineStatus(analysis.score);

  const log: FraudAnalysisLog = {
    id: uuidv4(),
    orderId: order.id,
    userId: order.userId,
    userName: user?.username || order.userId,
    orderTotal: order.totalPrice,
    riskScore: analysis.score,
    riskLevel: analysis.level,
    flags: analysis.flags,
    status,
    createdAt: new Date(),
  };

  // Salva no histórico de análises
  fraudLogData.create(log);

  // Log no console para debug/auditoria
  if (status !== 'aprovado') {
    console.warn(`[FRAUD] Pedido ${order.id} — Score: ${analysis.score} — Status: ${status}`);
    analysis.flags.forEach(f => console.warn(`  ⚠ ${f}`));
  }

  return log;
}

// ==========================================
// CONSULTAS E RELATÓRIOS
// ==========================================

/**
 * Retorna resumo de fraudes para o dashboard.
 * Inclui estatísticas, listas por severidade e tendências.
 */
export function getFraudSummary() {
  const logs = fraudLogData.getAll();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Estatísticas gerais
  const totalAnalyzed = logs.length;
  const approved = logs.filter(l => l.status === 'aprovado');
  const suspicious = logs.filter(l => l.status === 'suspeito');
  const blocked = logs.filter(l => l.status === 'bloqueado');

  // Últimas 24h
  const recent24h = logs.filter(l => new Date(l.createdAt) >= oneDayAgo);
  const suspicious24h = recent24h.filter(l => l.status !== 'aprovado');

  // Últimos 7 dias
  const recent7d = logs.filter(l => new Date(l.createdAt) >= sevenDaysAgo);

  // Top flags mais frequentes
  const flagCounts = new Map<string, number>();
  logs.forEach(log => {
    log.flags.forEach(flag => {
      // Normaliza flag (pega só o prefixo antes do ":")
      const key = flag.split(':')[0].trim();
      flagCounts.set(key, (flagCounts.get(key) || 0) + 1);
    });
  });
  const topFlags = Array.from(flagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([flag, count]) => ({ flag, count }));

  // Usuários mais problemáticos
  const userFlagCounts = new Map<string, { name: string; count: number; maxScore: number }>();
  logs.filter(l => l.status !== 'aprovado').forEach(log => {
    const existing = userFlagCounts.get(log.userId);
    if (existing) {
      existing.count += 1;
      existing.maxScore = Math.max(existing.maxScore, log.riskScore);
    } else {
      userFlagCounts.set(log.userId, { name: log.userName, count: 1, maxScore: log.riskScore });
    }
  });
  const problematicUsers = Array.from(userFlagCounts.values())
    .sort((a, b) => b.maxScore - a.maxScore)
    .slice(0, 5);

  // Últimos pedidos suspeitos/bloqueados (para revisão)
  const pendingReview = logs
    .filter(l => l.status !== 'aprovado' && !l.reviewedBy)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  // Tendência semanal (últimas 4 semanas)
  const weeklyTrend: { week: string; total: number; flagged: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekLogs = logs.filter(l => {
      const d = new Date(l.createdAt);
      return d >= weekStart && d < weekEnd;
    });
    weeklyTrend.push({
      week: `S-${i}`,
      total: weekLogs.length,
      flagged: weekLogs.filter(l => l.status !== 'aprovado').length,
    });
  }

  return {
    totalAnalyzed,
    approvedCount: approved.length,
    suspiciousCount: suspicious.length,
    blockedCount: blocked.length,
    flaggedTotal: suspicious.length + blocked.length,
    recent24hCount: recent24h.length,
    suspicious24hCount: suspicious24h.length,
    recent7dCount: recent7d.length,
    topFlags,
    problematicUsers,
    pendingReview,
    weeklyTrend,
    avgRiskScore: logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + l.riskScore, 0) / logs.length)
      : 0,
    generatedAt: now.toISOString(),
  };
}

/**
 * Revisa um log de fraude (ação do admin).
 * Permite aprovar, manter suspeito ou bloquear.
 */
export function reviewFraudLog(
  logId: string,
  reviewerId: string,
  newStatus: FraudAnalysisLog['status'],
  note?: string
): FraudAnalysisLog | null {
  const log = fraudLogData.getById(logId);
  if (!log) return null;

  fraudLogData.update(logId, {
    status: newStatus,
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
    reviewNote: note,
  });

  return fraudLogData.getById(logId) || null;
}
