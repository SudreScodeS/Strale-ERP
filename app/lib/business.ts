// lib/business.ts
// Contém regras de negócio do ERP, separando lógica de domínio das APIs e da interface
// Esse arquivo orquestra cálculos de preço, estoque e vendas
// Arquitetura: Centralizar todas as regras de negócio aqui para facilitar manutenção

import { v4 as uuidv4 } from 'uuid';
import { calculateLogoCost, calculateSalePrice, isLowStock } from '../../config/global';
import { productData, variableData, groupData, orderData, financeData, invoiceData, purchaseOrderData, quoteData, priceHistoryData } from './data';
import { Order, OrderItem, LogoAnalysis, Invoice, Variable, Quote, QuoteItem } from '../../types';
import { calculateItemPricing, type PricingInput } from './pricing';

function getNextOrderId(): string {
  const maxOrderId = orderData
    .getAll()
    .reduce((maxValue, order) => {
      const numericId = Number(order.id);
      if (!Number.isInteger(numericId) || numericId < 1) return maxValue;
      return Math.max(maxValue, numericId);
    }, 0);
  return String(maxOrderId + 1);
}

// ==========================================
// ANÁLISE DE LOGO (LOCAL VIA SHARP)
// ==========================================

// A análise de logo é feita via API endpoint /api/logo-analysis
// que utiliza sharp (biblioteca local) para detectar cores dominantes.
// O Google Cloud Vision é opcional — só é usado se GOOGLE_VISION_API_KEY estiver configurado.
// O fluxo principal: Frontend → /api/logo-analysis (POST com imagem) → análise local → cores reais
// Esta função agora serve apenas como fallback/compatibilidade.

export async function analisarLogo(imageFile: { size: number } | null): Promise<LogoAnalysis> {
  // DEPRECATED: Esta função não deve mais ser usada diretamente.
  // A análise real é feita via /api/logo-analysis endpoint.
  // Mantida apenas para compatibilidade com código legado.
  console.warn('[DEPRECATED] analisarLogo() chamada diretamente. Use /api/logo-analysis endpoint.');
  const colors = imageFile ? Math.max(1, Math.min(5, Math.ceil(imageFile.size / 100000))) : 1;
  const cost = calculateLogoCost(colors);
  return { colors, cost };
}

// ==========================================
// CÁLCULOS DE PREÇO E CUSTO
// ==========================================

// CALCULA CUSTO TOTAL DE UM ITEM DO PEDIDO
// Soma preço base do produto + custos adicionais das variáveis selecionadas
// Multiplica pela quantidade para obter custo total do item
export function calculateItemCost(productId: string, variableIds: string[], quantity = 1): number {
  const product = productData.getById(productId);
  if (!product) return 0;

  // Busca todas as variáveis selecionadas e filtra as que existem
  const variables = variableIds
    .map((id) => variableData.getAll().find((variable) => variable.id === id))
    .filter((variable): variable is Variable => Boolean(variable));

  // Soma os custos adicionais de todas as variáveis
  const variableCost = variables.reduce((sum, variable) => sum + variable.additionalPrice, 0);

  // Custo total = (preço base + custo das variáveis) × quantidade
  return (product.basePrice + variableCost) * quantity;
}

// ==========================================
// PROCESSAMENTO DE PEDIDOS DE VENDA
// ==========================================

// PROCESSO COMPLETO DE FECHAMENTO DE PEDIDO
// Orquestra todo o fluxo: cálculo de preços, baixa de estoque, financeiro, nota fiscal
// PASSOS EXECUTADOS:
// 1. Calcula custos totais (produtos + logo)
// 2. Aplica markup para obter preço de venda
// 3. Registra pedido no sistema
// 4. Registra transação financeira
// 5. Baixa estoque das variáveis utilizadas
// 6. Gera nota fiscal
export function finalizarPedido(userId: string, name: string, items: OrderItem[], logoColors: number, deliveryDate?: string): { order: Order; invoice: Invoice } {
  // Cálculo dos custos
  const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  const logoCost = calculateLogoCost(logoColors);
  const totalPrice = calculateSalePrice(totalCost + logoCost);

  // Cria objeto do pedido
  const order: Order = {
    id: getNextOrderId(),
    userId,
    name,
    items,
    totalCost,
    totalPrice,
    logoCost,
    status: 'completed',
    deliveryDate,
    createdAt: new Date(),
  };

  // REGISTRA VENDA NO SISTEMA FINANCEIRO
  // Permite rastrear receita e calcular lucros
  financeData.create({
    id: uuidv4(),
    type: 'sale',
    amount: totalPrice,
    description: `Pedido: ${order.name}`,
    date: new Date(),
    orderId: order.id,
  });

  // BAIXA DE ESTOQUE
  // Para cada item do pedido, diminui o estoque das variáveis utilizadas
  // Previne vendas de produtos sem estoque
  items.forEach((item) => {
    item.selectedVariables.forEach(({ variableId, quantity }) => {
      const variable = variableData.getAll().find((v) => v.id === variableId);
      if (variable) {
        const usedQuantity = Math.max(0, quantity || item.quantity);
        // Garante que estoque não fique negativo
        variableData.updateStock(variableId, Math.max(0, variable.stock - usedQuantity));
      }
    });
  });

  // Salva o pedido no banco de dados
  orderData.create(order);

  // REGISTRA PREÇOS UTILIZADOS NO HISTÓRICO DE PREÇOS
  // Para cada item, loga o preço unitário usado no momento da venda
  items.forEach((item) => {
    const product = productData.getById(item.productId);
    if (product) {
      priceHistoryData.create({
        id: uuidv4(),
        entityType: 'product',
        entityId: item.productId,
        oldPrice: product.basePrice,
        newPrice: item.unitCost,
        changedBy: userId,
        reason: `Pedido #${order.id} - ${order.name}`,
        createdAt: new Date(),
      });
    }
  });

  // GERA NOTA FISCAL
  const invoice: Invoice = {
    id: uuidv4(),
    orderId: order.id,
    number: `NF-${new Date().getTime()}`,
    data: {
      customer: userId,
      items,
      totalPrice,
      issuedAt: new Date().toISOString(),
    },
    createdAt: new Date(),
  };

  invoiceData.create(invoice);

  return { order, invoice };
}

