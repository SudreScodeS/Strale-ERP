-- ==========================================
-- Schema SQL para Elitium-ERP (PostgreSQL)
-- Execute este arquivo para criar as tabelas necessárias
-- ==========================================

-- Usuários do sistema
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'seller',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Produtos base do catálogo
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grupos de configuração (Material, Cor, Tamanho, etc.)
CREATE TABLE IF NOT EXISTS groups (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  product_id VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  watch_stock_alert INTEGER,
  critical_stock_alert INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Variáveis dentro de cada grupo
CREATE TABLE IF NOT EXISTS variables (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  additional_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  group_id VARCHAR(36) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pedidos de venda
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  logo_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Registros financeiros
CREATE TABLE IF NOT EXISTS finance (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  order_id VARCHAR(36) REFERENCES orders(id)
);

-- Notas fiscais
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
  number VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pedidos de compra
CREATE TABLE IF NOT EXISTS purchase_orders (
  id VARCHAR(36) PRIMARY KEY,
  supplier_id VARCHAR(36) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fornecedores
CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orçamentos (quotes)
CREATE TABLE IF NOT EXISTS quotes (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id),
  customer_name VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  logo_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  valid_until TIMESTAMP,
  notes TEXT,
  converted_order_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Histórico de preços
CREATE TABLE IF NOT EXISTS price_history (
  id VARCHAR(36) PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  old_price DECIMAL(10,2) NOT NULL,
  new_price DECIMAL(10,2) NOT NULL,
  changed_by VARCHAR(100) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_groups_product ON groups(product_id);
CREATE INDEX IF NOT EXISTS idx_variables_group ON variables(group_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_finance_type ON finance(type);
CREATE INDEX IF NOT EXISTS idx_finance_order ON finance(order_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_price_history_entity ON price_history(entity_type, entity_id);
