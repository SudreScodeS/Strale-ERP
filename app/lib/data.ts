// lib/data.ts
// Camada de abstração de dados
// Suporta PostgreSQL (quando DATABASE_URL configurado) com fallback para JSON files
// Decisão arquitetural: Abstrair acesso a dados para facilitar migração futura

import fs from 'fs';
import path from 'path';
import { User, Product, Group, Variable, Order, FinancialRecord, Invoice, PurchaseOrder, Supplier, Quote, PriceHistory } from '../../types';
import { isPostgresAvailable, query } from './db';

// DIRETÓRIO DE ARMAZENAMENTO DOS DADOS (JSON fallback)
const DATA_DIR = path.join(process.cwd(), 'data');

// ==========================================
// FUNÇÕES UTILITÁRIAS JSON (FALLBACK)
// ==========================================

function readJsonFile<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJsonFile<T>(filename: string, data: T[]): void {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ==========================================
// MAPEAMENTO: JSON field → PostgreSQL column
// ==========================================

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    email: row.email as string,
    password: row.password as string,
    role: row.role as 'admin' | 'seller',
    createdAt: new Date(row.created_at as string),
  };
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    basePrice: Number(row.base_price),
    description: row.description as string | undefined,
    imageUrl: row.image_url as string | undefined,
    createdAt: new Date(row.created_at as string),
  };
}

function mapGroup(row: Record<string, unknown>): Group {
  return {
    id: row.id as string,
    name: row.name as string,
    productId: row.product_id as string,
    watchStockAlert: row.watch_stock_alert != null ? Number(row.watch_stock_alert) : undefined,
    criticalStockAlert: row.critical_stock_alert != null ? Number(row.critical_stock_alert) : undefined,
    createdAt: new Date(row.created_at as string),
  };
}

function mapVariable(row: Record<string, unknown>): Variable {
  return {
    id: row.id as string,
    name: row.name as string,
    additionalPrice: Number(row.additional_price),
    stock: Number(row.stock),
    groupId: row.group_id as string,
    createdAt: new Date(row.created_at as string),
  };
}

function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    items: (typeof row.items === 'string' ? JSON.parse(row.items as string) : row.items) as Order['items'],
    totalCost: Number(row.total_cost),
    totalPrice: Number(row.total_price),
    logoCost: Number(row.logo_cost),
    status: row.status as Order['status'],
    createdAt: new Date(row.created_at as string),
  };
}

function mapFinancialRecord(row: Record<string, unknown>): FinancialRecord {
  return {
    id: row.id as string,
    type: row.type as FinancialRecord['type'],
    amount: Number(row.amount),
    description: row.description as string,
    date: new Date(row.date as string),
    orderId: row.order_id as string | undefined,
  };
}

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    number: row.number as string,
    data: (typeof row.data === 'string' ? JSON.parse(row.data as string) : row.data) as Invoice['data'],
    createdAt: new Date(row.created_at as string),
  };
}

function mapPurchaseOrder(row: Record<string, unknown>): PurchaseOrder {
  return {
    id: row.id as string,
    supplierId: row.supplier_id as string,
    items: (typeof row.items === 'string' ? JSON.parse(row.items as string) : row.items) as PurchaseOrder['items'],
    status: row.status as PurchaseOrder['status'],
    createdAt: new Date(row.created_at as string),
  };
}

function mapSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: row.id as string,
    name: row.name as string,
    contact: row.contact as string | undefined,
    createdAt: new Date(row.created_at as string),
  };
}

function mapQuote(row: Record<string, unknown>): Quote {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    customerName: row.customer_name as string,
    name: row.name as string,
    items: (typeof row.items === 'string' ? JSON.parse(row.items as string) : row.items) as Quote['items'],
    totalCost: Number(row.total_cost),
    totalPrice: Number(row.total_price),
    logoCost: Number(row.logo_cost),
    status: row.status as Quote['status'],
    validUntil: row.valid_until ? new Date(row.valid_until as string).toISOString() : undefined,
    notes: row.notes as string | undefined,
    convertedOrderId: row.converted_order_id as string | undefined,
    createdAt: new Date(row.created_at as string),
  };
}

