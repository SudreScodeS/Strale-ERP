// lib/data.ts
// Camada de abstração de dados com cache em memória
// Cada read usa cache com TTL de 5s; cada write invalida a chave afetada

import fs from 'fs';
import path from 'path';
import { User, Product, Group, Variable, Order, FinancialRecord, Invoice, PurchaseOrder, Supplier, Quote, PriceHistory, ActivityLog } from '../../types';
import { cached, invalidate } from './cache';

const DATA_DIR = path.join(process.cwd(), 'data');

// ── Low-level I/O ──────────────────────────────────────────────

function readJsonFile<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJsonFile<T>(filename: string, data: T[]): void {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/** Read through cache — avoids redundant disk I/O within TTL window */
function cachedRead<T>(filename: string): T[] {
  return cached<T[]>(filename, () => readJsonFile<T>(filename));
}

/** Write then invalidate cache so next read gets fresh data */
function writeAndInvalidate<T>(filename: string, data: T[]): void {
  writeJsonFile(filename, data);
  invalidate(filename);
}

// ==========================================
// GERENCIAMENTO DE USUÁRIOS
// ==========================================

export const userData = {
  getAll: () => cachedRead<User>('users.json'),
  getById: (id: string) => cachedRead<User>('users.json').find(u => u.id === id),
  getByUsername: (username: string) => cachedRead<User>('users.json').find(u => u.username === username),
  create: (user: User) => {
    const users = readJsonFile<User>('users.json');
    users.push(user);
    writeAndInvalidate('users.json', users);
  },
  update: (id: string, updates: Partial<User>) => {
    const users = readJsonFile<User>('users.json');
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      writeAndInvalidate('users.json', users);
    }
  },
  delete: (id: string) => {
    const users = readJsonFile<User>('users.json').filter((u) => u.id !== id);
    writeAndInvalidate('users.json', users);
  },
};

// ==========================================
// GERENCIAMENTO DE PRODUTOS
// ==========================================

export const productData = {
  getAll: () => cachedRead<Product>('products.json'),
  getById: (id: string) => cachedRead<Product>('products.json').find(p => p.id === id),
  create: (product: Product) => {
    const products = readJsonFile<Product>('products.json');
    products.push(product);
    writeAndInvalidate('products.json', products);
  },
  update: (id: string, updates: Partial<Product>) => {
    const products = readJsonFile<Product>('products.json');
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], ...updates };
      writeAndInvalidate('products.json', products);
    }
  },
  delete: (id: string) => {
    const products = readJsonFile<Product>('products.json').filter(p => p.id !== id);
    writeAndInvalidate('products.json', products);
  },
};

// ==========================================
// GERENCIAMENTO DE GRUPOS DE CONFIGURAÇÃO
// ==========================================

export const groupData = {
  getAll: () => cachedRead<Group>('groups.json'),
  getByProductId: (productId: string) => cachedRead<Group>('groups.json').filter(g => g.productId === productId),
  create: (group: Group) => {
    const groups = readJsonFile<Group>('groups.json');
    groups.push(group);
    writeAndInvalidate('groups.json', groups);
  },
  update: (id: string, updates: Partial<Group>) => {
    const groups = readJsonFile<Group>('groups.json');
    const index = groups.findIndex((g) => g.id === id);
    if (index !== -1) {
      groups[index] = { ...groups[index], ...updates };
      writeAndInvalidate('groups.json', groups);
    }
  },
  delete: (id: string) => {
    const groups = readJsonFile<Group>('groups.json').filter((g) => g.id !== id);
    writeAndInvalidate('groups.json', groups);
  },
};

// ==========================================
// GERENCIAMENTO DE VARIÁVEIS DE PRODUTO
// ==========================================

export const variableData = {
  getAll: () => cachedRead<Variable>('variables.json'),
  getByGroupId: (groupId: string) => cachedRead<Variable>('variables.json').filter(v => v.groupId === groupId),
  create: (variable: Variable) => {
    const variables = readJsonFile<Variable>('variables.json');
    variables.push(variable);
    writeAndInvalidate('variables.json', variables);
  },
  updateStock: (id: string, newStock: number) => {
    const variables = readJsonFile<Variable>('variables.json');
    const index = variables.findIndex(v => v.id === id);
    if (index !== -1) {
      variables[index].stock = newStock;
      writeAndInvalidate('variables.json', variables);
    }
  },
  update: (id: string, updates: Partial<Variable>) => {
    const variables = readJsonFile<Variable>('variables.json');
    const index = variables.findIndex((v) => v.id === id);
    if (index !== -1) {
      variables[index] = { ...variables[index], ...updates };
      writeAndInvalidate('variables.json', variables);
    }
  },
  delete: (id: string) => {
    const variables = readJsonFile<Variable>('variables.json').filter((v) => v.id !== id);
    writeAndInvalidate('variables.json', variables);
  },
};

// ==========================================
// GERENCIAMENTO DE PEDIDOS DE VENDA
// ==========================================

export const orderData = {
  getAll: () => cachedRead<Order>('orders.json'),
  create: (order: Order) => {
    const orders = readJsonFile<Order>('orders.json');
    orders.push(order);
    writeAndInvalidate('orders.json', orders);
  },
  update: (id: string, updates: Partial<Order>) => {
    const orders = readJsonFile<Order>('orders.json');
    const index = orders.findIndex((order) => order.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      writeAndInvalidate('orders.json', orders);
    }
  },
  delete: (id: string) => {
    const orders = readJsonFile<Order>('orders.json').filter((order) => order.id !== id);
    writeAndInvalidate('orders.json', orders);
  },
};

