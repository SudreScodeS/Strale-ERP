// types/index.ts
// Arquivo de tipos globais para o sistema ERP
// Este arquivo define as interfaces e tipos principais usados em todo o sistema
// Decisão arquitetural: Centralizar tipos para facilitar manutenção e consistência

// Interface para usuários do sistema
// Define estrutura completa de dados do usuário incluindo autenticação e permissões
export interface User {
  id: string; // ID único gerado por UUID
  username: string; // Nome de usuário para login (único no sistema)
  email: string; // Email do usuário (usado para notificações futuras)
  password: string; // Senha hashada com bcrypt (NUNCA armazenar em texto plano)
  role: 'admin' | 'seller'; // Controle de acesso: admin tem acesso total, seller só vendas
  createdAt: Date; // Data de criação do usuário
}

// Interface para produtos base do catálogo
// Representa produtos principais que podem ter variações (grupos e variáveis)
export interface Product {
  id: string; // ID único do produto
  name: string; // Nome comercial do produto
  basePrice: number; // Preço base antes de variações
  description?: string; // Descrição opcional do produto
  imageUrl?: string; // Imagem principal para preview do produto
  createdAt: Date; // Data de criação do produto
}

// Interface para grupos de configuração
// Agrupa variáveis relacionadas (ex: "Material", "Tamanho", "Cor")
export interface Group {
  id: string; // ID único do grupo
  name: string; // Nome do grupo (ex: "Material", "Tamanho")
  productId: string; // Produto ao qual este grupo pertence
  watchStockAlert?: number; // Limite de atenção (fique de olho)
  criticalStockAlert?: number; // Limite de estoque crítico
  createdAt: Date; // Data de criação do grupo
}

// Interface para variáveis de produto
// Representa opções específicas dentro de um grupo (ex: "Nylon", "TNT", "Pequeno")
export interface Variable {
  id: string; // ID único da variável
  name: string; // Nome da opção (ex: "Nylon", "Grande")
  additionalPrice: number; // Preço adicional sobre o base do produto
  stock: number; // Quantidade em estoque desta variável
  groupId: string; // Grupo ao qual esta variável pertence
  createdAt: Date; // Data de criação da variável
}

// Interface para pedidos de venda
// Representa uma venda completa com itens, custos e status
export interface Order {
  id: string; // ID único do pedido
  userId: string; // Usuário que criou o pedido
  name: string; // Nome amigável do pedido
  items: OrderItem[]; // Lista de itens do pedido
  totalCost: number; // Custo total dos itens (sem margem)
  totalPrice: number; // Preço final com margem de lucro
  logoCost: number; // Custo adicional da personalização de logo
  status: 'pending' | 'completed' | 'cancelled'; // Status do processamento
  createdAt: Date; // Data de criação do pedido
}

// Interface para itens individuais do pedido
// Detalha cada produto/variável selecionada no pedido
export interface OrderItem {
  productId: string; // Produto base selecionado
  selectedVariables: { groupId: string; variableId: string; quantity: number }[]; // Variações escolhidas com quantidade por variável
  quantity: number; // Quantidade deste item
  unitCost: number; // Custo unitário (produto + variações)
  unitPrice: number; // Preço unitário final (com margem)
}

// Interface para registros financeiros
// Acompanha todas as transações monetárias do sistema
export interface FinancialRecord {
  id: string; // ID único do registro
  type: 'sale' | 'purchase' | 'expense'; // Tipo da transação
  amount: number; // Valor da transação
  description: string; // Descrição detalhada
  date: Date; // Data da transação
  orderId?: string; // Vinculado a pedido se for venda
}

// Interface para dados estruturados da nota fiscal
// Preparado para integração com sistemas de emissão de NF
export interface InvoiceData {
  customer: string; // ID ou dados do cliente
  items: OrderItem[]; // Itens da venda
  totalPrice: number; // Valor total
  issuedAt: string; // Data de emissão
}

// Interface para notas fiscais emitidas
// Vincula NF ao pedido e armazena dados estruturados
export interface Invoice {
  id: string; // ID único da NF
  orderId: string; // Pedido relacionado
  number: string; // Número da nota fiscal
  data: InvoiceData; // Dados estruturados da NF
  createdAt: Date; // Data de criação da NF
}

// Interface para pedidos de compra
// Gerencia compras de fornecedores para reposição de estoque
export interface PurchaseOrder {
  id: string; // ID único do pedido de compra
  supplierId: string; // Fornecedor destinatário
  items: PurchaseItem[]; // Itens a comprar
  status: 'pending' | 'ordered' | 'received'; // Status do pedido
  createdAt: Date; // Data de criação
}

// Interface para itens do pedido de compra
// Especifica o que comprar de cada variável
export interface PurchaseItem {
  variableId: string; // Variável/produto a comprar
  quantity: number; // Quantidade a adquirir
  unitCost: number; // Custo unitário de compra
}

// Interface para fornecedores
// Cadastro de empresas fornecedoras
export interface Supplier {
  id: string; // ID único do fornecedor
  name: string; // Nome da empresa fornecedora
  contact?: string; // Informações de contato
  createdAt: Date; // Data de cadastro
}

// Interface para resultado da análise de logo
// Usado para calcular custo de personalização
export interface LogoAnalysis {
  colors: number; // Número de cores detectadas
  cost: number; // Custo calculado baseado nas cores
}

// Interface para configurações globais do sistema
// Todas as regras de negócio configuráveis centralizadas
export interface GlobalConfig {
  profitMargin: number; // Margem de lucro em % (ex: 20 = 20%)
  logoPricePerColor: number; // Preço por cor na logo em R$
  minStockAlert: number; // Estoque mínimo para alertas
  systemName: string; // Nome do sistema exibido na UI
  companyName: string; // Nome da empresa exibido na UI
}
