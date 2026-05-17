// lib/assistant.ts
// Assistente inteligente LOCAL — sem APIs externas, sem ChatGPT
// Interpreta perguntas em linguagem natural e responde com dados reais do sistema
// Arquitetura: Pattern matching + funções de consulta tipadas

import { productData, variableData, groupData, orderData, financeData, userData, supplierData, purchaseOrderData, quoteData } from './data';
import { getFinanceSummary, getStockAlertsByLevel, getOrcamentosStats } from './business';
import { getDemandForecastSummary } from './demand-forecast';
import { globalConfig } from '../../config/global';
import { calculateItemPricing, type PricingInput } from './pricing';

// ==========================================
// TIPOS
// ==========================================

export interface AssistantResponse {
  answer: string;       // Resposta formatada em texto
  data?: unknown;       // Dados brutos opcionais para renderização especial
  type: 'text' | 'table' | 'metric' | 'list'; // Tipo de resposta para formatação
  icon?: string;        // Emoji para a resposta
}

/** Intenção detectada na pergunta do usuário */
type Intent = {
  name: string;
  handler: () => AssistantResponse;
};

// ==========================================
// NORMALIZAÇÃO DE TEXTO
// ==========================================

/**
 * Normaliza texto para matching: minúsculas, sem acentos, sem pontuação.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.,;:]/g, '')
    .trim();
}

/**
 * Verifica se o texto normalizado contém TODAS as palavras fornecidas.
 */
function containsAll(text: string, ...words: string[]): boolean {
  const n = normalize(text);
  return words.every(w => n.includes(normalize(w)));
}

/**
 * Verifica se o texto normalizado contém ALGUMA das palavras fornecidas.
 */
function containsAny(text: string, ...words: string[]): boolean {
  const n = normalize(text);
  return words.some(w => n.includes(normalize(w)));
}

// ==========================================
// FORMATADORES DE RESPOSTA
// ==========================================

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ==========================================
// FUNÇÕES DE CONSULTA (cada uma responde a uma intenção)
// ==========================================

/** Produtos mais vendidos (por quantidade de itens em pedidos) */
function queryTopProducts(): AssistantResponse {
  const orders = orderData.getAll().filter(o => o.status === 'completed');
  const products = productData.getAll();

  const productSales = new Map<string, { name: string; totalQty: number; totalRevenue: number; orderCount: number }>();

  for (const order of orders) {
    for (const item of order.items) {
      const existing = productSales.get(item.productId);
      const product = products.find(p => p.id === item.productId);
      const name = product?.name || item.productId;

      if (existing) {
        existing.totalQty += item.quantity;
        existing.totalRevenue += item.unitPrice;
        existing.orderCount += 1;
      } else {
        productSales.set(item.productId, {
          name,
          totalQty: item.quantity,
          totalRevenue: item.unitPrice,
          orderCount: 1,
        });
      }
    }
  }

  const sorted = Array.from(productSales.values()).sort((a, b) => b.totalQty - a.totalQty);

  if (sorted.length === 0) {
    return { answer: 'Nenhum pedido registrado ainda.', type: 'text' };
  }

  const lines = sorted.map((p, i) =>
    `${i + 1}. **${p.name}** — ${p.totalQty} unidades, ${formatCurrency(p.totalRevenue)} em receita (${p.orderCount} itens em pedidos)`
  );

  return {
    answer: `**Produtos mais vendidos:**\n\n${lines.join('\n')}`,
    data: sorted,
    type: 'list',
  };
}

/** Estoque baixo / crítico */
function queryLowStock(): AssistantResponse {
  const alerts = getStockAlertsByLevel();
  const groups = groupData.getAll();

  if (alerts.critical.length === 0 && alerts.watch.length === 0) {
  }

  const lines: string[] = [];

  if (alerts.critical.length > 0) {
    lines.push('[CRITICO] Estoque critico:');
    for (const v of alerts.critical) {
      const group = groups.find(g => g.id === v.groupId);
      const unit = "un";
      lines.push(`  • **${v.name}** (${group?.name || 'Sem grupo'}) — ${v.stock} ${"un."} restantes`);
    }
  }

  if (alerts.watch.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('[ATENCAO] Estoque em atencao:');
    for (const v of alerts.watch) {
      const group = groups.find(g => g.id === v.groupId);
      const unit = "un";
      lines.push(`  • **${v.name}** (${group?.name || 'Sem grupo'}) — ${v.stock} ${"un."}`);
    }
  }

  return {
    answer: `**Alertas de estoque:**\n\n${lines.join('\n')}`,
    data: { critical: alerts.critical, watch: alerts.watch },
    type: 'list',
  };
}

/** Lucro total */
function queryProfit(): AssistantResponse {
  const finance = getFinanceSummary();

  return {
    answer: `**Resumo financeiro:**\n\n• Total de vendas: ${formatCurrency(finance.totalSales)}\n• Total de despesas: ${formatCurrency(finance.totalExpenses)}\n• **Lucro: ${formatCurrency(finance.profit)}**`,
    data: finance,
    type: 'metric',
  };
}

/** Total de vendas */
function queryTotalSales(): AssistantResponse {
  const finance = getFinanceSummary();
  const orders = orderData.getAll().filter(o => o.status === 'completed');

  return {
    answer: `**Total de vendas:** ${formatCurrency(finance.totalSales)}\n\n• ${orders.length} pedidos finalizados\n• Ticket médio: ${orders.length > 0 ? formatCurrency(finance.totalSales / orders.length) : 'N/A'}`,
    data: { totalSales: finance.totalSales, orderCount: orders.length },
    type: 'metric',
  };
}

