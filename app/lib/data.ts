// lib/data.ts
// Camada de abstração de dados
// Atualmente usa JSON files
// Decisão arquitetural: Abstrair acesso a dados para facilitar migração futura

import fs from 'fs';
import path from 'path';
import { User, Product, Group, Variable, Order, FinancialRecord, Invoice, PurchaseOrder, Supplier, Quote, PriceHistory } from '../../types';

// DIRETÓRIO DE ARMAZENAMENTO DOS DADOS
// Todos os arquivos JSON ficam nesta pasta
const DATA_DIR = path.join(process.cwd(), 'data');

// FUNÇÕES UTILITÁRIAS PARA LEITURA/ESCRITA JSON
// Abstraem operações de arquivo para facilitar migração futura

// Lê arquivo JSON e retorna array tipado
// Se arquivo não existe, retorna array vazio
function readJsonFile<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Escreve array no arquivo JSON com formatação
function writeJsonFile<T>(filename: string, data: T[]): void {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ==========================================
// GERENCIAMENTO DE USUÁRIOS
// ==========================================

export const userData = {
  // Retorna todos os usuários cadastrados
  getAll: () => readJsonFile<User>('users.json'),

  // Busca usuário por ID único
  getById: (id: string) => readJsonFile<User>('users.json').find(u => u.id === id),

  // Busca usuário por nome de usuário (usado no login)
  getByUsername: (username: string) => readJsonFile<User>('users.json').find(u => u.username === username),

  // Cria novo usuário no sistema
  create: (user: User) => {
    const users = readJsonFile<User>('users.json');
    users.push(user);
    writeJsonFile('users.json', users);
  },

  // Atualiza dados de usuário existente
  update: (id: string, updates: Partial<User>) => {
    const users = readJsonFile<User>('users.json');
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      writeJsonFile('users.json', users);
    }
  },

  delete: (id: string) => {
    const users = readJsonFile<User>('users.json').filter((u) => u.id !== id);
    writeJsonFile('users.json', users);
  },
};

// ==========================================
// GERENCIAMENTO DE PRODUTOS
// ==========================================

export const productData = {
  // Lista todos os produtos base
  getAll: () => readJsonFile<Product>('products.json'),

  // Busca produto específico por ID
  getById: (id: string) => readJsonFile<Product>('products.json').find(p => p.id === id),

  // Adiciona novo produto ao catálogo
  create: (product: Product) => {
    const products = readJsonFile<Product>('products.json');
    products.push(product);
    writeJsonFile('products.json', products);
  },

  // Atualiza dados de produto existente
  update: (id: string, updates: Partial<Product>) => {
    const products = readJsonFile<Product>('products.json');
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], ...updates };
      writeJsonFile('products.json', products);
    }
  },

  // Remove produto do catálogo (cuidado: pode quebrar pedidos existentes)
  delete: (id: string) => {
    const products = readJsonFile<Product>('products.json').filter(p => p.id !== id);
    writeJsonFile('products.json', products);
  },
};

// ==========================================
// GERENCIAMENTO DE GRUPOS DE CONFIGURAÇÃO
// ==========================================

export const groupData = {
  // Lista todos os grupos de todos os produtos
  getAll: () => readJsonFile<Group>('groups.json'),

  // Busca grupos de um produto específico
  getByProductId: (productId: string) => readJsonFile<Group>('groups.json').filter(g => g.productId === productId),

  // Cria novo grupo para um produto
  create: (group: Group) => {
    const groups = readJsonFile<Group>('groups.json');
    groups.push(group);
    writeJsonFile('groups.json', groups);
  },

  update: (id: string, updates: Partial<Group>) => {
    const groups = readJsonFile<Group>('groups.json');
    const index = groups.findIndex((g) => g.id === id);
    if (index !== -1) {
      groups[index] = { ...groups[index], ...updates };
      writeJsonFile('groups.json', groups);
    }
  },

  delete: (id: string) => {
    const groups = readJsonFile<Group>('groups.json').filter((g) => g.id !== id);
    writeJsonFile('groups.json', groups);
  },
};

// ==========================================
// GERENCIAMENTO DE VARIÁVEIS DE PRODUTO
// ==========================================

export const variableData = {
  // Lista todas as variáveis de todos os grupos
  getAll: () => readJsonFile<Variable>('variables.json'),

  // Busca variáveis de um grupo específico
  getByGroupId: (groupId: string) => readJsonFile<Variable>('variables.json').filter(v => v.groupId === groupId),

  // Adiciona nova variável a um grupo
  create: (variable: Variable) => {
    const variables = readJsonFile<Variable>('variables.json');
    variables.push(variable);
    writeJsonFile('variables.json', variables);
  },

  // Atualiza quantidade em estoque de uma variável
  updateStock: (id: string, newStock: number) => {
    const variables = readJsonFile<Variable>('variables.json');
    const index = variables.findIndex(v => v.id === id);
    if (index !== -1) {
      variables[index].stock = newStock;
      writeJsonFile('variables.json', variables);
    }
  },

  update: (id: string, updates: Partial<Variable>) => {
    const variables = readJsonFile<Variable>('variables.json');
    const index = variables.findIndex((v) => v.id === id);
    if (index !== -1) {
      variables[index] = { ...variables[index], ...updates };
      writeJsonFile('variables.json', variables);
    }
  },

  delete: (id: string) => {
    const variables = readJsonFile<Variable>('variables.json').filter((v) => v.id !== id);
    writeJsonFile('variables.json', variables);
  },
};

// ==========================================
// GERENCIAMENTO DE PEDIDOS DE VENDA
// ==========================================

