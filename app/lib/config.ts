// app/lib/config.ts
// Server-side config management with disk persistence
// Used by API routes only — NOT imported by client components

import fs from 'fs';
import path from 'path';
import { GlobalConfig } from '../../types';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'config.json');

const DEFAULTS: GlobalConfig = {
  profitMargin: 20,
  logoPricePerColor: 10,
  minStockAlert: 5,
  systemName: 'Shtar',
  companyName: 'North Bag',
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

  saveConfig(current);
  return current;
}