/** Pedidos recentes / de hoje */
function queryRecentOrders(): AssistantResponse {
  const orders = orderData.getAll().filter(o => o.status === 'completed');
  const users = userData.getAll();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todayOrders = orders.filter(o => new Date(o.createdAt) >= todayStart);
  const recentOrders = orders.slice(-5).reverse();

  const lines: string[] = [];

  if (todayOrders.length > 0) {
    lines.push(`**Pedidos de hoje:** ${todayOrders.length}\n`);
    for (const o of todayOrders) {
      const user = users.find(u => u.id === o.userId);
      lines.push(`  • #${o.id} — ${o.name} — ${formatCurrency(o.totalPrice)} — por ${user?.username || o.userId}`);
    }
    lines.push('');
  }

  lines.push('**Últimos 5 pedidos:**');
  for (const o of recentOrders) {
    const user = users.find(u => u.id === o.userId);
    lines.push(`  • #${o.id} ${o.name} — ${formatCurrency(o.totalPrice)} — ${formatDate(o.createdAt)} — ${user?.username || o.userId}`);
  }

  return {
    answer: lines.join('\n'),
    data: { todayCount: todayOrders.length, recent: recentOrders },
    type: 'list',
  };
}

/** Quantidade total de pedidos */
function queryOrderCount(): AssistantResponse {
  const orders = orderData.getAll();
  const completed = orders.filter(o => o.status === 'completed');
  const pending = orders.filter(o => o.status === 'pending');
  const cancelled = orders.filter(o => o.status === 'cancelled');

  return {
    answer: `**Total de pedidos:** ${orders.length}\n\n• Finalizados: ${completed.length}\n• Pendentes: ${pending.length}\n• Cancelados: ${cancelled.length}`,
    data: { total: orders.length, completed: completed.length, pending: pending.length, cancelled: cancelled.length },
    type: 'metric',
  };
}

/** Lista de produtos cadastrados */
function queryProducts(): AssistantResponse {
  const products = productData.getAll();
  const groups = groupData.getAll();
  const variables = variableData.getAll();

  const lines = products.map(p => {
    const pGroups = groups.filter(g => g.productId === p.id);
    const pVariables = variables.filter(v => pGroups.some(g => g.id === v.groupId));
    // Group stock by unit type
    const stockByUnit: Record<string, number> = {};
    pVariables.forEach(v => {
      const unit = "un";
      stockByUnit[unit] = (stockByUnit[unit] || 0) + v.stock;
    });
    const stockLabel = Object.entries(stockByUnit)
      .filter(([, qty]) => qty > 0)
      .map(([unit, qty]) => `${qty} ${"un."}`)
      .join(', ') || '0';
    return `• **${p.name}** — ${formatCurrency(p.basePrice)} base — ${pGroups.length} grupos, ${pVariables.length} variações — Estoque: ${stockLabel}`;
  });

  return {
    answer: `**Produtos cadastrados:** ${products.length}\n\n${lines.join('\n')}`,
    data: products,
    type: 'list',
  };
}

/** Ticket médio */
function queryTicketMedio(): AssistantResponse {
  const orders = orderData.getAll().filter(o => o.status === 'completed');

  if (orders.length === 0) {
  }

  const total = orders.reduce((sum, o) => sum + o.totalPrice, 0);
  const avg = total / orders.length;
  const max = Math.max(...orders.map(o => o.totalPrice));
  const min = Math.min(...orders.map(o => o.totalPrice));

  return {
    answer: `**Ticket médio:** ${formatCurrency(avg)}\n\n• Maior pedido: ${formatCurrency(max)}\n• Menor pedido: ${formatCurrency(min)}\n• Total de pedidos: ${orders.length}\n• Soma total: ${formatCurrency(total)}`,
    data: { avg, max, min, count: orders.length },
    type: 'metric',
  };
}

/** Usuários cadastrados */
function queryUsers(): AssistantResponse {
  const users = userData.getAll();
  const orders = orderData.getAll().filter(o => o.status === 'completed');

  const lines = users.map(u => {
    const userOrders = orders.filter(o => o.userId === u.id);
    const totalSpent = userOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    return `• **${u.username}** (${u.role}) — ${userOrders.length} pedidos — ${formatCurrency(totalSpent)} em vendas`;
  });

  return {
    answer: `**Usuários cadastrados:** ${users.length}\n\n${lines.join('\n')}`,
    data: users,
    type: 'list',
  };
}

/** Usuário mais ativo */
function queryMostActiveUser(): AssistantResponse {
  const orders = orderData.getAll().filter(o => o.status === 'completed');
  const users = userData.getAll();

  const userCounts = new Map<string, { name: string; count: number; total: number }>();
  for (const order of orders) {
    const existing = userCounts.get(order.userId);
    const user = users.find(u => u.id === order.userId);
    const name = user?.username || order.userId;

    if (existing) {
      existing.count += 1;
      existing.total += order.totalPrice;
    } else {
      userCounts.set(order.userId, { name, count: 1, total: order.totalPrice });
    }
  }

  const sorted = Array.from(userCounts.values()).sort((a, b) => b.count - a.count);

  if (sorted.length === 0) {
  }

  const top = sorted[0];
  const lines = sorted.map((u, i) =>
    `${i + 1}. **${u.name}** — ${u.count} pedidos — ${formatCurrency(u.total)} em vendas`
  );

  return {
    answer: `**Usuário mais ativo:** ${top.name} com ${top.count} pedidos\n\n${lines.join('\n')}`,
    data: sorted,
    type: 'list',
  };
}

/** Previsão de demanda */
function queryDemandForecast(): AssistantResponse {
  const forecast = getDemandForecastSummary();

  const lines: string[] = [];

  if (forecast.criticalRisk.length > 0) {
    lines.push('[RISCO] Risco alto de falta:');
    for (const f of forecast.criticalRisk) {
      lines.push(`  • ${f.variableName} — ${f.currentStock} em estoque, demanda média: ${f.avgWeeklyDemand}/sem — ${f.riskLabel}`);
    }
    lines.push('');
  }

  if (forecast.watchRisk.length > 0) {
    lines.push('[ATENCAO] Em atencao:');
    for (const f of forecast.watchRisk) {
      lines.push(`  • ${f.variableName} — ${f.currentStock} em estoque, demanda: ${f.avgWeeklyDemand}/sem`);
    }
    lines.push('');
  }

  if (forecast.highDemand.length > 0) {
    lines.push('[DEMANDA] Alta demanda:');
    for (const f of forecast.highDemand) {
      lines.push(`  • ${f.variableName} — ${f.avgWeeklyDemand}/sem — tendência: ${f.trend} (${f.trendPercent}%)`);
    }
  }

  if (lines.length === 0) {
  }

  return {
    answer: `**Previsão de Demanda:**\n\n${lines.join('\n')}\n\n_Confiabilidade: ${forecast.forecastAccuracy}_`,
    data: forecast,
    type: 'list',
  };
}