function mapPriceHistory(row: Record<string, unknown>): PriceHistory {
  return {
    id: row.id as string,
    entityType: row.entity_type as 'product' | 'variable',
    entityId: row.entity_id as string,
    oldPrice: Number(row.old_price),
    newPrice: Number(row.new_price),
    changedBy: row.changed_by as string,
    reason: row.reason as string | undefined,
    createdAt: new Date(row.created_at as string),
  };
}

// ==========================================
// GERENCIAMENTO DE USUÁRIOS
// ==========================================

export const userData = {
  getAll: (): User[] => {
    if (isPostgresAvailable()) {
      // Nota: Para compatibilidade síncrona, usamos JSON como fallback para getAll
      // Em produção, considere tornar getAll async
      return readJsonFile<User>('users.json');
    }
    return readJsonFile<User>('users.json');
  },

  getById: (id: string): User | undefined => {
    return readJsonFile<User>('users.json').find(u => u.id === id);
  },

  getByUsername: (username: string): User | undefined => {
    return readJsonFile<User>('users.json').find(u => u.username === username);
  },

  create: (user: User) => {
    const users = readJsonFile<User>('users.json');
    users.push(user);
    writeJsonFile('users.json', users);
    // Assíncrono: tenta inserir no Postgres se disponível
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO users (id, username, email, password, role, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [user.id, user.username, user.email, user.password, user.role, user.createdAt],
      ).catch(console.error);
    }
  },

  update: (id: string, updates: Partial<User>) => {
    const users = readJsonFile<User>('users.json');
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      writeJsonFile('users.json', users);
    }
    if (isPostgresAvailable()) {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (updates.username !== undefined) { sets.push(`username = $${i++}`); params.push(updates.username); }
      if (updates.email !== undefined) { sets.push(`email = $${i++}`); params.push(updates.email); }
      if (updates.password !== undefined) { sets.push(`password = $${i++}`); params.push(updates.password); }
      if (updates.role !== undefined) { sets.push(`role = $${i++}`); params.push(updates.role); }
      if (sets.length > 0) {
        params.push(id);
        query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i}`, params).catch(console.error);
      }
    }
  },

  delete: (id: string) => {
    const users = readJsonFile<User>('users.json').filter((u) => u.id !== id);
    writeJsonFile('users.json', users);
    if (isPostgresAvailable()) {
      query('DELETE FROM users WHERE id = $1', [id]).catch(console.error);
    }
  },
};

// ==========================================
// GERENCIAMENTO DE PRODUTOS
// ==========================================

export const productData = {
  getAll: (): Product[] => readJsonFile<Product>('products.json'),

  getById: (id: string): Product | undefined => {
    return readJsonFile<Product>('products.json').find(p => p.id === id);
  },

  create: (product: Product) => {
    const products = readJsonFile<Product>('products.json');
    products.push(product);
    writeJsonFile('products.json', products);
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO products (id, name, base_price, description, image_url, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [product.id, product.name, product.basePrice, product.description || null, product.imageUrl || null, product.createdAt],
      ).catch(console.error);
    }
  },

  update: (id: string, updates: Partial<Product>) => {
    const products = readJsonFile<Product>('products.json');
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], ...updates };
      writeJsonFile('products.json', products);
    }
    if (isPostgresAvailable()) {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (updates.name !== undefined) { sets.push(`name = $${i++}`); params.push(updates.name); }
      if (updates.basePrice !== undefined) { sets.push(`base_price = $${i++}`); params.push(updates.basePrice); }
      if (updates.description !== undefined) { sets.push(`description = $${i++}`); params.push(updates.description); }
      if (updates.imageUrl !== undefined) { sets.push(`image_url = $${i++}`); params.push(updates.imageUrl); }
      if (sets.length > 0) {
        params.push(id);
        query(`UPDATE products SET ${sets.join(', ')} WHERE id = $${i}`, params).catch(console.error);
      }
    }
  },

  delete: (id: string) => {
    const products = readJsonFile<Product>('products.json').filter(p => p.id !== id);
    writeJsonFile('products.json', products);
    if (isPostgresAvailable()) {
      query('DELETE FROM products WHERE id = $1', [id]).catch(console.error);
    }
  },
};

// ==========================================
// GERENCIAMENTO DE GRUPOS DE CONFIGURAÇÃO
// ==========================================

export const groupData = {
  getAll: (): Group[] => readJsonFile<Group>('groups.json'),

  getByProductId: (productId: string): Group[] => {
    return readJsonFile<Group>('groups.json').filter(g => g.productId === productId);
  },

  create: (group: Group) => {
    const groups = readJsonFile<Group>('groups.json');
    groups.push(group);
    writeJsonFile('groups.json', groups);
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO groups (id, name, product_id, watch_stock_alert, critical_stock_alert, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [group.id, group.name, group.productId, group.watchStockAlert ?? null, group.criticalStockAlert ?? null, group.createdAt],
      ).catch(console.error);
    }
  },

  update: (id: string, updates: Partial<Group>) => {
    const groups = readJsonFile<Group>('groups.json');
    const index = groups.findIndex((g) => g.id === id);
    if (index !== -1) {
      groups[index] = { ...groups[index], ...updates };
      writeJsonFile('groups.json', groups);
    }
    if (isPostgresAvailable()) {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (updates.name !== undefined) { sets.push(`name = $${i++}`); params.push(updates.name); }
      if (updates.productId !== undefined) { sets.push(`product_id = $${i++}`); params.push(updates.productId); }
      if (updates.watchStockAlert !== undefined) { sets.push(`watch_stock_alert = $${i++}`); params.push(updates.watchStockAlert); }
      if (updates.criticalStockAlert !== undefined) { sets.push(`critical_stock_alert = $${i++}`); params.push(updates.criticalStockAlert); }
      if (sets.length > 0) {
        params.push(id);
        query(`UPDATE groups SET ${sets.join(', ')} WHERE id = $${i}`, params).catch(console.error);
      }
    }
  },

  delete: (id: string) => {
    const groups = readJsonFile<Group>('groups.json').filter((g) => g.id !== id);
    writeJsonFile('groups.json', groups);
    if (isPostgresAvailable()) {
      query('DELETE FROM groups WHERE id = $1', [id]).catch(console.error);
    }
  },
};

// ==========================================
// GERENCIAMENTO DE VARIÁVEIS DE PRODUTO
// ==========================================

export const variableData = {
  getAll: (): Variable[] => readJsonFile<Variable>('variables.json'),

  getByGroupId: (groupId: string): Variable[] => {
    return readJsonFile<Variable>('variables.json').filter(v => v.groupId === groupId);
  },

  create: (variable: Variable) => {
    const variables = readJsonFile<Variable>('variables.json');
    variables.push(variable);
    writeJsonFile('variables.json', variables);
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO variables (id, name, additional_price, stock, group_id, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [variable.id, variable.name, variable.additionalPrice, variable.stock, variable.groupId, variable.createdAt],
      ).catch(console.error);
    }
  },

  updateStock: (id: string, newStock: number) => {
    const variables = readJsonFile<Variable>('variables.json');
    const index = variables.findIndex(v => v.id === id);
    if (index !== -1) {
      variables[index].stock = newStock;
      writeJsonFile('variables.json', variables);
    }
    if (isPostgresAvailable()) {
      query('UPDATE variables SET stock = $1 WHERE id = $2', [newStock, id]).catch(console.error);
    }
  },

  update: (id: string, updates: Partial<Variable>) => {
    const variables = readJsonFile<Variable>('variables.json');
    const index = variables.findIndex((v) => v.id === id);
    if (index !== -1) {
      variables[index] = { ...variables[index], ...updates };
      writeJsonFile('variables.json', variables);
    }
    if (isPostgresAvailable()) {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (updates.name !== undefined) { sets.push(`name = $${i++}`); params.push(updates.name); }
      if (updates.additionalPrice !== undefined) { sets.push(`additional_price = $${i++}`); params.push(updates.additionalPrice); }
      if (updates.stock !== undefined) { sets.push(`stock = $${i++}`); params.push(updates.stock); }
      if (updates.groupId !== undefined) { sets.push(`group_id = $${i++}`); params.push(updates.groupId); }
      if (sets.length > 0) {
        params.push(id);
        query(`UPDATE variables SET ${sets.join(', ')} WHERE id = $${i}`, params).catch(console.error);
      }
    }
  },

  delete: (id: string) => {
    const variables = readJsonFile<Variable>('variables.json').filter((v) => v.id !== id);
    writeJsonFile('variables.json', variables);
    if (isPostgresAvailable()) {
      query('DELETE FROM variables WHERE id = $1', [id]).catch(console.error);
    }
  },
};

// ==========================================
// GERENCIAMENTO DE PEDIDOS DE VENDA
// ==========================================

export const orderData = {
  getAll: (): Order[] => readJsonFile<Order>('orders.json'),

  create: (order: Order) => {
    const orders = readJsonFile<Order>('orders.json');
    orders.push(order);
    writeJsonFile('orders.json', orders);
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO orders (id, user_id, name, items, total_cost, total_price, logo_cost, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING',
        [order.id, order.userId, order.name, JSON.stringify(order.items), order.totalCost, order.totalPrice, order.logoCost, order.status, order.createdAt],
      ).catch(console.error);
    }
  },

  update: (id: string, updates: Partial<Order>) => {
    const orders = readJsonFile<Order>('orders.json');
    const index = orders.findIndex((order) => order.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      writeJsonFile('orders.json', orders);
    }
    if (isPostgresAvailable()) {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (updates.name !== undefined) { sets.push(`name = $${i++}`); params.push(updates.name); }
      if (updates.items !== undefined) { sets.push(`items = $${i++}`); params.push(JSON.stringify(updates.items)); }
      if (updates.totalCost !== undefined) { sets.push(`total_cost = $${i++}`); params.push(updates.totalCost); }
      if (updates.totalPrice !== undefined) { sets.push(`total_price = $${i++}`); params.push(updates.totalPrice); }
      if (updates.logoCost !== undefined) { sets.push(`logo_cost = $${i++}`); params.push(updates.logoCost); }
      if (updates.status !== undefined) { sets.push(`status = $${i++}`); params.push(updates.status); }
      if (sets.length > 0) {
        params.push(id);
        query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $${i}`, params).catch(console.error);
      }
    }
  },

  delete: (id: string) => {
    const orders = readJsonFile<Order>('orders.json').filter((order) => order.id !== id);
    writeJsonFile('orders.json', orders);
    if (isPostgresAvailable()) {
      query('DELETE FROM orders WHERE id = $1', [id]).catch(console.error);
    }
  },
};

