// app/lib/ai/actions.ts
// Action Registry — enables the assistant to execute real ERP operations.
// Each action validates params, calls business logic, and returns structured results.

import { v4 as uuidv4 } from 'uuid';
import { productData, variableData, groupData, orderData, quoteData, supplierData, financeData } from '../data';
import { getFinanceSummary, getStockAlertsByLevel, getOrcamentosStats } from '../business';
import { calculateItemPricing, type PricingInput } from '../pricing';
import { activityLogData } from '../data';

// ── Types ──────────────────────────────────────────────────────

interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  enum?: string[];
}

interface ActionDefinition {
  name: string;
  description: string;
  category: 'query' | 'mutation' | 'generation';
  parameters: ActionParameter[];
  requiredRoles: ('admin' | 'seller')[];
  handler: (params: Record<string, unknown>, context: ActionContext) => Promise<ActionResult>;
}

interface ActionContext {
  userId: string;
  userRole: 'admin' | 'seller';
}

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
  shouldStream?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function validateParams(
  params: Record<string, unknown>,
  definition: ActionDefinition,
): string | null {
  for (const param of definition.parameters) {
    if (param.required && (params[param.name] === undefined || params[param.name] === null || params[param.name] === '')) {
      return `Parâmetro obrigatório ausente: ${param.name} (${param.description})`;
    }
    if (params[param.name] !== undefined && params[param.name] !== null) {
      const val = params[param.name];
      if (param.enum && typeof val === 'string' && !param.enum.includes(val)) {
        return `Valor inválido para ${param.name}: "${val}". Valores aceitos: ${param.enum.join(', ')}`;
      }
    }
  }
  return null;
}

function logAction(actionName: string, context: ActionContext, params: Record<string, unknown>, result: ActionResult) {
  console.log(
    `[ai:action] ${actionName} by ${context.userId} (${context.userRole}) → ${result.success ? 'OK' : 'FAIL'}: ${result.message}`,
  );
}

// ── Action Definitions ─────────────────────────────────────────