// ==========================================
// RELATÓRIOS E ANÁLISES
// ==========================================

// RESUMO FINANCEIRO GERAL
// Calcula totais de vendas, despesas e lucro
// Base para dashboards e relatórios gerenciais
export function getFinanceSummary() {
  const records = financeData.getAll();
  const totalSales = records.filter((r) => r.type === 'sale').reduce((sum, record) => sum + record.amount, 0);
  const totalExpenses = records.filter((r) => r.type !== 'sale').reduce((sum, record) => sum + record.amount, 0);
  const profit = totalSales - totalExpenses;
  return { totalSales, totalExpenses, profit };
}

// ==========================================
// GERENCIAMENTO DE ESTOQUE E COMPRAS
// ==========================================

// IDENTIFICA VARIÁVEIS COM ESTOQUE BAIXO
// Usado para alertas e sugestões de reposição automática
// Baseia-se na função isLowStock definida em config/global.ts
export function getLowStockVariables() {
  return variableData.getAll().filter((variable) => isLowStock(variable.stock));
}

export function getStockAlertsByLevel() {
  const groups = groupData.getAll();
  const variables = variableData.getAll();
  const defaultWatchStockAlert = 30;
  const defaultCriticalStockAlert = 10;
  const critical: Variable[] = [];
  const watch: Variable[] = [];

  variables.forEach((variable) => {
    const group = groups.find((item) => item.id === variable.groupId);
    const watchLimit = group?.watchStockAlert ?? defaultWatchStockAlert;
    const criticalLimit = group?.criticalStockAlert ?? defaultCriticalStockAlert;
    if (variable.stock <= criticalLimit) {
      critical.push(variable);
      return;
    }
    if (variable.stock <= watchLimit) {
      watch.push(variable);
    }
  });

  return { critical, watch };
}

// CRIA PEDIDO DE COMPRA PARA FORNECEDOR
// Gera pedido baseado em itens com estoque crítico
// FUTURO: Integração com sistema do fornecedor (email, API, EDI)
export function criarPedidoCompra(supplierId: string, items: { variableId: string; quantity: number; unitCost: number }[]) {
  const purchaseOrder = {
    id: uuidv4(),
    supplierId,
    items,
    status: 'ordered' as const,
    createdAt: new Date(),
  };

  // Atualmente salva localmente
  // FUTURO: Enviar email para fornecedor, integrar com sistema ERP do fornecedor
  purchaseOrderData.create(purchaseOrder);
  return purchaseOrder;
}

// ==========================================
// NOTAS DE EXPANSÃO E MELHORIAS
// ==========================================

// FUNCIONALIDADES FUTURAS RECOMENDADAS:
// 1. Descontos e promoções por volume/categoria
// 2. Controle de lote e validade para produtos perecíveis
// 3. Integração com transportadoras para cálculo de frete
// 4. Sistema de devoluções e trocas
// 5. Controle de qualidade e rejeição de produtos
// 6. Análise de demanda para previsão de vendas
// 7. Relatórios avançados (vendas por período, produto mais vendido, etc.)

// ==========================================
// GERENCIAMENTO DE ORÇAMENTOS (QUOTES)
// ==========================================