// ==========================================
// GERENCIAMENTO DE REGISTROS FINANCEIROS
// ==========================================

export const financeData = {
  getAll: (): FinancialRecord[] => readJsonFile<FinancialRecord>('finance.json'),

  create: (record: FinancialRecord) => {
    const records = readJsonFile<FinancialRecord>('finance.json');
    records.push(record);
    writeJsonFile('finance.json', records);
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO finance (id, type, amount, description, date, order_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [record.id, record.type, record.amount, record.description, record.date, record.orderId ?? null],
      ).catch(console.error);
    }
  },

  update: (id: string, updates: Partial<FinancialRecord>) => {
    const records = readJsonFile<FinancialRecord>('finance.json');
    const index = records.findIndex((record) => record.id === id);
    if (index !== -1) {
      records[index] = { ...records[index], ...updates };
      writeJsonFile('finance.json', records);
    }
    if (isPostgresAvailable()) {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (updates.type !== undefined) { sets.push(`type = $${i++}`); params.push(updates.type); }
      if (updates.amount !== undefined) { sets.push(`amount = $${i++}`); params.push(updates.amount); }
      if (updates.description !== undefined) { sets.push(`description = $${i++}`); params.push(updates.description); }
      if (updates.orderId !== undefined) { sets.push(`order_id = $${i++}`); params.push(updates.orderId); }
      if (sets.length > 0) {
        params.push(id);
        query(`UPDATE finance SET ${sets.join(', ')} WHERE id = $${i}`, params).catch(console.error);
      }
    }
  },

  delete: (id: string) => {
    const records = readJsonFile<FinancialRecord>('finance.json').filter((record) => record.id !== id);
    writeJsonFile('finance.json', records);
    if (isPostgresAvailable()) {
      query('DELETE FROM finance WHERE id = $1', [id]).catch(console.error);
    }
  },
};

