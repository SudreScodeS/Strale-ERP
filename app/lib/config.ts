// app/lib/config.ts
// Server-side config management with disk persistence
// Used by API routes only — NOT imported by client components

import fs from 'fs';
import path from 'path';
import { GlobalConfig, PriceTier, PrintPricingRule, PrintType } from '../../types';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'config.json');

const DEFAULT_PRICE_TIERS: PriceTier[] = [
  { minQty: 1, maxQty: 99, unitPrice: 0, label: 'Varejo' },
  { minQty: 100, maxQty: 499, unitPrice: 0, label: 'Atacado mínimo' },
  { minQty: 500, maxQty: 999, unitPrice: 0, label: 'Atacado' },
  { minQty: 1000, maxQty: 4999, unitPrice: 0, label: 'Grande volume' },
  { minQty: 5000, unitPrice: 0, label: 'Mega atacado' },
];

const DEFAULT_PRINT_PRICING: PrintPricingRule[] = [
  { printType: 'serigrafia', size: 'small', position: 'front', baseCost: 15, costPerColor: 8 },
  { printType: 'serigrafia', size: 'medium', position: 'front', baseCost: 25, costPerColor: 12 },
  { printType: 'serigrafia', size: 'large', position: 'front', baseCost: 40, costPerColor: 18 },
  { printType: 'serigrafia', size: 'small', position: 'both', baseCost: 25, costPerColor: 14 },
  { printType: 'serigrafia', size: 'medium', position: 'both', baseCost: 40, costPerColor: 20 },
  { printType: 'serigrafia', size: 'large', position: 'both', baseCost: 65, costPerColor: 30 },
  { printType: 'sublimacao', size: 'small', position: 'front', baseCost: 20, costPerColor: 0 },
  { printType: 'sublimacao', size: 'medium', position: 'front', baseCost: 35, costPerColor: 0 },
  { printType: 'sublimacao', size: 'large', position: 'front', baseCost: 55, costPerColor: 0 },
  { printType: 'sublimacao', size: 'small', position: 'both', baseCost: 35, costPerColor: 0 },
  { printType: 'sublimacao', size: 'medium', position: 'both', baseCost: 60, costPerColor: 0 },
  { printType: 'sublimacao', size: 'large', position: 'both', baseCost: 90, costPerColor: 0 },
  { printType: 'dtf', size: 'small', position: 'front', baseCost: 12, costPerColor: 0 },
  { printType: 'dtf', size: 'medium', position: 'front', baseCost: 22, costPerColor: 0 },
  { printType: 'dtf', size: 'large', position: 'front', baseCost: 35, costPerColor: 0 },
  { printType: 'dtf', size: 'small', position: 'both', baseCost: 20, costPerColor: 0 },
  { printType: 'dtf', size: 'medium', position: 'both', baseCost: 38, costPerColor: 0 },
  { printType: 'dtf', size: 'large', position: 'both', baseCost: 55, costPerColor: 0 },
];

const DEFAULT_PRINT_TYPES: PrintType[] = [
  { value: 'serigrafia', label: 'Serigrafia' },
  { value: 'sublimacao', label: 'Sublimação' },
  { value: 'dtf', label: 'DTF' },
];

const DEFAULTS: GlobalConfig = {
  profitMargin: 20,
  logoPricePerColor: 10,
  minStockAlert: 5,
  systemName: 'Elitium',
  companyName: 'North Bag',
  quoteValidityDays: 7,
  priceTiers: DEFAULT_PRICE_TIERS,
  printPricingRules: DEFAULT_PRINT_PRICING,
  printTypes: DEFAULT_PRINT_TYPES,
  pricePerCm2: 0.005,
};

/**
 * Load config from disk, falling back to defaults for missing fields.
 */
export function loadServerConfig(): GlobalConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...DEFAULTS, ...data };
    }
  } catch {
    // Fallback to defaults
  }
  return { ...DEFAULTS };
}

/**
 * Save config to disk.
 */
function saveConfig(config: GlobalConfig): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Update config with validation and persist to disk.
 * Returns the merged config.
 */
export function updateServerConfig(updates: Partial<GlobalConfig>): GlobalConfig {
  const current = loadServerConfig();

  if (typeof updates.profitMargin === 'number' && updates.profitMargin >= 0) {
    current.profitMargin = updates.profitMargin;
  }
  if (typeof updates.logoPricePerColor === 'number' && updates.logoPricePerColor >= 0) {
    current.logoPricePerColor = updates.logoPricePerColor;
  }
  if (typeof updates.minStockAlert === 'number' && updates.minStockAlert >= 0) {
    current.minStockAlert = updates.minStockAlert;
  }
  if (typeof updates.systemName === 'string' && updates.systemName.trim()) {
    current.systemName = updates.systemName.trim();
  }
  if (typeof updates.companyName === 'string' && updates.companyName.trim()) {
    current.companyName = updates.companyName.trim();
  }
  if (typeof updates.quoteValidityDays === 'number' && updates.quoteValidityDays >= 1) {
    current.quoteValidityDays = updates.quoteValidityDays;
  }
  if (Array.isArray(updates.priceTiers)) {
    current.priceTiers = updates.priceTiers;
  }
  if (Array.isArray(updates.printPricingRules)) {
    current.printPricingRules = updates.printPricingRules;
  }
  if (Array.isArray(updates.printTypes)) {
    current.printTypes = updates.printTypes;
  }
  if (typeof updates.pricePerCm2 === 'number' && updates.pricePerCm2 >= 0) {
    current.pricePerCm2 = updates.pricePerCm2;
  }

  saveConfig(current);
  return current;
}