// ==========================================
// GERENCIAMENTO DE REGISTROS FINANCEIROS
// ==========================================

export const financeData = {
  getAll: () => cachedRead<FinancialRecord>('finance.json'),
  create: (record: FinancialRecord) => {
    const records = readJsonFile<FinancialRecord>('finance.json');
    records.push(record);
    writeAndInvalidate('finance.json', records);
  },
  update: (id: string, updates: Partial<FinancialRecord>) => {
    const records = readJsonFile<FinancialRecord>('finance.json');
    const index = records.findIndex((record) => record.id === id);
    if (index !== -1) {
      records[index] = { ...records[index], ...updates };
      writeAndInvalidate('finance.json', records);
    }
  },
  delete: (id: string) => {
    const records = readJsonFile<FinancialRecord>('finance.json').filter((record) => record.id !== id);
    writeAndInvalidate('finance.json', records);
  },
};

// ==========================================
// GERENCIAMENTO DE NOTAS FISCAIS
// ==========================================

export const invoiceData = {
  getAll: () => cachedRead<Invoice>('invoices.json'),
  create: (invoice: Invoice) => {
    const invoices = readJsonFile<Invoice>('invoices.json');
    invoices.push(invoice);
    writeAndInvalidate('invoices.json', invoices);
  },
};

// ==========================================
// GERENCIAMENTO DE PEDIDOS DE COMPRA
// ==========================================

export const purchaseOrderData = {
  getAll: () => cachedRead<PurchaseOrder>('purchase-orders.json'),
  create: (po: PurchaseOrder) => {
    const pos = readJsonFile<PurchaseOrder>('purchase-orders.json');
    pos.push(po);
    writeAndInvalidate('purchase-orders.json', pos);
  },
  update: (id: string, updates: Partial<PurchaseOrder>) => {
    const pos = readJsonFile<PurchaseOrder>('purchase-orders.json');
    const index = pos.findIndex((item) => item.id === id);
    if (index !== -1) {
      pos[index] = { ...pos[index], ...updates };
      writeAndInvalidate('purchase-orders.json', pos);
    }
  },
  delete: (id: string) => {
    const pos = readJsonFile<PurchaseOrder>('purchase-orders.json').filter((item) => item.id !== id);
    writeAndInvalidate('purchase-orders.json', pos);
  },
};

// ==========================================
// GERENCIAMENTO DE FORNECEDORES
// ==========================================

export const supplierData = {
  getAll: () => cachedRead<Supplier>('suppliers.json'),
  getById: (id: string) => cachedRead<Supplier>('suppliers.json').find(s => s.id === id),
  create: (supplier: Supplier) => {
    const suppliers = readJsonFile<Supplier>('suppliers.json');
    suppliers.push(supplier);
    writeAndInvalidate('suppliers.json', suppliers);
  },
  update: (id: string, updates: Partial<Supplier>) => {
    const suppliers = readJsonFile<Supplier>('suppliers.json');
    const index = suppliers.findIndex(s => s.id === id);
    if (index !== -1) {
      suppliers[index] = { ...suppliers[index], ...updates };
      writeAndInvalidate('suppliers.json', suppliers);
    }
  },
  delete: (id: string) => {
    const suppliers = readJsonFile<Supplier>('suppliers.json').filter(s => s.id !== id);
    writeAndInvalidate('suppliers.json', suppliers);
  },
};

// ==========================================
// GERENCIAMENTO DE ORÇAMENTOS (QUOTES)
// ==========================================

export const quoteData = {
  getAll: () => cachedRead<Quote>('quotes.json'),
  getById: (id: string) => cachedRead<Quote>('quotes.json').find(q => q.id === id),
  create: (quote: Quote) => {
    const quotes = readJsonFile<Quote>('quotes.json');
    quotes.push(quote);
    writeAndInvalidate('quotes.json', quotes);
  },
  update: (id: string, updates: Partial<Quote>) => {
    const quotes = readJsonFile<Quote>('quotes.json');
    const index = quotes.findIndex(q => q.id === id);
    if (index !== -1) {
      quotes[index] = { ...quotes[index], ...updates };
      writeAndInvalidate('quotes.json', quotes);
    }
  },
  delete: (id: string) => {
    const quotes = readJsonFile<Quote>('quotes.json').filter(q => q.id !== id);
    writeAndInvalidate('quotes.json', quotes);
  },
};

// ==========================================
// GERENCIAMENTO DE HISTÓRICO DE PREÇOS
// ==========================================

export const priceHistoryData = {
  getAll: () => cachedRead<PriceHistory>('price-history.json'),
  getByEntityId: (entityId: string) => cachedRead<PriceHistory>('price-history.json').filter(ph => ph.entityId === entityId),
  create: (entry: PriceHistory) => {
    const history = readJsonFile<PriceHistory>('price-history.json');
    history.push(entry);
    writeAndInvalidate('price-history.json', history);
  },
};

// ==========================================
// LOG DE ATIVIDADES
// ==========================================

export const activityLogData = {
  getAll: () => cachedRead<ActivityLog>('activity-logs.json'),
  create: (entry: ActivityLog) => {
    const logs = readJsonFile<ActivityLog>('activity-logs.json');
    logs.push(entry);
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    writeAndInvalidate('activity-logs.json', logs);
  },
  deleteById: (id: string): boolean => {
    const logs = readJsonFile<ActivityLog>('activity-logs.json');
    const filtered = logs.filter(l => l.id !== id);
    if (filtered.length === logs.length) return false;
    writeAndInvalidate('activity-logs.json', filtered);
    return true;
  },
  clearAll: () => {
    writeAndInvalidate('activity-logs.json', []);
  },
};