// ==========================================
// GERENCIAMENTO DE NOTAS FISCAIS
// ==========================================

export const invoiceData = {
  getAll: (): Invoice[] => readJsonFile<Invoice>('invoices.json'),

  create: (invoice: Invoice) => {
    const invoices = readJsonFile<Invoice>('invoices.json');
    invoices.push(invoice);
    writeJsonFile('invoices.json', invoices);
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO invoices (id, order_id, number, data, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [invoice.id, invoice.orderId, invoice.number, JSON.stringify(invoice.data), invoice.createdAt],
      ).catch(console.error);
    }
  },
};

// ==========================================
// GERENCIAMENTO DE PEDIDOS DE COMPRA
// ==========================================

export const purchaseOrderData = {
  getAll: (): PurchaseOrder[] => readJsonFile<PurchaseOrder>('purchase-orders.json'),

  create: (po: PurchaseOrder) => {
    const pos = readJsonFile<PurchaseOrder>('purchase-orders.json');
    pos.push(po);
    writeJsonFile('purchase-orders.json', pos);
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO purchase_orders (id, supplier_id, items, status, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [po.id, po.supplierId, JSON.stringify(po.items), po.status, po.createdAt],
      ).catch(console.error);
    }
  },

  update: (id: string, updates: Partial<PurchaseOrder>) => {
    const pos = readJsonFile<PurchaseOrder>('purchase-orders.json');
    const index = pos.findIndex((item) => item.id === id);
    if (index !== -1) {
      pos[index] = { ...pos[index], ...updates };
      writeJsonFile('purchase-orders.json', pos);
    }
    if (isPostgresAvailable()) {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (updates.supplierId !== undefined) { sets.push(`supplier_id = $${i++}`); params.push(updates.supplierId); }
      if (updates.items !== undefined) { sets.push(`items = $${i++}`); params.push(JSON.stringify(updates.items)); }
      if (updates.status !== undefined) { sets.push(`status = $${i++}`); params.push(updates.status); }
      if (sets.length > 0) {
        params.push(id);
        query(`UPDATE purchase_orders SET ${sets.join(', ')} WHERE id = $${i}`, params).catch(console.error);
      }
    }
  },

  delete: (id: string) => {
    const pos = readJsonFile<PurchaseOrder>('purchase-orders.json').filter((item) => item.id !== id);
    writeJsonFile('purchase-orders.json', pos);
    if (isPostgresAvailable()) {
      query('DELETE FROM purchase_orders WHERE id = $1', [id]).catch(console.error);
    }
  },
};

