// config/global.ts
// Configurações globais do sistema ERP — CLIENT-SAFE (no Node.js imports)
// Todas as regras de negócio configuráveis estão aqui
// A persistência é feita via API /api/config (server-side)

import { GlobalConfig, PriceTier, PrintPricingRule, PrintType } from '../types';

// ==========================================
// TABELA DE PREÇOS POR FAIXA DE QUANTIDADE
// ==========================================
// Permite descontos progressivos por volume
// O Edson mencionou que o preço varia muito conforme a quantidade

const DEFAULT_PRICE_TIERS: PriceTier[] = [
  { minQty: 1, maxQty: 99, unitPrice: 0, discountPercent: 0, label: 'Varejo' },
  { minQty: 100, maxQty: 499, unitPrice: 0, discountPercent: 5, label: 'Atacado mínimo' },
  { minQty: 500, maxQty: 999, unitPrice: 0, discountPercent: 10, label: 'Atacado' },
  { minQty: 1000, maxQty: 4999, unitPrice: 0, discountPercent: 15, label: 'Grande volume' },
  { minQty: 5000, unitPrice: 0, discountPercent: 20, label: 'Mega atacado' },
];

// ==========================================
// REGRAS DE PREÇO DE IMPRESSÃO
// ==========================================
// Custo de impressão varia por: tipo, tamanho, posição e cores
// Substitui o cálculo simplificado anterior (apenas R$/cor)

const DEFAULT_PRINT_PRICING: PrintPricingRule[] = [
  // Serigrafia
  { printType: 'serigrafia', size: 'small', position: 'front', baseCost: 15, costPerColor: 8 },
  { printType: 'serigrafia', size: 'medium', position: 'front', baseCost: 25, costPerColor: 12 },
  { printType: 'serigrafia', size: 'large', position: 'front', baseCost: 40, costPerColor: 18 },
  { printType: 'serigrafia', size: 'small', position: 'back', baseCost: 15, costPerColor: 8 },
  { printType: 'serigrafia', size: 'medium', position: 'back', baseCost: 25, costPerColor: 12 },
  { printType: 'serigrafia', size: 'large', position: 'back', baseCost: 40, costPerColor: 18 },
  { printType: 'serigrafia', size: 'small', position: 'both', baseCost: 25, costPerColor: 14 },
  { printType: 'serigrafia', size: 'medium', position: 'both', baseCost: 40, costPerColor: 20 },
  { printType: 'serigrafia', size: 'large', position: 'both', baseCost: 65, costPerColor: 30 },
  // Sublimação
  { printType: 'sublimacao', size: 'small', position: 'front', baseCost: 20, costPerColor: 0 },
  { printType: 'sublimacao', size: 'medium', position: 'front', baseCost: 35, costPerColor: 0 },
  { printType: 'sublimacao', size: 'large', position: 'front', baseCost: 55, costPerColor: 0 },
  { printType: 'sublimacao', size: 'small', position: 'back', baseCost: 20, costPerColor: 0 },
  { printType: 'sublimacao', size: 'medium', position: 'back', baseCost: 35, costPerColor: 0 },
  { printType: 'sublimacao', size: 'large', position: 'back', baseCost: 55, costPerColor: 0 },
  { printType: 'sublimacao', size: 'small', position: 'both', baseCost: 35, costPerColor: 0 },
  { printType: 'sublimacao', size: 'medium', position: 'both', baseCost: 60, costPerColor: 0 },
  { printType: 'sublimacao', size: 'large', position: 'both', baseCost: 90, costPerColor: 0 },
  // DTF
  { printType: 'dtf', size: 'small', position: 'front', baseCost: 12, costPerColor: 0 },
  { printType: 'dtf', size: 'medium', position: 'front', baseCost: 22, costPerColor: 0 },
  { printType: 'dtf', size: 'large', position: 'front', baseCost: 35, costPerColor: 0 },
  { printType: 'dtf', size: 'small', position: 'back', baseCost: 12, costPerColor: 0 },
  { printType: 'dtf', size: 'medium', position: 'back', baseCost: 22, costPerColor: 0 },
  { printType: 'dtf', size: 'large', position: 'back', baseCost: 35, costPerColor: 0 },
  { printType: 'dtf', size: 'small', position: 'both', baseCost: 20, costPerColor: 0 },
  { printType: 'dtf', size: 'medium', position: 'both', baseCost: 38, costPerColor: 0 },
  { printType: 'dtf', size: 'large', position: 'both', baseCost: 55, costPerColor: 0 },
];

// ==========================================
// TIPOS DE IMPRESSÃO DISPONÍVEIS
// ==========================================

const DEFAULT_PRINT_TYPES: PrintType[] = [
  { value: 'serigrafia', label: 'Serigrafia' },
  { value: 'sublimacao', label: 'Sublimação' },
  { value: 'dtf', label: 'DTF' },
];

// ==========================================
// CONFIGURAÇÕES GLOBAIS DO SISTEMA
// ==========================================

