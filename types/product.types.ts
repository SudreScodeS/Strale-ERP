// types/product.types.ts
// Product domain: products, groups, variables, and UI view types.

import type { Product, Group, Variable, UnitOfMeasure } from './index';

// ── UI View Types (enriched with computed fields) ──────────────

/** Variable as seen in selection UIs (inventory, sales, quotes, purchases) */
export interface VariableOption {
  id: string;
  name: string;
  additionalPrice: number;
  stock: number;
  groupId: string;
  unitOfMeasure?: UnitOfMeasure;
}

/** Group with its child variables */
export interface GroupOption {
  id: string;
  name: string;
  productId: string;
  watchStockAlert?: number;
  criticalStockAlert?: number;
  variables: VariableOption[];
}

/** Product with full tree: groups → variables */
export interface ProductOption {
  id: string;
  name: string;
  basePrice: number;
  profitMargin?: number;
  description?: string;
  imageUrl?: string;
  groups: GroupOption[];
}

// ── Cart Types (shared across sales, quotes, purchases) ────────

/** Item in a sales/quote cart before submission */
export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  groupId: string;
  groupName: string;
  variableId: string;
  variableName: string;
  unitOfMeasure: UnitOfMeasure;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  dimensions?: { width: number; height: number };
  printType?: string;
  printPosition?: string;
  printSize?: 'small' | 'medium' | 'large';
  previewConfig?: unknown;
}

/** Simplified cart item for purchases (no pricing/markup) */
export interface PurchaseCartItem {
  id: string;
  productId: string;
  productName: string;
  groupId: string;
  groupName: string;
  variableId: string;
  variableName: string;
  unitOfMeasure: UnitOfMeasure;
  quantity: number;
  unitCost: number;
}