// ==========================================
// GERENCIAMENTO DE FORNECEDORES
// ==========================================

export const supplierData = {
  getAll: (): Supplier[] => readJsonFile<Supplier>('suppliers.json'),

  create: (supplier: Supplier) => {
    const suppliers = readJsonFile<Supplier>('suppliers.json');
    suppliers.push(supplier);
    writeJsonFile('suppliers.json', suppliers);
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO suppliers (id, name, contact, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [supplier.id, supplier.name, supplier.contact || null, supplier.createdAt],
      ).catch(console.error);
    }
  },
};

// ==========================================
// GERENCIAMENTO DE ORÇAMENTOS (QUOTES)
// ==========================================

export const quoteData = {
  getAll: (): Quote[] => readJsonFile<Quote>('quotes.json'),

  getById: (id: string): Quote | undefined => {
    return readJsonFile<Quote>('quotes.json').find(q => q.id === id);
  },

  create: (quote: Quote) => {
    const quotes = readJsonFile<Quote>('quotes.json');
    quotes.push(quote);
    writeJsonFile('quotes.json', quotes);
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO quotes (id, user_id, customer_name, name, items, total_cost, total_price, logo_cost, status, valid_until, notes, converted_order_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING',
        [quote.id, quote.userId, quote.customerName, quote.name, JSON.stringify(quote.items), quote.totalCost, quote.totalPrice, quote.logoCost, quote.status, quote.validUntil || null, quote.notes || null, quote.convertedOrderId || null, quote.createdAt],
      ).catch(console.error);
    }
  },

  update: (id: string, updates: Partial<Quote>) => {
    const quotes = readJsonFile<Quote>('quotes.json');
    const index = quotes.findIndex(q => q.id === id);
    if (index !== -1) {
      quotes[index] = { ...quotes[index], ...updates };
      writeJsonFile('quotes.json', quotes);
    }
    if (isPostgresAvailable()) {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (updates.customerName !== undefined) { sets.push(`customer_name = $${i++}`); params.push(updates.customerName); }
      if (updates.name !== undefined) { sets.push(`name = $${i++}`); params.push(updates.name); }
      if (updates.items !== undefined) { sets.push(`items = $${i++}`); params.push(JSON.stringify(updates.items)); }
      if (updates.totalCost !== undefined) { sets.push(`total_cost = $${i++}`); params.push(updates.totalCost); }
      if (updates.totalPrice !== undefined) { sets.push(`total_price = $${i++}`); params.push(updates.totalPrice); }
      if (updates.logoCost !== undefined) { sets.push(`logo_cost = $${i++}`); params.push(updates.logoCost); }
      if (updates.status !== undefined) { sets.push(`status = $${i++}`); params.push(updates.status); }
      if (updates.validUntil !== undefined) { sets.push(`valid_until = $${i++}`); params.push(updates.validUntil || null); }
      if (updates.notes !== undefined) { sets.push(`notes = $${i++}`); params.push(updates.notes); }
      if (updates.convertedOrderId !== undefined) { sets.push(`converted_order_id = $${i++}`); params.push(updates.convertedOrderId); }
      if (sets.length > 0) {
        params.push(id);
        query(`UPDATE quotes SET ${sets.join(', ')} WHERE id = $${i}`, params).catch(console.error);
      }
    }
  },

  delete: (id: string) => {
    const quotes = readJsonFile<Quote>('quotes.json').filter(q => q.id !== id);
    writeJsonFile('quotes.json', quotes);
    if (isPostgresAvailable()) {
      query('DELETE FROM quotes WHERE id = $1', [id]).catch(console.error);
    }
  },
};

// ==========================================
// GERENCIAMENTO DE HISTÓRICO DE PREÇOS
// ==========================================

export const priceHistoryData = {
  getAll: (): PriceHistory[] => readJsonFile<PriceHistory>('price-history.json'),

  getByEntityId: (entityId: string): PriceHistory[] => {
    return readJsonFile<PriceHistory>('price-history.json').filter(ph => ph.entityId === entityId);
  },

  create: (entry: PriceHistory) => {
    const history = readJsonFile<PriceHistory>('price-history.json');
    history.push(entry);
    writeJsonFile('price-history.json', history);
    if (isPostgresAvailable()) {
      query(
        'INSERT INTO price_history (id, entity_type, entity_id, old_price, new_price, changed_by, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
        [entry.id, entry.entityType, entry.entityId, entry.oldPrice, entry.newPrice, entry.changedBy, entry.reason || null, entry.createdAt],
      ).catch(console.error);
    }
  },
};