export const globalConfig: GlobalConfig = {
  profitMargin: 20,
  logoPricePerColor: 10,
  minStockAlert: 5,
  systemName: 'Elitium',
  companyName: 'North Bag',
  quoteValidityDays: 7,
  priceTiers: DEFAULT_PRICE_TIERS,
  printPricingRules: DEFAULT_PRINT_PRICING,
  printTypes: DEFAULT_PRINT_TYPES,
  pricePerCm2: 0.005, // R$ 0,005 por cm² — ajustável pelo admin
};

/**
 * Aplica configurações carregadas do servidor.
 * Chamado pelo layout ou por componentes que buscam /api/config.
 */
export function applyServerConfig(serverConfig: Partial<GlobalConfig>): void {
  if (typeof serverConfig.profitMargin === 'number') globalConfig.profitMargin = serverConfig.profitMargin;
  if (typeof serverConfig.logoPricePerColor === 'number') globalConfig.logoPricePerColor = serverConfig.logoPricePerColor;
  if (typeof serverConfig.minStockAlert === 'number') globalConfig.minStockAlert = serverConfig.minStockAlert;
  if (typeof serverConfig.systemName === 'string') globalConfig.systemName = serverConfig.systemName;
  if (typeof serverConfig.companyName === 'string') globalConfig.companyName = serverConfig.companyName;
  if (typeof serverConfig.quoteValidityDays === 'number') globalConfig.quoteValidityDays = serverConfig.quoteValidityDays;
  if (Array.isArray(serverConfig.priceTiers)) globalConfig.priceTiers = serverConfig.priceTiers;
  if (Array.isArray(serverConfig.printPricingRules)) globalConfig.printPricingRules = serverConfig.printPricingRules;
  if (Array.isArray(serverConfig.printTypes)) globalConfig.printTypes = serverConfig.printTypes;
  if (typeof serverConfig.pricePerCm2 === 'number') globalConfig.pricePerCm2 = serverConfig.pricePerCm2;
}

// ==========================================
// FUNÇÕES DE CÁLCULO BASEADAS NAS CONFIGURAÇÕES
// ==========================================

/** Aplica margem de lucro sobre o custo */
export function calculateSalePrice(totalCost: number): number {
  return totalCost + (totalCost * globalConfig.profitMargin / 100);
}

/** Custo de logo por cor (método legado — mantido para compatibilidade) */
export function calculateLogoCost(colors: number): number {
  return colors * globalConfig.logoPricePerColor;
}

/** Verifica se estoque está baixo */
export function isLowStock(stock: number): boolean {
  return stock <= globalConfig.minStockAlert;
}

/**
 * Calcula preço unitário baseado na tabela de preços por faixa de quantidade.
 * Retorna o preço da faixa correspondente ou o preço base se não houver tabela.
 * Suporta dois modos:
 *   - unitPrice > 0: preço fixo unitário (ignora basePrice)
 *   - unitPrice == 0 + discountPercent: aplica desconto percentual sobre basePrice
 */
export function getTierPrice(quantity: number, basePrice: number): number {
  if (!globalConfig.priceTiers || globalConfig.priceTiers.length === 0) {
    return basePrice;
  }

  // Ordena por minQty decrescente para encontrar a faixa mais alta aplicável
  const sorted = [...globalConfig.priceTiers].sort((a, b) => b.minQty - a.minQty);

  for (const tier of sorted) {
    if (quantity >= tier.minQty) {
      // Se maxQty definido e quantidade excede, pula
      if (tier.maxQty && quantity > tier.maxQty) continue;
      // Preço fixo unitário (modo legado)
      if (tier.unitPrice > 0) return tier.unitPrice;
      // Desconto percentual sobre o preço base
      if (tier.discountPercent && tier.discountPercent > 0) {
        return basePrice * (1 - tier.discountPercent / 100);
      }
      // Sem desconto configurado — retorna preço base
      return basePrice;
    }
  }

  return basePrice;
}

/**
 * Calcula custo de impressão baseado em tipo, tamanho, posição e cores.
 * Usa as regras configuradas em printPricingRules.
 */
export function calculatePrintCost(
  printType: string,
  size: 'small' | 'medium' | 'large',
  position: 'front' | 'back' | 'both',
  colorCount: number = 1,
): number {
  const rule = globalConfig.printPricingRules.find(
    (r) => r.printType === printType && r.size === size && r.position === position,
  );

  if (!rule) {
    // Fallback: usa o cálculo legado por cor
    return calculateLogoCost(colorCount);
  }

  const additionalColors = Math.max(0, colorCount - 1);
  return rule.baseCost + additionalColors * (rule.costPerColor || 0);
}

/**
 * Calcula custo adicional baseado em dimensões (largura × altura).
 * Útil para produtos cujo preço varia pelo tamanho (sacolas, banners, etc.)
 */
export function calculateDimensionCost(widthCm: number, heightCm: number): number {
  if (!globalConfig.pricePerCm2 || globalConfig.pricePerCm2 <= 0) return 0;
  return widthCm * heightCm * globalConfig.pricePerCm2;
}