/** Fornecedores cadastrados */
function querySuppliers(): AssistantResponse {
  const suppliers = supplierData.getAll();

  if (suppliers.length === 0) {
  }

  const lines = suppliers.map(s => `• **${s.name}**${s.contact ? ` — ${s.contact}` : ''}`);

  return {
    answer: `**Fornecedores cadastrados:** ${suppliers.length}\n\n${lines.join('\n')}`,
    data: suppliers,
    type: 'list',
  };
}

/** Pedidos de compra */
function queryPurchaseOrders(): AssistantResponse {
  const pos = purchaseOrderData.getAll();

  if (pos.length === 0) {
  }

  const pending = pos.filter(p => p.status === 'pending');
  const ordered = pos.filter(p => p.status === 'ordered');
  const received = pos.filter(p => p.status === 'received');

  return {
    answer: `**Pedidos de compra:** ${pos.length}\n\n• Pendentes: ${pending.length}\n• Enviados: ${ordered.length}\n• Recebidos: ${received.length}`,
    data: { total: pos.length, pending: pending.length, ordered: ordered.length, received: received.length },
    type: 'metric',
  };
}

/** Variáveis com maior estoque */
function queryHighStock(): AssistantResponse {
  const variables = variableData.getAll();
  const groups = groupData.getAll();
  const sorted = [...variables].sort((a, b) => b.stock - a.stock);

  const lines = sorted.map(v => {
    const group = groups.find(g => g.id === v.groupId);
    const unit = "un";
    return `• **${v.name}** (${group?.name || '?'}) — ${v.stock} ${"un."}`;
  });

  return {
    answer: `**Estoque por variável (maior → menor):**\n\n${lines.join('\n')}`,
    data: sorted,
    type: 'list',
  };
}

/** Vendas por período (hoje, semana, mês) */
function querySalesByPeriod(): AssistantResponse {
  const orders = orderData.getAll().filter(o => o.status === 'completed');
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const today = orders.filter(o => new Date(o.createdAt) >= todayStart);
  const week = orders.filter(o => new Date(o.createdAt) >= weekStart);
  const month = orders.filter(o => new Date(o.createdAt) >= monthStart);

  const sum = (arr: typeof orders) => arr.reduce((s, o) => s + o.totalPrice, 0);

  return {
    answer: `**Vendas por período:**\n\n• **Hoje:** ${today.length} pedidos — ${formatCurrency(sum(today))}\n• **Últimos 7 dias:** ${week.length} pedidos — ${formatCurrency(sum(week))}\n• **Mês atual:** ${month.length} pedidos — ${formatCurrency(sum(month))}`,
    data: { today: today.length, week: week.length, month: month.length, todayTotal: sum(today), weekTotal: sum(week), monthTotal: sum(month) },
    type: 'metric',
  };
}

/** Despesas / compras */
function queryExpenses(): AssistantResponse {
  const records = financeData.getAll();
  const purchases = records.filter(r => r.type === 'purchase');
  const expenses = records.filter(r => r.type === 'expense');
  const total = purchases.reduce((s, r) => s + r.amount, 0) + expenses.reduce((s, r) => s + r.amount, 0);

  const lines: string[] = [];
  if (purchases.length > 0) {
    lines.push(`**Compras:** ${purchases.length} registros — ${formatCurrency(purchases.reduce((s, r) => s + r.amount, 0))}`);
    for (const p of purchases.slice(-5)) {
      lines.push(`  • ${p.description} — ${formatCurrency(p.amount)} — ${formatDate(p.date)}`);
    }
  }
  if (expenses.length > 0) {
    lines.push(`**Despesas:** ${expenses.length} registros — ${formatCurrency(expenses.reduce((s, r) => s + r.amount, 0))}`);
  }

  if (lines.length === 0) {
  }

  return {
    answer: `**Despesas e compras:** ${formatCurrency(total)} no total\n\n${lines.join('\n')}`,
    data: { total, purchases: purchases.length, expenses: expenses.length },
    type: 'metric',
  };
}

/** Orçamentos pendentes / rascunho */
function queryPendingQuotes(): AssistantResponse {
  const quotes = quoteData.getAll();
  const drafts = quotes.filter(q => q.status === 'draft');
  const sent = quotes.filter(q => q.status === 'sent');

  const lines: string[] = [];

  if (drafts.length > 0) {
    lines.push('[RASCUNHO] Rascunhos:');
    for (const q of drafts.slice(-5)) {
      const user = userData.getById(q.userId);
      lines.push(`  • ${q.name} — ${q.customerName} — ${formatCurrency(q.totalPrice)} — por ${user?.username || q.userId}`);
    }
  }

  if (sent.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('[ENVIADO] Enviados (aguardando resposta):');
    for (const q of sent.slice(-5)) {
      const user = userData.getById(q.userId);
      const validUntil = q.validUntil ? ` — válido até ${new Date(q.validUntil).toLocaleDateString('pt-BR')}` : '';
      lines.push(`  • ${q.name} — ${q.customerName} — ${formatCurrency(q.totalPrice)}${validUntil}`);
    }
  }

  if (lines.length === 0) {
    return { answer: 'Nenhum orçamento pendente.', type: 'text' };
  }

  return {
    answer: `**Orçamentos pendentes:** ${drafts.length + sent.length}\n\n${lines.join('\n')}`,
    data: { drafts: drafts.length, sent: sent.length },
    type: 'list',
  };
}

/** Taxa de conversão de orçamentos */
function queryQuoteConversion(): AssistantResponse {
  const stats = getOrcamentosStats();

  return {
    answer: `**Orçamentos — Resumo:**\n\n• Total: ${stats.total}\n• Rascunho: ${stats.draft}\n• Enviados: ${stats.sent}\n• Aprovados: ${stats.approved}\n• Rejeitados: ${stats.rejected}\n• Convertidos em pedido: ${stats.converted}\n• **Taxa de conversão: ${stats.conversionRate.toFixed(1)}%**\n• Valor total: ${formatCurrency(stats.totalValue)}\n• Ticket médio: ${formatCurrency(stats.averageValue)}`,
    data: stats,
    type: 'metric',
  };
}

