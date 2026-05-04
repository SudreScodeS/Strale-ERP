// config/global.ts
// Configurações globais do sistema ERP — CLIENT-SAFE (no Node.js imports)
// Todas as regras de negócio configuráveis estão aqui
// A persistência é feita via API /api/config (server-side)

import { GlobalConfig } from '../types';

// ==========================================
// CONFIGURAÇÕES GLOBAIS DO SISTEMA
// ==========================================

export const globalConfig: GlobalConfig = {
  profitMargin: 20,
  logoPricePerColor: 10,
  minStockAlert: 5,
  systemName: 'Simple ERP',
  companyName: 'North Bag',
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
}

// ==========================================
// FUNÇÕES DE CÁLCULO BASEADAS NAS CONFIGURAÇÕES
// ==========================================

export function calculateSalePrice(totalCost: number): number {
  return totalCost + (totalCost * globalConfig.profitMargin / 100);
}

export function calculateLogoCost(colors: number): number {
  return colors * globalConfig.logoPricePerColor;
}

export function isLowStock(stock: number): boolean {
  return stock <= globalConfig.minStockAlert;
}