// CRIA NOVO ORÇAMENTO
// Diferença do pedido: não baixa estoque, tem validade, pode ser clonado
// Fluxo: vendedora cria orçamento → envia ao cliente → cliente aprova → vira pedido
export function criarOrcamento(
  userId: string,
  customerName: string,
  name: string,
  items: QuoteItem[],
  logoColors: number,
  validDays?: number,
  notes?: string,
  deliveryDate?: string,
): Quote {
  const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  const logoCost = calculateLogoCost(logoColors);
  const totalPrice = calculateSalePrice(totalCost + logoCost);

  const validUntil = validDays
    ? new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const quote: Quote = {
    id: uuidv4(),
    userId,
    customerName,
    name,
    items,
    totalCost: totalCost + logoCost,
    totalPrice,
    logoCost,
    status: 'draft',
    deliveryDate,
    validUntil,
    notes,
    createdAt: new Date(),
  };

  quoteData.create(quote);
  return quote;
}

// CONVERTE ORÇAMENTO EM PEDIDO
// Quando o cliente aprova o orçamento, vira um pedido real
// Baixa estoque, registra financeiro, gera nota fiscal
export function converterOrcamentoEmPedido(
  quoteId: string,
  userId: string,
  deliveryDate?: string,
  name?: string,
): { order: Order; invoice: Invoice } | { error: string } {
  const quote = quoteData.getById(quoteId);
  if (!quote) return { error: 'Orçamento não encontrado.' };
  if (quote.status === 'converted') return { error: 'Orçamento já foi convertido.' };

  // Converte QuoteItem[] para OrderItem[]
  const orderItems: OrderItem[] = quote.items.map((qi) => ({
    productId: qi.productId,
    selectedVariables: qi.selectedVariables,
    quantity: qi.quantity,
    unitCost: qi.unitCost,
    unitPrice: qi.unitPrice,
  }));

  // Calcula cores de logo a partir do custo
  const logoColors = quote.logoCost > 0 ? Math.round(quote.logoCost / 10) : 0;

  // Cria o pedido usando a função existente
  const { order, invoice } = finalizarPedido(userId, name || quote.name, orderItems, logoColors, deliveryDate);

  // Atualiza o orçamento
  quoteData.update(quoteId, {
    status: 'converted',
    convertedOrderId: order.id,
  });

  return { order, invoice };
}

// CLONA UM ORÇAMENTO
// Útil quando o Edson faz 10-20 orçamentos para a mesma venda
// Copia todos os itens e dados, mas gera novo ID e status 'draft'
export function clonarOrcamento(quoteId: string, userId: string): Quote | { error: string } {
  const original = quoteData.getById(quoteId);
  if (!original) return { error: 'Orçamento não encontrado.' };

  const clone: Quote = {
    id: uuidv4(),
    userId,
    customerName: original.customerName,
    name: `${original.name} (cópia)`,
    items: [...original.items],
    totalCost: original.totalCost,
    totalPrice: original.totalPrice,
    logoCost: original.logoCost,
    status: 'draft',
    validUntil: original.validUntil,
    notes: original.notes,
    createdAt: new Date(),
  };

  quoteData.create(clone);
  return clone;
}

// ATUALIZA STATUS DO ORÇAMENTO
export function atualizarStatusOrcamento(
  quoteId: string,
  status: Quote['status'],
): Quote | { error: string } {
  const quote = quoteData.getById(quoteId);
  if (!quote) return { error: 'Orçamento não encontrado.' };

  quoteData.update(quoteId, { status });
  return { ...quote, status };
}

// LISTA ORÇAMENTOS POR USUÁRIO (para vendedoras)
export function listarOrcamentosPorUsuario(userId: string): Quote[] {
  return quoteData.getAll().filter(q => q.userId === userId);
}

// LISTA ORÇAMENTOS POR STATUS
export function listarOrcamentosPorStatus(status: Quote['status']): Quote[] {
  return quoteData.getAll().filter(q => q.status === status);
}

// ESTATÍSTICAS DE ORÇAMENTOS
export function getOrcamentosStats(): {
  total: number;
  draft: number;
  sent: number;
  approved: number;
  rejected: number;
  converted: number;
  conversionRate: number;
  totalValue: number;
  averageValue: number;
} {
  const quotes = quoteData.getAll();
  const draft = quotes.filter(q => q.status === 'draft').length;
  const sent = quotes.filter(q => q.status === 'sent').length;
  const approved = quotes.filter(q => q.status === 'approved').length;
  const rejected = quotes.filter(q => q.status === 'rejected').length;
  const converted = quotes.filter(q => q.status === 'converted').length;
  const totalValue = quotes.reduce((sum, q) => sum + q.totalPrice, 0);
  const finished = approved + rejected + converted;

  return {
    total: quotes.length,
    draft,
    sent,
    approved,
    rejected,
    converted,
    conversionRate: finished > 0 ? (converted / finished) * 100 : 0,
    totalValue,
    averageValue: quotes.length > 0 ? totalValue / quotes.length : 0,
  };
}
