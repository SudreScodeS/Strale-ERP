// lib/business.ts
// Contém regras de negócio do ERP, separando lógica de domínio das APIs e da interface
// Esse arquivo orquestra cálculos de preço, estoque e vendas
// Arquitetura: Centralizar todas as regras de negócio aqui para facilitar manutenção

import { v4 as uuidv4 } from 'uuid';
import { calculateLogoCost, calculateSalePrice, isLowStock } from '../../config/global';
import { productData, variableData, groupData, orderData, financeData, invoiceData, purchaseOrderData } from './data';
import { Order, OrderItem, LogoAnalysis, Invoice, Variable } from '../../types';
import { runFraudAnalysis } from './fraud-detection';

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
// ANÁLISE DE LOGO (VIA GOOGLE CLOUD VISION)
// ==========================================

// A análise real de logo é feita via API endpoint /api/logo-analysis
// que utiliza Google Cloud Vision para detectar cores dominantes.
// Esta função agora serve apenas como fallback/compatibilidade.
// O fluxo principal: Frontend → /api/logo-analysis (POST com imagem) → Vision API → cores reais
//
// Para configurar a API:
//   1. Crie um projeto no Google Cloud Console
//   2. Ative a Cloud Vision API
//   3. Crie uma API Key ou Service Account
//   4. Configure no .env.local:
//      GOOGLE_VISION_API_KEY=sua-chave-aqui
//      ou
//      GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/service-account.json

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
export function finalizarPedido(userId: string, name: string, items: OrderItem[], logoColors: number): { order: Order; invoice: Invoice; fraudLog: import('../../types').FraudAnalysisLog } {
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

  // GERA NOTA FISCAL
  // Documento fiscal obrigatório para vendas
  const invoice: Invoice = {
    id: uuidv4(),
    orderId: order.id,
    number: `NF-${new Date().getTime()}`, // Número único baseado em timestamp
    data: {
      customer: userId,
      items,
      totalPrice,
      issuedAt: new Date().toISOString(),
    },
    createdAt: new Date(),
  };

  invoiceData.create(invoice);

  // ═══════════════════════════════════════
  // DETECÇÃO DE FRAUDE — executada automaticamente
  // Analisa o pedido contra regras de comportamento e valor
  // Salva log de análise e retorna resultado junto com o pedido
  // ═══════════════════════════════════════
  const fraudLog = runFraudAnalysis(order);

  return { order, invoice, fraudLog };
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
