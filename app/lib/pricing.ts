// lib/pricing.ts
// Motor de preços unificado — centraliza TODOS os cálculos de preço
// Usado por: orçamentos, pedidos, assistente
// Substitui cálculos espalhados em business.ts e componentes

import { calculateSalePrice, getTierPrice, calculatePrintCost, calculateDimensionCost } from '../../config/global';
import { productData, variableData, groupData } from './data';
import { PriceTier } from '../../types';

// ==========================================
// TIPOS DE ENTRADA DO MOTOR DE PREÇOS
// ==========================================

export interface PricingInput {
  productId: string;
  selectedVariables: { groupId: string; variableId: string; quantity: number }[];
  quantity: number;
  logoColors?: number;
  dimensions?: { width: number; height: number };
  printType?: string;
  printPosition?: 'front' | 'back' | 'both';
  printSize?: 'small' | 'medium' | 'large';
}

export interface PricingBreakdown {
  basePrice: number; // Preço base do produto
  variableCost: number; // Custo total das variáveis
  dimensionCost: number; // Custo por dimensão (se aplicável)
  printCost: number; // Custo de impressão (detalhado)
  logoCost: number; // Custo legado de logo (fallback)
  unitCost: number; // Custo unitário total (sem margem)
  unitPrice: number; // Preço unitário (com margem)
  totalCost: number; // Custo total (sem margem)
  totalPrice: number; // Preço total (com margem)
  tierApplied: string | null; // Faixa de preço aplicada
  margin: number; // Valor da margem
  breakdown: string; // Descrição legível do cálculo
}

// ==========================================
// MOTOR DE PREÇOS
// ==========================================

/**
 * Calcula preço completo de um item com todas as variáveis.
 * Esta é a função central que deve ser usada por TODOS os fluxos.
 */
export function calculateItemPricing(input: PricingInput): PricingBreakdown {
  const product = productData.getById(input.productId);
  if (!product) {
    return {
      basePrice: 0, variableCost: 0, dimensionCost: 0, printCost: 0,
      logoCost: 0, unitCost: 0, unitPrice: 0, totalCost: 0, totalPrice: 0,
      tierApplied: null, margin: 0, breakdown: 'Produto não encontrado',
    };
  }

  // 1. Preço base do produto
  const basePrice = product.basePrice;

  // 2. Custo das variáveis selecionadas
  const allVariables = variableData.getAll();
  const variableCost = input.selectedVariables.reduce((sum, sv) => {
    const variable = allVariables.find(v => v.id === sv.variableId);
    return sum + (variable ? variable.additionalPrice : 0);
  }, 0);

  // 3. Custo por dimensão (se aplicável)
  const dimensionCost = input.dimensions
    ? calculateDimensionCost(input.dimensions.width, input.dimensions.height)
    : 0;

  // 4. Custo de impressão (método novo — por tipo/tamanho/posição)
  let printCost = 0;
  if (input.printType && input.printSize && input.printPosition) {
    printCost = calculatePrintCost(
      input.printType,
      input.printSize,
      input.printPosition,
      input.logoColors || 1,
    );
  }

  // 5. Custo de logo legado (fallback — se não usou impressão detalhada)
  const logoCost = (!input.printType && input.logoColors)
    ? input.logoColors * 10 // Usa a config global via calculateLogoCost se quiser
    : 0;

  // 6. Custo unitário = base + variáveis + dimensão + impressão + logo legado
  const unitCost = basePrice + variableCost + dimensionCost + printCost + logoCost;

  // 7. Aplica tabela de preços por faixa de quantidade (se configurada)
  const tierPrice = getTierPrice(input.quantity, unitCost);
  const tierDiscount = unitCost > 0 ? ((unitCost - tierPrice) / unitCost * 100) : 0;
  const tierApplied = tierDiscount > 0
    ? `Desconto volume (${tierDiscount.toFixed(0)}%): -R$ ${((unitCost - tierPrice) * input.quantity).toFixed(2)}`
    : null;

  // 8. Se a faixa alterou o preço, usa ela; senão aplica margem normal (por produto ou global)
  const effectiveUnitCost = tierPrice !== unitCost ? tierPrice : unitCost;
  const unitPrice = calculateSalePrice(effectiveUnitCost, product?.profitMargin);

  // 9. Totais
  const totalCost = effectiveUnitCost * input.quantity;
  const totalPrice = unitPrice * input.quantity;
  const margin = totalPrice - totalCost;

  // 10. Descrição legível
  const parts: string[] = [];
  parts.push(`Base: R$ ${basePrice.toFixed(2)}`);
  if (variableCost > 0) parts.push(`Variáveis: R$ ${variableCost.toFixed(2)}`);
  if (dimensionCost > 0) parts.push(`Dimensão: R$ ${dimensionCost.toFixed(2)}`);
  if (printCost > 0) parts.push(`Impressão: R$ ${printCost.toFixed(2)}`);
  if (logoCost > 0) parts.push(`Logo: R$ ${logoCost.toFixed(2)}`);
  if (tierApplied) parts.push(tierApplied);

  return {
    basePrice,
    variableCost,
    dimensionCost,
    printCost,
    logoCost,
    unitCost: effectiveUnitCost,
    unitPrice,
    totalCost,
    totalPrice,
    tierApplied,
    margin,
    breakdown: parts.join(' + '),
  };
}

