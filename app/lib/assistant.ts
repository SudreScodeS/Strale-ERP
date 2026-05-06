// lib/assistant.ts
// Assistente inteligente LOCAL — sem APIs externas, sem ChatGPT
// Interpreta perguntas em linguagem natural e responde com dados reais do sistema
// Arquitetura: Pattern matching + funções de consulta tipadas

import { productData, variableData, groupData, orderData, financeData, userData, supplierData, purchaseOrderData } from './data';
import { getFinanceSummary, getStockAlertsByLevel } from './business';
import { getDemandForecastSummary } from './demand-forecast';
import { globalConfig } from '../../config/global';

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
    lines.push('🔴 **Estoque CRÍTICO:**');
    for (const v of alerts.critical) {
      const group = groups.find(g => g.id === v.groupId);
      lines.push(`  • **${v.name}** (${group?.name || 'Sem grupo'}) — ${v.stock} unidades restantes`);
    }
  }

  if (alerts.watch.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('🟡 **Estoque em ATENÇÃO:**');
    for (const v of alerts.watch) {
      const group = groups.find(g => g.id === v.groupId);
      lines.push(`  • **${v.name}** (${group?.name || 'Sem grupo'}) — ${v.stock} unidades`);
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
    const totalStock = pVariables.reduce((sum, v) => sum + v.stock, 0);
    return `• **${p.name}** — ${formatCurrency(p.basePrice)} base — ${pGroups.length} grupos, ${pVariables.length} variações — Estoque total: ${totalStock}`;
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
    lines.push('🔴 **Risco alto de falta:**');
    for (const f of forecast.criticalRisk) {
      lines.push(`  • ${f.variableName} — ${f.currentStock} em estoque, demanda média: ${f.avgWeeklyDemand}/sem — ${f.riskLabel}`);
    }
    lines.push('');
  }

  if (forecast.watchRisk.length > 0) {
    lines.push('🟡 **Em atenção:**');
    for (const f of forecast.watchRisk) {
      lines.push(`  • ${f.variableName} — ${f.currentStock} em estoque, demanda: ${f.avgWeeklyDemand}/sem`);
    }
    lines.push('');
  }

  if (forecast.highDemand.length > 0) {
    lines.push('🔥 **Alta demanda:**');
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
    return `• **${v.name}** (${group?.name || '?'}) — ${v.stock} unidades`;
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

/** Resumo geral do sistema */
function querySystemSummary(): AssistantResponse {
  const products = productData.getAll();
  const variables = variableData.getAll();
  const orders = orderData.getAll();
  const users = userData.getAll();
  const finance = getFinanceSummary();
  const alerts = getStockAlertsByLevel();

  return {
    answer: `**Resumo do Strale ERP:**\n\n${products.length} produtos — ${variables.length} variações\n${orders.length} pedidos (${orders.filter(o => o.status === 'completed').length} finalizados)\n${users.length} usuários\nVendas: ${formatCurrency(finance.totalSales)} — Lucro: ${formatCurrency(finance.profit)}\n${alerts.critical.length} estoque crítico — ${alerts.watch.length} em atenção`,
    data: { products: products.length, variables: variables.length, orders: orders.length, users: users.length, finance },
    type: 'metric',
  };
}

/** Ajuda */
function queryHelp(): AssistantResponse {
  return {
    answer: `**Assistente ${globalConfig.systemName} — Perguntas suportadas:**\n\n**Vendas:**\n• "produto mais vendido"\n• "total de vendas"\n• "ticket medio"\n• "pedidos recentes"\n• "vendas por periodo"\n\n**Estoque:**\n• "estoque baixo"\n• "estoque alto"\n• "produtos cadastrados"\n\n**Financeiro:**\n• "lucro total"\n• "despesas"\n\n**Previsao:**\n• "previsao de demanda"\n\n**Outros:**\n• "usuarios"\n• "fornecedores"\n• "resumo do sistema"\n• "como usar"`,
    type: 'text',
  };
}

/** Como usar o sistema */
function queryHowToUse(): AssistantResponse {
  return {
    answer: `**Como usar o ${globalConfig.systemName}:**\n\n**1. Cadastre o estoque**\nAcesse Estoque no menu. Crie um produto base, depois crie grupos (ex: Material, Tamanho) e variáveis dentro de cada grupo (ex: Nylon, TNT, Pequeno, Grande). Cada variável tem seu proprio estoque.\n\n**2. Registre pedidos**\nAcesse Pedidos > Criar pedido. Selecione o produto, escolha as variáveis e quantidades. O preco e calculado automaticamente com a margem de lucro. Voce pode adicionar varios itens ao carrinho.\n\n**3. Acompanhe o financeiro**\nToda venda gera um registro financeiro automaticamente. Acesse Financeiro para ver receita, despesas e lucro.\n\n**4. Faca compras**\nQuando o estoque estiver baixo, acesse Compras para registrar reposicao de fornecedores. O estoque e atualizado automaticamente.\n\n**5. Configuracoes**\nAdmin pode ajustar margem de lucro, preco da logo e limites de alerta em Configuracoes.`,
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

  // Resumo geral
  if (containsAny(q, 'resumo', 'visao geral', 'visão geral', 'sistema', 'status do sistema') && !containsAny(q, 'fraude', 'venda', 'estoque')) {
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