// ==========================================
// FUNÇÕES DE ENTREGA E URGÊNCIA
// ==========================================

/** Calcula urgência de entrega */
function getUrgencyLabel(deliveryDate: string, delivered?: boolean): { label: string; level: string; days: number } | null {
  if (!deliveryDate || delivered) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const delivery = new Date(deliveryDate + 'T12:00:00');
  const diffMs = delivery.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `ATRASADO ${Math.abs(diffDays)} dia(s)`, level: 'critical', days: diffDays };
  if (diffDays === 0) return { label: 'ENTREGA HOJE', level: 'critical', days: 0 };
  if (diffDays === 1) return { label: 'ENTREGA AMANHÃ', level: 'high', days: 1 };
  if (diffDays <= 3) return { label: `${diffDays} dias restantes`, level: 'high', days: diffDays };
  if (diffDays <= 7) return { label: `${diffDays} dias restantes`, level: 'medium', days: diffDays };
  return { label: `${diffDays} dias restantes`, level: 'low', days: diffDays };
}

/** Pedidos com entrega urgente (próximos 3 dias + atrasados) */
function queryUrgentDeliveries(): AssistantResponse {
  const orders = orderData.getAll().filter(o => o.status === 'completed' && o.deliveryDate && !o.delivered);
  const users = userData.getAll();

  const withUrgency = orders
    .map(o => ({ order: o, urgency: getUrgencyLabel(o.deliveryDate!, o.delivered) }))
    .filter(x => x.urgency !== null)
    .sort((a, b) => (a.urgency?.days ?? 999) - (b.urgency?.days ?? 999));

  const critical = withUrgency.filter(x => x.urgency?.level === 'critical');
  const high = withUrgency.filter(x => x.urgency?.level === 'high');
  const medium = withUrgency.filter(x => x.urgency?.level === 'medium');

  const lines: string[] = [];

  if (critical.length > 0) {
    lines.push('[URGENTE] **URGENTE:**');
    for (const { order: o, urgency: u } of critical) {
      const user = users.find(uu => uu.id === o.userId);
      lines.push(`  • **${o.name}** — ${u?.label} — ${formatCurrency(o.totalPrice)} — por ${user?.username || o.userId}`);
    }
    lines.push('');
  }

  if (high.length > 0) {
    lines.push('[ALTO] **Próximos (até 3 dias):**');
    for (const { order: o, urgency: u } of high) {
      const user = users.find(uu => uu.id === o.userId);
      lines.push(`  • **${o.name}** — ${u?.label} — ${formatCurrency(o.totalPrice)} — por ${user?.username || o.userId}`);
    }
    lines.push('');
  }

  if (medium.length > 0) {
    lines.push('[MEDIO] **Esta semana:**');
    for (const { order: o, urgency: u } of medium) {
      const user = users.find(uu => uu.id === o.userId);
      lines.push(`  • **${o.name}** — ${u?.label} — ${formatCurrency(o.totalPrice)}`);
    }
  }

  if (lines.length === 0) {
    return { answer: 'Nenhum pedido com entrega urgente. Tudo em dia!', type: 'text' };
  }

  return {
    answer: `**Entregas pendentes por urgência:**\n\n${lines.join('\n')}\n\n_Total: ${withUrgency.length} pedidos pendentes_`,
    data: { critical: critical.length, high: high.length, medium: medium.length, total: withUrgency.length },
    type: 'list',
  };
}