/**
 * Calcula preço de múltiplos itens (para orçamento/pedido com carrinho).
 */
export function calculateCartPricing(
  items: PricingInput[],
  legacyLogoColors: number = 0,
): {
  itemsCost: number;
  printCost: number;
  logoCost: number;
  totalCost: number;
  totalPrice: number;
  margin: number;
  itemBreakdowns: PricingBreakdown[];
} {
  const itemBreakdowns = items.map(item => calculateItemPricing(item));

  const itemsCost = itemBreakdowns.reduce((sum, b) => sum + (b.unitCost - b.printCost - b.logoCost) * items[itemBreakdowns.indexOf(b)].quantity, 0);
  const printCost = itemBreakdowns.reduce((sum, b) => sum + b.printCost * items[itemBreakdowns.indexOf(b)].quantity, 0);

  // Logo legado (se não usou impressão detalhada em nenhum item)
  const hasDetailedPrint = items.some(i => i.printType);
  const logoCost = hasDetailedPrint ? 0 : legacyLogoColors * 10;

  const totalCost = itemBreakdowns.reduce((sum, b) => sum + b.totalCost, 0) + logoCost;
  const totalPrice = itemBreakdowns.reduce((sum, b) => sum + b.totalPrice, 0) + (logoCost > 0 ? calculateSalePrice(logoCost) : 0);
  const margin = totalPrice - totalCost;

  return { itemsCost, printCost, logoCost, totalCost, totalPrice, margin, itemBreakdowns };
}

/**
 * Gera um resumo legível do orçamento para o assistente ou PDF.
 */
export function generatePricingSummary(
  items: PricingInput[],
  companyName: string = 'North Bag',
): string {
  const result = calculateCartPricing(items);
  const lines: string[] = [];

  lines.push(`Orçamento — ${companyName}`);
  lines.push(`${'='.repeat(40)}`);

  items.forEach((item, i) => {
    const bd = result.itemBreakdowns[i];
    const product = productData.getById(item.productId);
    lines.push(`\n${i + 1}. ${product?.name || 'Produto'} — ${item.quantity}x`);
    lines.push(`   ${bd.breakdown}`);
    lines.push(`   Unitário: R$ ${bd.unitPrice.toFixed(2)} | Total: R$ ${bd.totalPrice.toFixed(2)}`);
  });

  lines.push(`\n${'='.repeat(40)}`);
  lines.push(`Custo total: R$ ${result.totalCost.toFixed(2)}`);
  lines.push(`Preço final: R$ ${result.totalPrice.toFixed(2)}`);
  lines.push(`Margem: R$ ${result.margin.toFixed(2)}`);

  return lines.join('\n');
}