export const orderData = {
  // Lista todos os pedidos do sistema
  getAll: () => readJsonFile<Order>('orders.json'),

  // Registra novo pedido no sistema
  create: (order: Order) => {
    const orders = readJsonFile<Order>('orders.json');
    orders.push(order);
    writeJsonFile('orders.json', orders);
  },

  // Atualiza status ou dados de pedido existente
  update: (id: string, updates: Partial<Order>) => {
    const orders = readJsonFile<Order>('orders.json');
    const index = orders.findIndex((order) => order.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      writeJsonFile('orders.json', orders);
    }
  },

  delete: (id: string) => {
    const orders = readJsonFile<Order>('orders.json').filter((order) => order.id !== id);
    writeJsonFile('orders.json', orders);
  },
};

// ==========================================
// GERENCIAMENTO DE REGISTROS FINANCEIROS
// ==========================================

export const financeData = {
  // Lista todas as transações financeiras
  getAll: () => readJsonFile<FinancialRecord>('finance.json'),

  // Registra nova transação financeira
  create: (record: FinancialRecord) => {
    const records = readJsonFile<FinancialRecord>('finance.json');
    records.push(record);
    writeJsonFile('finance.json', records);
  },

  update: (id: string, updates: Partial<FinancialRecord>) => {
    const records = readJsonFile<FinancialRecord>('finance.json');
    const index = records.findIndex((record) => record.id === id);
    if (index !== -1) {
      records[index] = { ...records[index], ...updates };
      writeJsonFile('finance.json', records);
    }
  },

  delete: (id: string) => {
    const records = readJsonFile<FinancialRecord>('finance.json').filter((record) => record.id !== id);
    writeJsonFile('finance.json', records);
  },
};

// ==========================================
// GERENCIAMENTO DE NOTAS FISCAIS
// ==========================================

export const invoiceData = {
  // Lista todas as notas fiscais emitidas
  getAll: () => readJsonFile<Invoice>('invoices.json'),

  // Registra nova nota fiscal
  create: (invoice: Invoice) => {
    const invoices = readJsonFile<Invoice>('invoices.json');
    invoices.push(invoice);
    writeJsonFile('invoices.json', invoices);
  },
};

// ==========================================
// GERENCIAMENTO DE PEDIDOS DE COMPRA
// ==========================================

export const purchaseOrderData = {
  // Lista todos os pedidos de compra
  getAll: () => readJsonFile<PurchaseOrder>('purchase-orders.json'),

  // Registra novo pedido de compra
  create: (po: PurchaseOrder) => {
    const pos = readJsonFile<PurchaseOrder>('purchase-orders.json');
    pos.push(po);
    writeJsonFile('purchase-orders.json', pos);
  },

  update: (id: string, updates: Partial<PurchaseOrder>) => {
    const pos = readJsonFile<PurchaseOrder>('purchase-orders.json');
    const index = pos.findIndex((item) => item.id === id);
    if (index !== -1) {
      pos[index] = { ...pos[index], ...updates };
      writeJsonFile('purchase-orders.json', pos);
    }
  },

  delete: (id: string) => {
    const pos = readJsonFile<PurchaseOrder>('purchase-orders.json').filter((item) => item.id !== id);
    writeJsonFile('purchase-orders.json', pos);
  },
};

// ==========================================
// GERENCIAMENTO DE FORNECEDORES
// ==========================================

export const supplierData = {
  // Lista todos os fornecedores cadastrados
  getAll: () => readJsonFile<Supplier>('suppliers.json'),

  // Adiciona novo fornecedor
  create: (supplier: Supplier) => {
    const suppliers = readJsonFile<Supplier>('suppliers.json');
    suppliers.push(supplier);
    writeJsonFile('suppliers.json', suppliers);
  },
};

// ==========================================
// GERENCIAMENTO DE ORÇAMENTOS (QUOTES)
// ==========================================

export const quoteData = {
  // Lista todos os orçamentos
  getAll: () => readJsonFile<Quote>('quotes.json'),

  // Busca orçamento por ID
  getById: (id: string) => readJsonFile<Quote>('quotes.json').find(q => q.id === id),

  // Cria novo orçamento
  create: (quote: Quote) => {
    const quotes = readJsonFile<Quote>('quotes.json');
    quotes.push(quote);
    writeJsonFile('quotes.json', quotes);
  },

  // Atualiza orçamento existente
  update: (id: string, updates: Partial<Quote>) => {
    const quotes = readJsonFile<Quote>('quotes.json');
    const index = quotes.findIndex(q => q.id === id);
    if (index !== -1) {
      quotes[index] = { ...quotes[index], ...updates };
      writeJsonFile('quotes.json', quotes);
    }
  },

  // Remove orçamento
  delete: (id: string) => {
    const quotes = readJsonFile<Quote>('quotes.json').filter(q => q.id !== id);
    writeJsonFile('quotes.json', quotes);
  },
};

// ==========================================
// GERENCIAMENTO DE HISTÓRICO DE PREÇOS
// ==========================================

export const priceHistoryData = {
  // Lista todo o histórico de preços
  getAll: () => readJsonFile<PriceHistory>('price-history.json'),

  // Busca histórico de uma entidade específica
  getByEntityId: (entityId: string) => readJsonFile<PriceHistory>('price-history.json').filter(ph => ph.entityId === entityId),

  // Registra uma mudança de preço
  create: (entry: PriceHistory) => {
    const history = readJsonFile<PriceHistory>('price-history.json');
    history.push(entry);
    writeJsonFile('price-history.json', history);
  },
};