const actions: ActionDefinition[] = [
  // 1. create_quote
  {
    name: 'create_quote',
    description: 'Cria um novo orçamento para um cliente',
    category: 'mutation',
    parameters: [
      { name: 'customerName', type: 'string', description: 'Nome do cliente', required: true },
      { name: 'name', type: 'string', description: 'Nome/descrição do orçamento', required: false },
      { name: 'items', type: 'array', description: 'Itens do orçamento (productId, quantity, variableId)', required: true },
      { name: 'validDays', type: 'number', description: 'Dias de validade (padrão: 15)', required: false },
    ],
    requiredRoles: ['admin', 'seller'],
    handler: async (params, context) => {
      const validation = validateParams(params, actions.find(a => a.name === 'create_quote')!);
      if (validation) return { success: false, message: validation };

      try {
        const items = params.items as Array<{ productId: string; quantity: number; variableId?: string }>;
        if (!Array.isArray(items) || items.length === 0) {
          return { success: false, message: 'Itens do orçamento são obrigatórios e devem ser um array.' };
        }

        let totalPrice = 0;
        const quoteItems: Array<{
          productId: string;
          selectedVariables: { groupId: string; variableId: string; quantity: number }[];
          quantity: number;
          unitPrice: number;
        }> = [];

        for (const item of items) {
          const product = productData.getById(item.productId);
          if (!product) return { success: false, message: `Produto não encontrado: ${item.productId}` };

          const groups = groupData.getAll().filter(g => g.productId === item.productId);
          const selectedVariables: { groupId: string; variableId: string; quantity: number }[] = [];

          if (item.variableId) {
            const variable = variableData.getAll().find(v => v.id === item.variableId);
            if (variable) {
              selectedVariables.push({
                groupId: variable.groupId,
                variableId: variable.id,
                quantity: item.quantity,
              });
            }
          } else {
            // Use first variable from each group
            for (const group of groups) {
              const firstVar = variableData.getAll().find(v => v.groupId === group.id);
              if (firstVar) {
                selectedVariables.push({
                  groupId: group.id,
                  variableId: firstVar.id,
                  quantity: item.quantity,
                });
              }
            }
          }

          const pricingInput: PricingInput = {
            productId: item.productId,
            selectedVariables,
            quantity: item.quantity,
            logoColors: 1,
          };

          const pricing = calculateItemPricing(pricingInput);
          totalPrice += pricing.totalPrice;

          quoteItems.push({
            productId: item.productId,
            selectedVariables,
            quantity: item.quantity,
            unitPrice: pricing.unitPrice,
          });
        }

        const validDays = (params.validDays as number) || 15;
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + validDays);

        const quote = {
          id: uuidv4(),
          userId: context.userId,
          customerName: params.customerName as string,
          name: (params.name as string) || `Orçamento para ${params.customerName}`,
          items: quoteItems,
          totalPrice,
          status: 'draft' as const,
          validUntil: validUntil.toISOString(),
          createdAt: new Date(),
        };

        quoteData.create(quote);

        return {
          success: true,
          message: `✅ Orçamento criado para ${params.customerName} — Total: ${fmtCurrency(totalPrice)} — Válido até ${fmtDate(validUntil)}`,
          data: { quoteId: quote.id, totalPrice, customerName: params.customerName },
        };
      } catch (err) {
        return { success: false, message: `Erro ao criar orçamento: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
      }
    },
  },

  // 2. update_order_status
  {
    name: 'update_order_status',
    description: 'Atualiza o status de um pedido',
    category: 'mutation',
    parameters: [
      { name: 'orderId', type: 'string', description: 'ID do pedido', required: true },
      { name: 'status', type: 'string', description: 'Novo status', required: true, enum: ['pending', 'completed', 'cancelled'] },
      { name: 'delivered', type: 'boolean', description: 'Marcar como entregue', required: false },
    ],
    requiredRoles: ['admin', 'seller'],
    handler: async (params, context) => {
      const validation = validateParams(params, actions.find(a => a.name === 'update_order_status')!);
      if (validation) return { success: false, message: validation };

      try {
        const order = orderData.getAll().find(o => o.id === params.orderId);
        if (!order) return { success: false, message: `Pedido #${params.orderId} não encontrado.` };

        const updates: Record<string, unknown> = { status: params.status };
        if (params.delivered === true) {
          updates.delivered = true;
          updates.deliveredAt = new Date().toISOString();
        }

        orderData.update(params.orderId as string, updates);

        const statusLabels: Record<string, string> = {
          pending: 'pendente',
          completed: 'concluído',
          cancelled: 'cancelado',
        };

        return {
          success: true,
          message: `✅ Pedido #${order.id} atualizado para "${statusLabels[params.status as string] || params.status}"${params.delivered ? ' — marcado como entregue' : ''}`,
          data: { orderId: order.id, newStatus: params.status },
        };
      } catch (err) {
        return { success: false, message: `Erro ao atualizar pedido: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
      }
    },
  },

  // 3. create_product
  {
    name: 'create_product',
    description: 'Cria um novo produto no catálogo',
    category: 'mutation',
    parameters: [
      { name: 'name', type: 'string', description: 'Nome do produto', required: true },
      { name: 'basePrice', type: 'number', description: 'Preço base do produto', required: true },
      { name: 'description', type: 'string', description: 'Descrição do produto', required: false },
    ],
    requiredRoles: ['admin'],
    handler: async (params, context) => {
      const validation = validateParams(params, actions.find(a => a.name === 'create_product')!);
      if (validation) return { success: false, message: validation };

      try {
        const product = {
          id: uuidv4(),
          name: params.name as string,
          basePrice: params.basePrice as number,
          description: (params.description as string) || '',
          createdAt: new Date(),
        };

        productData.create(product);

        return {
          success: true,
          message: `✅ Produto "${product.name}" criado com preço base ${fmtCurrency(product.basePrice)}`,
          data: { productId: product.id, name: product.name },
        };
      } catch (err) {
        return { success: false, message: `Erro ao criar produto: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
      }
    },
  },

  // 4. search_orders
  {
    name: 'search_orders',
    description: 'Busca pedidos com filtros',
    category: 'query',
    parameters: [
      { name: 'status', type: 'string', description: 'Filtrar por status', required: false, enum: ['pending', 'completed', 'cancelled'] },
      { name: 'limit', type: 'number', description: 'Quantidade máxima de resultados', required: false },
      { name: 'customerName', type: 'string', description: 'Filtrar por nome do cliente', required: false },
    ],
    requiredRoles: ['admin', 'seller'],
    handler: async (params) => {
      try {
        let orders = orderData.getAll();

        if (params.status) {
          orders = orders.filter(o => o.status === params.status);
        }
        if (params.customerName) {
          const search = (params.customerName as string).toLowerCase();
          orders = orders.filter(o => o.name.toLowerCase().includes(search));
        }

        const limit = (params.limit as number) || 10;
        const result = orders.slice(-limit).reverse().map(o => ({
          id: o.id,
          name: o.name,
          totalPrice: fmtCurrency(o.totalPrice),
          status: o.status,
          createdAt: fmtDate(o.createdAt),
          delivered: o.delivered || false,
        }));

        return {
          success: true,
          message: `Encontrados ${result.length} pedido(s)`,
          data: { orders: result, total: orders.length },
        };
      } catch (err) {
        return { success: false, message: `Erro ao buscar pedidos: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
      }
    },
  },

  // 5. search_quotes
  {
    name: 'search_quotes',
    description: 'Busca orçamentos com filtros',
    category: 'query',
    parameters: [
      { name: 'status', type: 'string', description: 'Filtrar por status', required: false, enum: ['draft', 'sent', 'approved', 'rejected', 'converted'] },
      { name: 'customerName', type: 'string', description: 'Filtrar por nome do cliente', required: false },
      { name: 'limit', type: 'number', description: 'Quantidade máxima de resultados', required: false },
    ],
    requiredRoles: ['admin', 'seller'],
    handler: async (params) => {
      try {
        let quotes = quoteData.getAll();

        if (params.status) {
          quotes = quotes.filter(q => q.status === params.status);
        }
        if (params.customerName) {
          const search = (params.customerName as string).toLowerCase();
          quotes = quotes.filter(q => q.customerName.toLowerCase().includes(search));
        }

        const limit = (params.limit as number) || 10;
        const result = quotes.slice(-limit).reverse().map(q => ({
          id: q.id,
          name: q.name,
          customerName: q.customerName,
          totalPrice: fmtCurrency(q.totalPrice),
          status: q.status,
          validUntil: q.validUntil ? fmtDate(q.validUntil) : null,
        }));

        return {
          success: true,
          message: `Encontrados ${result.length} orçamento(s)`,
          data: { quotes: result, total: quotes.length },
        };
      } catch (err) {
        return { success: false, message: `Erro ao buscar orçamentos: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
      }
    },
  },

  // 6. generate_pdf_quote
  {
    name: 'generate_pdf_quote',
    description: 'Gera PDF para um orçamento existente',
    category: 'generation',
    parameters: [
      { name: 'quoteId', type: 'string', description: 'ID do orçamento', required: true },
    ],
    requiredRoles: ['admin', 'seller'],
    handler: async (params) => {
      const validation = validateParams(params, actions.find(a => a.name === 'generate_pdf_quote')!);
      if (validation) return { success: false, message: validation };

      try {
        const quote = quoteData.getAll().find(q => q.id === params.quoteId);
        if (!quote) return { success: false, message: `Orçamento #${params.quoteId} não encontrado.` };

        // PDF generation would require a library like jspdf or puppeteer
        // For now, return a structured data response that the frontend can use
        return {
          success: true,
          message: `📄 Dados do orçamento "${quote.name}" preparados para geração de PDF. Acesse Orçamentos > ${quote.name} para baixar.`,
          data: {
            quoteId: quote.id,
            name: quote.name,
            customerName: quote.customerName,
            totalPrice: quote.totalPrice,
            items: quote.items,
            validUntil: quote.validUntil,
            status: quote.status,
          },
          shouldStream: false,
        };
      } catch (err) {
        return { success: false, message: `Erro ao gerar PDF: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
      }
    },
  },

  // 7. get_low_stock
  {
    name: 'get_low_stock',
    description: 'Retorna itens com estoque baixo ou crítico',
    category: 'query',
    parameters: [],
    requiredRoles: ['admin', 'seller'],
    handler: async () => {
      try {
        const alerts = getStockAlertsByLevel();
        const groups = groupData.getAll();

        const mapVar = (v: { name: string; groupId: string; stock: number }) => {
          const group = groups.find(g => g.id === v.groupId);
          return { name: v.name, group: group?.name || '?', stock: v.stock };
        };

        return {
          success: true,
          message: `${alerts.critical.length} itens críticos, ${alerts.watch.length} em atenção`,
          data: {
            critical: alerts.critical.map(mapVar),
            watch: alerts.watch.map(mapVar),
          },
        };
      } catch (err) {
        return { success: false, message: `Erro ao verificar estoque: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
      }
    },
  },

  // 8. get_financial_summary
  {
    name: 'get_financial_summary',
    description: 'Retorna resumo financeiro: receita, despesas, lucro',
    category: 'query',
    parameters: [],
    requiredRoles: ['admin'],
    handler: async () => {
      try {
        const f = getFinanceSummary();
        return {
          success: true,
          message: `Receita: ${fmtCurrency(f.totalSales)} | Despesas: ${fmtCurrency(f.totalExpenses)} | Lucro: ${fmtCurrency(f.profit)}`,
          data: {
            totalSales: f.totalSales,
            totalExpenses: f.totalExpenses,
            profit: f.profit,
            margin: f.totalSales > 0 ? `${((f.profit / f.totalSales) * 100).toFixed(1)}%` : '0%',
          },
        };
      } catch (err) {
        return { success: false, message: `Erro ao buscar financeiro: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
      }
    },
  },

  // 9. get_sales_report
  {
    name: 'get_sales_report',
    description: 'Retorna relatório de vendas por período',
    category: 'query',
    parameters: [
      { name: 'period', type: 'string', description: 'Período do relatório', required: false, enum: ['today', 'week', 'month', 'all'] },
    ],
    requiredRoles: ['admin', 'seller'],
    handler: async (params) => {
      try {
        const orders = orderData.getAll().filter(o => o.status === 'completed');
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 86400000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const period = (params.period as string) || 'all';
        let filtered = orders;
        let periodLabel = 'Todos os tempos';

        if (period === 'today') {
          filtered = orders.filter(o => new Date(o.createdAt) >= todayStart);
          periodLabel = 'Hoje';
        } else if (period === 'week') {
          filtered = orders.filter(o => new Date(o.createdAt) >= weekStart);
          periodLabel = 'Últimos 7 dias';
        } else if (period === 'month') {
          filtered = orders.filter(o => new Date(o.createdAt) >= monthStart);
          periodLabel = 'Mês atual';
        }

        const total = filtered.reduce((s, o) => s + o.totalPrice, 0);
        const avg = filtered.length > 0 ? total / filtered.length : 0;

        return {
          success: true,
          message: `${periodLabel}: ${filtered.length} pedidos — Total: ${fmtCurrency(total)} — Ticket médio: ${fmtCurrency(avg)}`,
          data: {
            period: periodLabel,
            orderCount: filtered.length,
            totalSales: total,
            avgTicket: avg,
            orders: filtered.slice(-5).reverse().map(o => ({
              id: o.id,
              name: o.name,
              totalPrice: fmtCurrency(o.totalPrice),
              createdAt: fmtDate(o.createdAt),
            })),
          },
        };
      } catch (err) {
        return { success: false, message: `Erro ao gerar relatório: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
      }
    },
  },

  // 10. create_supplier
  {
    name: 'create_supplier',
    description: 'Cria um novo fornecedor',
    category: 'mutation',
    parameters: [
      { name: 'name', type: 'string', description: 'Nome do fornecedor', required: true },
      { name: 'contact', type: 'string', description: 'Contato (telefone/email)', required: false },
      { name: 'notes', type: 'string', description: 'Observações', required: false },
    ],
    requiredRoles: ['admin'],
    handler: async (params, context) => {
      const validation = validateParams(params, actions.find(a => a.name === 'create_supplier')!);
      if (validation) return { success: false, message: validation };

      try {
        const supplier = {
          id: uuidv4(),
          name: params.name as string,
          contact: (params.contact as string) || '',
          notes: (params.notes as string) || '',
          createdAt: new Date(),
        };

        supplierData.create(supplier);

        return {
          success: true,
          message: `✅ Fornecedor "${supplier.name}" criado com sucesso`,
          data: { supplierId: supplier.id, name: supplier.name },
        };
      } catch (err) {
        return { success: false, message: `Erro ao criar fornecedor: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
      }
    },
  },
];

// ── Registry ───────────────────────────────────────────────────

class ActionRegistry {
  private actions = new Map<string, ActionDefinition>();

  constructor() {
    for (const action of actions) {
      this.actions.set(action.name, action);
    }
  }

  get(name: string): ActionDefinition | undefined {
    return this.actions.get(name);
  }

  getAll(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }

  getByCategory(category: ActionDefinition['category']): ActionDefinition[] {
    return actions.filter(a => a.category === category);
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    context: ActionContext,
  ): Promise<ActionResult> {
    const action = this.actions.get(name);
    if (!action) {
      return { success: false, message: `Ação desconhecida: ${name}` };
    }

    // Permission check
    if (!action.requiredRoles.includes(context.userRole)) {
      return { success: false, message: `Sem permissão para executar: ${name}` };
    }

    try {
      const result = await action.handler(params, context);
      logAction(name, context, params, result);
      return result;
    } catch (err) {
      const result: ActionResult = {
        success: false,
        message: `Erro ao executar ${name}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
      };
      logAction(name, context, params, result);
      return result;
    }
  }
}

// Singleton
export const actionRegistry = new ActionRegistry();

// Re-export types
export type { ActionParameter, ActionDefinition, ActionContext, ActionResult };
