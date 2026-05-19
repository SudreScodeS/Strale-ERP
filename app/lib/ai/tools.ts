// lib/ai/tools.ts
// Tool definitions for LLM function calling + implementations that query real ERP data.

import { productData, variableData, groupData, orderData, financeData, userData, supplierData, purchaseOrderData, quoteData } from '../data';
import { getFinanceSummary, getStockAlertsByLevel, getOrcamentosStats } from '../business';
import { getDemandForecastSummary } from '../demand-forecast';
import { calculateItemPricing, type PricingInput } from '../pricing';
import type { ToolDefinition } from './ollama-client';

// ── Formatters ─────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Tool Definitions (sent to LLM) ────────────────────────────

export const toolDefinitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_sales_summary',
      description: 'Retorna resumo de vendas: total, quantidade de pedidos, ticket médio, vendas por período (hoje, 7 dias, mês).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stock_alerts',
      description: 'Retorna itens com estoque baixo (crítico) e em atenção, com quantidades e grupos.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_summary',
      description: 'Retorna resumo financeiro: receita total, despesas, lucro.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_orders',
      description: 'Retorna os últimos pedidos com nome, valor, status, data e criador. Aceita limite opcional.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Quantidade de pedidos (padrão: 5)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_products',
      description: 'Lista todos os produtos cadastrados com preços, grupos, variações e estoque.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_delivery_status',
      description: 'Retorna pedidos com entrega pendente, atrasados, e status de entrega. Úrgencias primeiro.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_quotes',
      description: 'Retorna orçamentos: pendentes, enviados, convertidos, taxa de conversão.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_users',
      description: 'Lista usuários com quantidade de pedidos e total de vendas.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_demand_forecast',
      description: 'Retorna previsão de demanda: risco de falta, tendência, sugestões de reposição.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_suppliers',
      description: 'Lista fornecedores cadastrados com contato.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_price',
      description: 'Calcula preço de uma venda. Use quando o usuário perguntar "quanto custa" ou pedir um orçamento.',
      parameters: {
        type: 'object',
        properties: {
          quantity: { type: 'number', description: 'Quantidade de unidades' },
          material: { type: 'string', description: 'Material (nylon, tnt, lona, algodao, ecobag)' },
          color: { type: 'string', description: 'Cor mencionada' },
          width: { type: 'number', description: 'Largura em cm' },
          height: { type: 'number', description: 'Altura em cm' },
          logoColors: { type: 'number', description: 'Quantidade de cores da logo (padrão: 1)' },
          printType: { type: 'string', description: 'Tipo de impressão: serigrafia, sublimacao, dtf' },
          printSize: { type: 'string', description: 'Tamanho: small, medium, large' },
          printPosition: { type: 'string', description: 'Posição: front, back, both' },
        },
        required: ['quantity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_system_summary',
      description: 'Retorna resumo geral do sistema: contagens de produtos, pedidos, usuários, financeiro, alertas.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ── Tool Implementations ───────────────────────────────────────

function execGetSalesSummary(): string {
  const orders = orderData.getAll().filter((o) => o.status === 'completed');
  const finance = getFinanceSummary();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getTime() - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const today = orders.filter((o) => new Date(o.createdAt) >= todayStart);
  const week = orders.filter((o) => new Date(o.createdAt) >= weekStart);
  const month = orders.filter((o) => new Date(o.createdAt) >= monthStart);
  const sum = (arr: typeof orders) => arr.reduce((s, o) => s + o.totalPrice, 0);

  return JSON.stringify({
    totalSales: fmtCurrency(finance.totalSales),
    totalOrders: orders.length,
    avgTicket: orders.length > 0 ? fmtCurrency(finance.totalSales / orders.length) : 'N/A',
    today: { count: today.length, total: fmtCurrency(sum(today)) },
    last7days: { count: week.length, total: fmtCurrency(sum(week)) },
    thisMonth: { count: month.length, total: fmtCurrency(sum(month)) },
  });
}

function execGetStockAlerts(): string {
  const alerts = getStockAlertsByLevel();
  const groups = groupData.getAll();

  const mapVar = (v: { name: string; groupId: string; stock: number }) => {
    const group = groups.find((g) => g.id === v.groupId);
    return { name: v.name, group: group?.name || '?', stock: v.stock };
  };

  return JSON.stringify({
    critical: alerts.critical.map(mapVar),
    watch: alerts.watch.map(mapVar),
    criticalCount: alerts.critical.length,
    watchCount: alerts.watch.length,
  });
}

function execGetFinancialSummary(): string {
  const f = getFinanceSummary();
  return JSON.stringify({
    totalSales: fmtCurrency(f.totalSales),
    totalExpenses: fmtCurrency(f.totalExpenses),
    profit: fmtCurrency(f.profit),
    margin: f.totalSales > 0 ? `${((f.profit / f.totalSales) * 100).toFixed(1)}%` : '0%',
  });
}

function execGetRecentOrders(args: { limit?: number }): string {
  const limit = args.limit ?? 5;
  const orders = orderData.getAll().filter((o) => o.status === 'completed');
  const users = userData.getAll();
  const recent = orders.slice(-limit).reverse().map((o) => ({
    id: o.id,
    name: o.name,
    totalPrice: fmtCurrency(o.totalPrice),
    status: o.status,
    createdByName: users.find((u) => u.id === o.userId)?.username || o.userId,
    createdAt: fmtDate(o.createdAt),
    deliveryDate: o.deliveryDate || null,
    delivered: o.delivered || false,
  }));
  return JSON.stringify({ orders: recent, total: orders.length });
}

function execGetProducts(): string {
  const products = productData.getAll();
  const groups = groupData.getAll();
  const variables = variableData.getAll();

  const result = products.map((p) => {
    const pGroups = groups.filter((g) => g.productId === p.id);
    const pVars = variables.filter((v) => pGroups.some((g) => g.id === v.groupId));
    return {
      name: p.name,
      basePrice: fmtCurrency(p.basePrice),
      groups: pGroups.length,
      variables: pVars.length,
      totalStock: pVars.reduce((s, v) => s + v.stock, 0),
    };
  });

  return JSON.stringify({ products: result, total: products.length });
}

function execGetDeliveryStatus(): string {
  const orders = orderData.getAll().filter((o) => o.status === 'completed');
  const users = userData.getAll();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const pending = orders.filter((o) => o.deliveryDate && !o.delivered);
  const late = pending.filter((o) => new Date(o.deliveryDate + 'T12:00:00') < today);
  const todayDel = pending.filter((o) => o.deliveryDate === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  const delivered = orders.filter((o) => o.delivered);

  const mapOrder = (o: typeof orders[0]) => {
    const user = users.find((u) => u.id === o.userId);
    const delivery = new Date(o.deliveryDate + 'T12:00:00');
    const diffDays = Math.ceil((delivery.getTime() - today.getTime()) / 86400000);
    return {
      name: o.name,
      id: o.id,
      totalPrice: fmtCurrency(o.totalPrice),
      deliveryDate: o.deliveryDate,
      daysUntilDelivery: diffDays,
      createdBy: user?.username || o.userId,
    };
  };

  return JSON.stringify({
    late: late.map(mapOrder),
    today: todayDel.map(mapOrder),
    pending: pending.filter((o) => !late.includes(o) && !todayDel.includes(o)).map(mapOrder),
    deliveredCount: delivered.length,
  });
}

function execGetQuotes(): string {
  const stats = getOrcamentosStats();
  const quotes = quoteData.getAll();
  const pending = quotes.filter((q) => q.status === 'draft' || q.status === 'sent');

  return JSON.stringify({
    ...stats,
    pending: pending.map((q) => ({
      name: q.name,
      customer: q.customerName,
      totalPrice: fmtCurrency(q.totalPrice),
      status: q.status,
      validUntil: q.validUntil ? fmtDate(q.validUntil) : null,
    })),
  });
}

function execGetUsers(): string {
  const users = userData.getAll();
  const orders = orderData.getAll().filter((o) => o.status === 'completed');

  const result = users.map((u) => {
    const userOrders = orders.filter((o) => o.userId === u.id);
    return {
      username: u.username,
      role: u.role,
      orderCount: userOrders.length,
      totalSales: fmtCurrency(userOrders.reduce((s, o) => s + o.totalPrice, 0)),
    };
  });

  return JSON.stringify({ users: result, total: users.length });
}

function execGetDemandForecast(): string {
  try {
    const f = getDemandForecastSummary();
    return JSON.stringify({
      criticalRisk: f.criticalRisk.map((x) => ({ name: x.variableName, stock: x.currentStock, demand: x.avgWeeklyDemand })),
      watchRisk: f.watchRisk.map((x) => ({ name: x.variableName, stock: x.currentStock, demand: x.avgWeeklyDemand })),
      highDemand: f.highDemand.map((x) => ({ name: x.variableName, demand: x.avgWeeklyDemand, trend: x.trend })),
      accuracy: f.forecastAccuracy,
    });
  } catch {
    return JSON.stringify({ error: 'Forecast data unavailable' });
  }
}

function execGetSuppliers(): string {
  const suppliers = supplierData.getAll();
  return JSON.stringify({
    suppliers: suppliers.map((s) => ({ name: s.name, contact: s.contact || 'N/A' })),
    total: suppliers.length,
  });
}

function execCalculatePrice(args: {
  quantity: number;
  material?: string;
  color?: string;
  width?: number;
  height?: number;
  logoColors?: number;
  printType?: string;
  printSize?: string;
  printPosition?: string;
}): string {
  const products = productData.getAll();
  const groups = groupData.getAll();
  const variables = variableData.getAll();

  const product = products[0];
  if (!product) return JSON.stringify({ error: 'Nenhum produto cadastrado.' });

  const productGroups = groups.filter((g) => g.productId === product.id);
  const productVars = variables.filter((v) => productGroups.some((g) => g.id === v.groupId));

  const selectedVariables: { groupId: string; variableId: string; quantity: number }[] = [];
  const matchedNames: string[] = [];

  if (args.material) {
    const match = productVars.find((v) => v.name.toLowerCase().includes(args.material!.toLowerCase()));
    if (match) {
      selectedVariables.push({ groupId: match.groupId, variableId: match.id, quantity: args.quantity });
      matchedNames.push(match.name);
    }
  }
  if (args.color) {
    const match = productVars.find((v) => v.name.toLowerCase().includes(args.color!.toLowerCase()) && !selectedVariables.some((sv) => sv.variableId === v.id));
    if (match) {
      selectedVariables.push({ groupId: match.groupId, variableId: match.id, quantity: args.quantity });
      matchedNames.push(match.name);
    }
  }

  if (selectedVariables.length === 0) {
    for (const group of productGroups) {
      const firstVar = variables.find((v) => v.groupId === group.id);
      if (firstVar) {
        selectedVariables.push({ groupId: group.id, variableId: firstVar.id, quantity: args.quantity });
        matchedNames.push(firstVar.name);
      }
    }
  }

  const pricingInput: PricingInput = {
    productId: product.id,
    selectedVariables,
    quantity: args.quantity,
    logoColors: args.logoColors ?? 1,
    dimensions: args.width && args.height ? { width: args.width, height: args.height } : undefined,
    printType: args.printType || undefined,
    printSize: (args.printSize as 'small' | 'medium' | 'large') || undefined,
    printPosition: (args.printPosition as 'front' | 'back' | 'both') || undefined,
  };

  try {
    const pricing = calculateItemPricing(pricingInput);
    return JSON.stringify({
      product: product.name,
      quantity: args.quantity,
      variables: matchedNames,
      unitPrice: fmtCurrency(pricing.unitPrice),
      totalPrice: fmtCurrency(pricing.totalPrice),
      margin: fmtCurrency(pricing.margin),
      breakdown: pricing.breakdown,
    });
  } catch (err) {
    return JSON.stringify({ error: `Erro ao calcular: ${err instanceof Error ? err.message : 'unknown'}` });
  }
}

function execGetSystemSummary(): string {
  const products = productData.getAll();
  const variables = variableData.getAll();
  const orders = orderData.getAll();
  const quotes = quoteData.getAll();
  const users = userData.getAll();
  const finance = getFinanceSummary();
  const alerts = getStockAlertsByLevel();

  return JSON.stringify({
    products: products.length,
    variables: variables.length,
    orders: orders.length,
    completedOrders: orders.filter((o) => o.status === 'completed').length,
    quotes: quotes.length,
    pendingQuotes: quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length,
    users: users.length,
    totalSales: fmtCurrency(finance.totalSales),
    profit: fmtCurrency(finance.profit),
    criticalStock: alerts.critical.length,
    watchStock: alerts.watch.length,
  });
}

// ── Dispatcher ─────────────────────────────────────────────────

const handlers: Record<string, (args: Record<string, unknown>) => string> = {
  get_sales_summary: () => execGetSalesSummary(),
  get_stock_alerts: () => execGetStockAlerts(),
  get_financial_summary: () => execGetFinancialSummary(),
  get_recent_orders: (a) => execGetRecentOrders({ limit: a.limit as number | undefined }),
  get_products: () => execGetProducts(),
  get_delivery_status: () => execGetDeliveryStatus(),
  get_quotes: () => execGetQuotes(),
  get_users: () => execGetUsers(),
  get_demand_forecast: () => execGetDemandForecast(),
  get_suppliers: () => execGetSuppliers(),
  calculate_price: (a) => execCalculatePrice(a as unknown as Parameters<typeof execCalculatePrice>[0]),
  get_system_summary: () => execGetSystemSummary(),
};

/**
 * Execute a tool call from the LLM and return the result string.
 */
export function executeTool(name: string, args: Record<string, unknown>): string {
  const handler = handlers[name];
  if (!handler) return JSON.stringify({ error: `Unknown tool: ${name}` });
  try {
    return handler(args);
  } catch (err) {
    console.error(`[ai:tool] Error in ${name}:`, err);
    return JSON.stringify({ error: `Erro ao executar ${name}` });
  }
}