/** Status de entrega de um pedido específico */
function queryOrderDelivery(question: string): AssistantResponse {
  const orders = orderData.getAll().filter(o => o.status === 'completed');
  const users = userData.getAll();

  // Tenta encontrar pedido por nome ou ID
  const q = normalize(question);
  const order = orders.find(o =>
    normalize(o.name).includes(q.replace(/entrega|pedido|status|data|quando/g, '').trim()) ||
    o.id.includes(q.replace(/entrega|pedido|status|data|quando/g, '').trim())
  );

  if (!order) {
    // Lista todos com status de entrega
    const pending = orders.filter(o => !o.delivered && o.deliveryDate);
    const delivered = orders.filter(o => o.delivered);
    const noDate = orders.filter(o => !o.deliveryDate);

    const lines: string[] = [];
    if (pending.length > 0) {
      lines.push('**Pendentes de entrega:**');
      for (const o of pending) {
        const u = getUrgencyLabel(o.deliveryDate!, o.delivered);
        const icon = u?.level === 'critical' ? '[URGENTE]' : u?.level === 'high' ? '[ALTO]' : '[MEDIO]';
        lines.push(`  ${icon} **${o.name}** — entrega: ${new Date(o.deliveryDate! + 'T12:00:00').toLocaleDateString('pt-BR')} (${u?.label || '?'})`);
      }
      lines.push('');
    }
    if (delivered.length > 0) {
      lines.push('**Entregues:**');
      for (const o of delivered) {
        lines.push(`  [OK] **${o.name}** — entregue${o.deliveredAt ? ` em ${new Date(o.deliveredAt).toLocaleDateString('pt-BR')}` : ''}`);
      }
    }
    if (noDate.length > 0) {
      lines.push(`\n_Sem data de entrega: ${noDate.length} pedido(s)_`);
    }

    return {
      answer: lines.length > 0 ? lines.join('\n') : 'Nenhum pedido com status de entrega.',
      type: 'list',
    };
  }

  // Pedido encontrado — detalha status
  const lines: string[] = [`**Pedido: ${order.name}** (#${order.id})`, ''];
  lines.push(`Status: ${order.status === 'completed' ? 'Concluído' : order.status}`);

  if (order.deliveryDate) {
    const deliveryFormatted = new Date(order.deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR');
    lines.push(`Data de entrega: ${deliveryFormatted}`);

    if (order.delivered) {
      lines.push(`[OK] **ENTREGUE**${order.deliveredAt ? ` em ${new Date(order.deliveredAt).toLocaleDateString('pt-BR')}` : ''}`);
    } else {
      const u = getUrgencyLabel(order.deliveryDate, order.delivered);
      if (u) {
        const icon = u.level === 'critical' ? '[URGENTE]' : u.level === 'high' ? '[ALTO]' : u.level === 'medium' ? '[MEDIO]' : '[OK]';
        lines.push(`${icon} **${u.label}**`);
      }
    }
  } else {
    lines.push('Data de entrega: Não definida');
  }

  const user = users.find(u => u.id === order.userId);
  lines.push(`Valor: ${formatCurrency(order.totalPrice)}`);
  lines.push(`Criado por: ${user?.username || order.userId}`);

  return { answer: lines.join('\n'), type: 'text' };
}

/** Resumo de entregas do dia */
function queryTodayDeliveries(): AssistantResponse {
  const orders = orderData.getAll().filter(o => o.status === 'completed' && o.deliveryDate && !o.delivered);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const todayOrders = orders.filter(o => o.deliveryDate === today);

  if (todayOrders.length === 0) {
    return { answer: 'Nenhuma entrega programada para hoje.', type: 'text' };
  }

  const users = userData.getAll();
  const lines = todayOrders.map(o => {
    const user = users.find(u => u.id === o.userId);
    return `  [URGENTE] **${o.name}** — ${formatCurrency(o.totalPrice)} — por ${user?.username || o.userId}`;
  });

  return {
    answer: `**Entregas de hoje:** ${todayOrders.length}\n\n${lines.join('\n')}`,
    data: { count: todayOrders.length, orders: todayOrders },
    type: 'list',
  };
}

/** Entregas atrasadas */
function queryLateDeliveries(): AssistantResponse {
  const orders = orderData.getAll().filter(o => o.status === 'completed' && o.deliveryDate && !o.delivered);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const lateOrders = orders.filter(o => new Date(o.deliveryDate! + 'T12:00:00') < today);

  if (lateOrders.length === 0) {
    return { answer: 'Nenhum pedido atrasado! Tudo em dia!', type: 'text' };
  }

  const users = userData.getAll();
  const lines = lateOrders.map(o => {
    const user = users.find(u => u.id === o.userId);
    const delivery = new Date(o.deliveryDate! + 'T12:00:00');
    const diffDays = Math.ceil((today.getTime() - delivery.getTime()) / (1000 * 60 * 60 * 24));
    return `  [URGENTE] **${o.name}** — atrasado ${diffDays} dia(s) — entrega era ${delivery.toLocaleDateString('pt-BR')} — ${formatCurrency(o.totalPrice)}`;
  });

  return {
    answer: `**Pedidos atrasados:** ${lateOrders.length}\n\n${lines.join('\n')}`,
    data: { count: lateOrders.length, orders: lateOrders },
    type: 'list',
  };
}

/** Orçamentos de hoje */
function queryTodayQuotes(): AssistantResponse {
  const quotes = quoteData.getAll();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayQuotes = quotes.filter(q => new Date(q.createdAt) >= todayStart);

  if (todayQuotes.length === 0) {
    return { answer: 'Nenhum orçamento criado hoje.', type: 'text' };
  }

  const lines = todayQuotes.map(q => {
    const user = userData.getById(q.userId);
    const sl = q.status === 'draft' ? 'Rascunho' : q.status === 'sent' ? 'Enviado' : q.status === 'approved' ? 'Aprovado' : q.status === 'converted' ? 'Convertido' : 'Rejeitado';
    return `  ${sl} ${q.name} — ${q.customerName} — ${formatCurrency(q.totalPrice)} — por ${user?.username || q.userId}`;
  });

  return {
    answer: `**Orçamentos de hoje:** ${todayQuotes.length}\n\n${lines.join('\n')}`,
    data: { count: todayQuotes.length, quotes: todayQuotes },
    type: 'list',
  };
}

/** Resumo geral do sistema */
function querySystemSummary(): AssistantResponse {
  const products = productData.getAll();
  const variables = variableData.getAll();
  const orders = orderData.getAll();
  const quotes = quoteData.getAll();
  const users = userData.getAll();
  const finance = getFinanceSummary();
  const alerts = getStockAlertsByLevel();

  const completed = orders.filter(o => o.status === 'completed');
  const pendingDelivery = completed.filter(o => o.deliveryDate && !o.delivered);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lateDeliveries = pendingDelivery.filter(o => new Date(o.deliveryDate! + 'T12:00:00') < today);

  const deliveryLine = pendingDelivery.length > 0
    ? `\n${lateDeliveries.length > 0 ? `[URGENTE] ${lateDeliveries.length} entrega(s) atrasada(s) — ` : ''}${pendingDelivery.length} entrega(s) pendente(s)`
    : '';

  return {
    answer: `**Resumo do Elitium:**\n\n${products.length} produtos — ${variables.length} variações\n${orders.length} pedidos (${completed.length} finalizados)\n${quotes.length} orçamentos (${quotes.filter(q => q.status === 'draft' || q.status === 'sent').length} pendentes)\n${users.length} usuários\nVendas: ${formatCurrency(finance.totalSales)} — Lucro: ${formatCurrency(finance.profit)}\n${alerts.critical.length} estoque crítico — ${alerts.watch.length} em atenção${deliveryLine}`,
    data: { products: products.length, variables: variables.length, orders: orders.length, quotes: quotes.length, users: users.length, finance },
    type: 'metric',
  };
}

// ==========================================
// COTAÇÃO DE PREÇO VIA PATTERN MATCHING
// ==========================================

/**
 * Extrai parâmetros de cotação de uma pergunta em linguagem natural.
 * Funciona sem Ollama — usa regex para parsear números e palavras-chave.
 */
function extractQuoteParams(question: string): {
  quantity: number;
  material?: string;
  color?: string;
  width?: number;
  height?: number;
  logoColors?: number;
  printType?: string;
  printSize?: string;
  printPosition?: string;
} | null {
  const q = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Extrair quantidade (primeiro número grande encontrado)
  const qtyMatch = q.match(/(\d+)\s*(sacola|bolsa|unidade|pca|pç|pecas?|units?)/);
  const qtyFallback = q.match(/(?:quanto|preco|preço|custa|custaria|fazer|produzir|fabricar)\D{0,30}?(\d{2,})/);
  const quantity = qtyMatch ? parseInt(qtyMatch[1]) : (qtyFallback ? parseInt(qtyFallback[1]) : 0);

  if (quantity < 1) return null;

  // Extrair material
  let material: string | undefined;
  if (q.includes('nylon')) material = 'nylon';
  else if (q.includes('tnt')) material = 'tnt';
  else if (q.includes('lona')) material = 'lona';
  else if (q.includes('algodao') || q.includes('algodão')) material = 'algodao';
  else if (q.includes('ecobag')) material = 'ecobag';
  else if (q.includes('couro') || q.includes('leather')) material = 'couro';

  // Extrair cor
  let color: string | undefined;
  const colorMap: Record<string, string> = {
    'vermelho': 'vermelho', 'red': 'vermelho',
    'azul': 'azul', 'blue': 'azul',
    'verde': 'verde', 'green': 'verde',
    'preto': 'preto', 'black': 'preto',
    'branco': 'branco', 'white': 'branco',
    'amarelo': 'amarelo', 'yellow': 'amarelo',
    'roxo': 'roxo', 'purple': 'roxo',
    'laranja': 'laranja', 'orange': 'laranja',
    'rosa': 'rosa', 'pink': 'rosa',
    'cinza': 'cinza', 'gray': 'cinza', 'grey': 'cinza',
    'marrom': 'marrom', 'brown': 'marrom',
  };
  for (const [keyword, value] of Object.entries(colorMap)) {
    if (q.includes(keyword)) { color = value; break; }
  }

  // Extrair dimensões (LxC, LxL, etc.)
  let width: number | undefined, height: number | undefined;
  const dimMatch = q.match(/(\d+)\s*[x×X]\s*(\d+)/);
  if (dimMatch) {
    width = parseInt(dimMatch[1]);
    height = parseInt(dimMatch[2]);
  }

  // Extrair cores da logo
  let logoColors: number | undefined;
  const logoMatch = q.match(/(\d+)\s*cores?\s*(da\s*)?logo/);
  const logoMatch2 = q.match(/logo\s*(de\s*)?(\d+)\s*cores?/);
  if (logoMatch) logoColors = parseInt(logoMatch[1]);
  else if (logoMatch2) logoColors = parseInt(logoMatch2[2]);

  // Extrair tipo de impressão
  let printType: string | undefined;
  if (q.includes('serigrafia') || q.includes('silk')) printType = 'serigrafia';
  else if (q.includes('sublimacao') || q.includes('sublimação')) printType = 'sublimacao';
  else if (q.includes('dtf')) printType = 'dtf';

  // Extrair tamanho da impressão
  let printSize: string | undefined;
  if (q.includes('pequen') || q.includes('small')) printSize = 'small';
  else if (q.includes('grand') || q.includes('large')) printSize = 'large';
  else if (q.includes('medio') || q.includes('médio') || q.includes('medium')) printSize = 'medium';

  // Extrair posição
  let printPosition: string | undefined;
  if (q.includes('frente') && q.includes('verso')) printPosition = 'both';
  else if (q.includes('verso') || q.includes('costas') || q.includes('back')) printPosition = 'back';
  else if (q.includes('frente') || q.includes('front')) printPosition = 'front';

  return { quantity, material, color, width, height, logoColors, printType, printSize, printPosition };
}

/** Calcula cotação de preço via pattern matching (sem Ollama) */
function queryPriceQuote(question: string): AssistantResponse {
  const params = extractQuoteParams(question);

  if (!params) {
    return {
      answer: 'Para calcular um preço, preciso de mais detalhes. Tente algo como:\n\n• "Quanto custa 500 sacolas TNT azuis?"\n• "Preço de 1000 nylon 30x40 com serigrafia"\n• "150 sacolas tnt amarelas com logo de 3 cores 65x95"',
      type: 'text',
    };
  }

  const products = productData.getAll();
  const groups = groupData.getAll();
  const variables = variableData.getAll();

  // Encontrar produto (pega o primeiro se não encontrar por nome)
  const product = products[0];
  if (!product) {
    return { answer: 'Nenhum produto cadastrado no sistema. Cadastre um produto primeiro.', type: 'text' };
  }

  const productGroups = groups.filter(g => g.productId === product!.id);
  const productVariables = variables.filter(v => productGroups.some(g => g.id === v.groupId));

  // Selecionar variáveis por material e cor
  const selectedVariables: { groupId: string; variableId: string; quantity: number }[] = [];
  const matchedNames: string[] = [];

  if (params.material) {
    const match = productVariables.find(v => v.name.toLowerCase().includes(params.material!));
    if (match) {
      selectedVariables.push({ groupId: match.groupId, variableId: match.id, quantity: params.quantity });
      matchedNames.push(match.name);
    }
  }

  if (params.color) {
    const match = productVariables.find(v =>
      v.name.toLowerCase().includes(params.color!) && !selectedVariables.some(sv => sv.variableId === v.id)
    );
    if (match) {
      selectedVariables.push({ groupId: match.groupId, variableId: match.id, quantity: params.quantity });
      matchedNames.push(match.name);
    }
  }

  // Se não encontrou variáveis, pega a primeira de cada grupo
  if (selectedVariables.length === 0) {
    for (const group of productGroups) {
      const firstVar = variables.find(v => v.groupId === group.id);
      if (firstVar) {
        selectedVariables.push({ groupId: group.id, variableId: firstVar.id, quantity: params.quantity });
        matchedNames.push(firstVar.name);
      }
    }
  }

  // Montar input para o motor de preços
  const pricingInput: PricingInput = {
    productId: product.id,
    selectedVariables,
    quantity: params.quantity,
    logoColors: params.logoColors || 1,
    dimensions: params.width && params.height ? { width: params.width, height: params.height } : undefined,
    printType: params.printType || undefined,
    printSize: (params.printSize as 'small' | 'medium' | 'large') || undefined,
    printPosition: (params.printPosition as 'front' | 'back' | 'both') || undefined,
  };

  try {
    const pricing = calculateItemPricing(pricingInput);

    const lines: string[] = [];
    lines.push(`**Orçamento — ${product.name}**`);
    lines.push('');
    lines.push(`**${params.quantity} unidades**`);

    if (matchedNames.length > 0) {
      lines.push(`Variáveis: ${matchedNames.join(', ')}`);
    }

    if (params.width && params.height) {
      lines.push(`Dimensão: ${params.width}×${params.height}cm`);
    }

    if (params.logoColors && params.logoColors > 1) {
      lines.push(`Logo: ${params.logoColors} cores`);
    }

    if (params.printType) {
      const printLabel = params.printType === 'serigrafia' ? 'Serigrafia' :
        params.printType === 'sublimacao' ? 'Sublimação' : 'DTF';
      lines.push(`Impressão: ${printLabel}${params.printSize ? ` (${params.printSize})` : ''}${params.printPosition ? `, ${params.printPosition === 'both' ? 'frente e verso' : params.printPosition === 'back' ? 'verso' : 'frente'}` : ''}`);
    }

    lines.push('');
    lines.push(`**Preço unitário: R$ ${pricing.unitPrice.toFixed(2)}**`);
    lines.push(`**Total: R$ ${pricing.totalPrice.toFixed(2)}**`);
    lines.push(`Margem: R$ ${pricing.margin.toFixed(2)}`);
    lines.push('');
    lines.push(`_${pricing.breakdown}_`);
    lines.push('');
    lines.push('Para criar um orçamento formal, acesse **Orçamentos > Novo orçamento**.');

    return { answer: lines.join('\n'), type: 'metric', data: pricing };
  } catch (error) {
    return {
      answer: `Erro ao calcular preço: ${error instanceof Error ? error.message : 'Verifique se o produto e variáveis estão cadastrados corretamente.'}`,
      type: 'text',
    };
  }
}

/** Ajuda */
function queryHelp(): AssistantResponse {
  return {
    answer: `**Assistente ${globalConfig.systemName} — Perguntas suportadas:**\n\n**Vendas:**\n• "produto mais vendido"\n• "total de vendas"\n• "ticket medio"\n• "pedidos recentes"\n• "vendas por periodo"\n\n**Entregas:**\n• "entregas urgentes"\n• "entregas atrasadas"\n• "entrega hoje"\n• "proximas entregas"\n• "status entrega do [pedido]"\n\n**Orçamentos:**\n• "orcamentos pendentes"\n• "orcamento aprovado"\n• "taxa de conversao"\n• "orcamento de hoje"\n\n**Estoque:**\n• "estoque baixo"\n• "estoque alto"\n• "produtos cadastrados"\n\n**Financeiro:**\n• "lucro total"\n• "despesas"\n\n**Previsao:**\n• "previsao de demanda"\n\n**Outros:**\n• "usuarios"\n• "fornecedores"\n• "resumo do sistema"\n• "como usar"`,
    type: 'text',
  };
}

/** Como usar o sistema */
function queryHowToUse(): AssistantResponse {
  return {
    answer: `**Como usar o ${globalConfig.systemName}:**\n\n**1. Cadastre o estoque**\nAcesse Estoque no menu. Crie um produto base, depois crie grupos (ex: Material, Tamanho) e variáveis dentro de cada grupo (ex: Nylon, TNT, Pequeno, Grande). Cada variável tem seu proprio estoque.\n\n**2. Crie orçamentos**\nAcesse Orçamentos > Novo orçamento. Selecione o produto, variáveis, quantidade e configure impressão/dimensões. O preço é calculado automaticamente com tabelas por volume. Envie ao cliente e, quando aprovar, converta em pedido.\n\n**3. Registre pedidos**\nAcesse Pedidos > Criar pedido. Selecione o produto, escolha as variáveis e quantidades. O preco e calculado automaticamente com a margem de lucro. Voce pode adicionar varios itens ao carrinho.\n\n**4. Acompanhe o financeiro**\nToda venda gera um registro financeiro automaticamente. Acesse Financeiro para ver receita, despesas e lucro.\n\n**5. Faca compras**\nQuando o estoque estiver baixo, acesse Compras para registrar reposicao de fornecedores. O estoque e atualizado automaticamente.\n\n**6. Configuracoes**\nAdmin pode ajustar margem de lucro, tabelas de preço, regras de impressão e limites de alerta em Configuracoes.`,
    type: 'text',
  };
}

/** Não entendi a pergunta */
function queryFallback(): AssistantResponse {
  return {
    answer: `Nao entendi. Tente:\n\n• "produto mais vendido"\n• "estoque baixo"\n• "lucro total"\n• "pedidos recentes"\n• "previsao de demanda"\n\nDigite **"ajuda"** para ver todas as opcoes.`,
    type: 'text',
  };
}

// ==========================================
// MOTOR DE INTERPRETAÇÃO (Pattern Matching)
// ==========================================

/**
 * Detecta a intenção do usuário baseado em palavras-chave.
 * Retorna a primeira intenção que faz match.
 */
function detectIntent(question: string): () => AssistantResponse {
  const q = question;

  // Ajuda
  if (containsAny(q, 'ajuda', 'help', 'opcoes', 'opcoes', 'o que voce faz', 'o que vc faz', 'comandos')) {
    return queryHelp;
  }

  // Como usar
  if (containsAny(q, 'como usar', 'como funciona', 'tutorial', 'guia', 'como cadastrar', 'como fazer', 'como criar')) {
    return queryHowToUse;
  }

  // Cotação de preço (quanto custa, preço, valor)
  if (containsAny(q, 'quanto custa', 'quanto custaria', 'preco de', 'preço de', 'valor de', 'valor para',
    'quanto fica', 'quanto sai', 'quanto seria', 'custa', 'custaria',
    'fazer', 'produzir', 'fabricar') && containsAny(q, 'sacola', 'bolsa', 'unidade', 'tnt', 'nylon', 'lona')) {
    return () => queryPriceQuote(q);
  }

  // Cotação genérica com quantidade
  if (/\d{2,}\s*(sacola|bolsa|unidade|pca)/.test(q) && containsAny(q, 'quanto', 'preco', 'preço', 'valor', 'custa', 'custaria')) {
    return () => queryPriceQuote(q);
  }

  // Resumo geral
  if (containsAny(q, 'resumo', 'visao geral', 'visão geral', 'sistema', 'status do sistema') && !containsAny(q, 'venda', 'estoque')) {
    return querySystemSummary;
  }

  // Produto mais vendido
  if (containsAny(q, 'produto mais vendido', 'mais vendido', 'produto vendeu mais', 'produto popular', 'mais popular')) {
    return queryTopProducts;
  }

  // Estoque baixo / crítico
  if (containsAny(q, 'estoque baixo', 'estoque critico', 'estoque crítico', 'estoque alerta', 'falta estoque', 'sem estoque', 'reposicao', 'reposição')) {
    return queryLowStock;
  }

  // Estoque alto / maior estoque
  if (containsAny(q, 'estoque alto', 'maior estoque', 'mais estoque', 'estoque cheio')) {
    return queryHighStock;
  }

  // Lucro
  if (containsAny(q, 'lucro', 'profit', 'ganho')) {
    return queryProfit;
  }

  // Total de vendas
  if (containsAny(q, 'total de venda', 'total venda', 'quanto vendeu', 'receita total', 'receita')) {
    return queryTotalSales;
  }

  // Ticket médio
  if (containsAny(q, 'ticket medio', 'ticket médio', 'valor medio', 'valor médio', 'media pedido', 'média pedido')) {
    return queryTicketMedio;
  }

  // Vendas por período
  if (containsAny(q, 'venda hoje', 'venda semana', 'venda mes', 'venda mês', 'vendas por periodo', 'vendas por período', 'vendas hoje')) {
    return querySalesByPeriod;
  }

  // Pedidos recentes
  if (containsAny(q, 'pedido recente', 'ultimo pedido', 'último pedido', 'pedidos hoje', 'pedido de hoje', 'recente')) {
    return queryRecentOrders;
  }

  // Quantos pedidos
  if (containsAny(q, 'quantos pedido', 'total pedido', 'numero pedido', 'número pedido', 'contagem pedido')) {
    return queryOrderCount;
  }

  // Produtos cadastrados
  if (containsAny(q, 'produto cadastrado', 'lista produto', 'produto disponivel', 'produto disponível', 'listar produto', 'todos produto')) {
    return queryProducts;
  }

  // Previsão de demanda
  if (containsAny(q, 'previsao', 'previsão', 'demanda', 'tendencia', 'tendência')) {
    return queryDemandForecast;
  }

  // Usuários
  if (containsAny(q, 'usuario', 'usuário', 'usuarios', 'usuários', 'quem usa', 'conta')) {
    return queryUsers;
  }

  // Usuário mais ativo
  if (containsAny(q, 'usuario mais ativo', 'usuário mais ativo', 'quem fez mais', 'mais pedido', 'vendedor')) {
    return queryMostActiveUser;
  }

  // Fornecedores
  if (containsAny(q, 'fornecedor', 'supplier')) {
    return querySuppliers;
  }

  // Pedidos de compra
  if (containsAny(q, 'pedido compra', 'pedido de compra', 'compra fornecedor', 'purchase order')) {
    return queryPurchaseOrders;
  }

  // Despesas
  if (containsAny(q, 'despesa', 'gasto', 'compra', 'expense')) {
    return queryExpenses;
  }

  // Orçamentos pendentes
  if (containsAny(q, 'orcamento pendente', 'orçamento pendente', 'orcamento rascunho', 'orcamento enviado', 'orcamento esperando', 'quote pending', 'quote draft')) {
    return queryPendingQuotes;
  }

  // Taxa de conversão de orçamentos
  if (containsAny(q, 'taxa de conversao', 'taxa de conversão', 'conversao orcamento', 'conversão orçamento', 'orcamento convertido', 'orçamento convertido', 'quote conversion')) {
    return queryQuoteConversion;
  }

  // Orçamentos de hoje
  if (containsAny(q, 'orcamento hoje', 'orçamento hoje', 'orcamento de hoje', 'orçamento de hoje', 'quote today')) {
    return queryTodayQuotes;
  }

  // Entregas urgentes / atrasadas
  if (containsAny(q, 'entrega urgente', 'entrega atrasada', 'entregas atrasadas', 'pedido atrasado', 'pedidos atrasados', 'atrasado', 'atrasada', 'atraso')) {
    return queryUrgentDeliveries;
  }

  // Entregas de hoje
  if (containsAny(q, 'entrega hoje', 'entregas hoje', 'entregar hoje', 'entrega do dia')) {
    return queryTodayDeliveries;
  }

  // Entregas da semana / próximas entregas
  if (containsAny(q, 'proxima entrega', 'próxima entrega', 'proximas entregas', 'próximas entregas', 'entrega semana', 'entregas semana', 'entregas pendentes', 'entrega pendente')) {
    return queryUrgentDeliveries;
  }

  // Status de entrega de pedido específico
  if (containsAny(q, 'status entrega', 'status de entrega', 'quando entrega', 'quando chega', 'previsao entrega', 'previsão entrega', 'data entrega', 'quando é entrega', 'pedido entrega')) {
    return () => queryOrderDelivery(q);
  }

  // Entregas (genérico)
  if (containsAny(q, 'entrega', 'entregas', 'entregar', 'delivery')) {
    return queryUrgentDeliveries;
  }

  // Orçamentos (genérico)
  if (containsAny(q, 'orcamento', 'orçamento', 'quote', 'cotacao', 'cotação')) {
    return queryQuoteConversion;
  }

  // Fallback
  return queryFallback;
}

// ==========================================
// FUNÇÃO PRINCIPAL — PROCESSA PERGUNTA
// ==========================================

/**
 * Processa uma pergunta do usuário e retorna a resposta.
 * Esta é a função chamada pela API.
 */
export function processQuestion(question: string): AssistantResponse {
  const handler = detectIntent(question);
  return handler();
}
