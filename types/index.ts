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
  deliveryDate?: string; // Data de entrega prevista (ISO string)
  delivered?: boolean; // Se já foi entregue
  deliveredAt?: string; // Data em que foi marcado como entregue (ISO string)
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

// Interface para orçamentos (quotes)
// Representa uma proposta comercial antes de virar pedido
// Diferença do Order: não baixa estoque, tem validade, pode ser clonado
export interface Quote {
  id: string; // ID único do orçamento
  userId: string; // Usuário que criou
  customerName: string; // Nome do cliente (livre, sem cadastro obrigatório)
  name: string; // Nome/descrição do orçamento
  items: QuoteItem[]; // Itens do orçamento
  totalCost: number; // Custo total (sem margem)
  totalPrice: number; // Preço final (com margem)
  logoCost: number; // Custo da personalização
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'converted'; // Status
  deliveryDate?: string; // Data de entrega prevista (ISO string, opcional no orçamento)
  validUntil?: string; // Data de validade (ISO string)
  notes?: string; // Observações internas
  convertedOrderId?: string; // ID do pedido gerado quando convertido
  createdAt: Date; // Data de criação
}

// Interface para itens do orçamento
export interface QuoteItem {
  productId: string; // Produto base
  productName: string; // Nome do produto (snapshot)
  selectedVariables: { groupId: string; variableId: string; quantity: number }[]; // Variáveis
  quantity: number; // Quantidade
  unitCost: number; // Custo unitário
  unitPrice: number; // Preço unitário com margem
  dimensions?: { width: number; height: number }; // Dimensões opcionais (cm)
  printType?: string; // Tipo de impressão (serigrafia, sublimação, DTF)
  printPosition?: string; // Posição (frente, verso, ambos)
  printSize?: 'small' | 'medium' | 'large'; // Tamanho da logo
}

// Interface para tabela de preços por faixa de quantidade
// Permite descontos progressivos por volume
export interface PriceTier {
  minQty: number; // Quantidade mínima desta faixa
  maxQty?: number; // Quantidade máxima (undefined = sem limite)
  unitPrice: number; // Preço unitário nesta faixa
  label?: string; // Rótulo (ex: "Atacado", "Varejo")
}

// Interface para regra de preço de impressão
export interface PrintPricingRule {
  printType: string; // Tipo: serigrafia, sublimacao, dtf
  size: 'small' | 'medium' | 'large'; // Tamanho
  position: 'front' | 'back' | 'both'; // Posição
  baseCost: number; // Custo base
  costPerColor?: number; // Custo adicional por cor
}

// Interface para configurações globais do sistema
// Todas as regras de negócio configuráveis centralizadas
export interface PrintType {
  value: string;  // ID interno (ex: 'serigrafia')
  label: string;  // Nome exibido (ex: 'Serigrafia')
}

export interface GlobalConfig {
  profitMargin: number; // Margem de lucro em % (ex: 20 = 20%)
  logoPricePerColor: number; // Preço por cor na logo em R$
  minStockAlert: number; // Estoque mínimo para alertas
  systemName: string; // Nome do sistema exibido na UI
  companyName: string; // Nome da empresa exibido na UI
  quoteValidityDays: number; // Dias de validade padrão do orçamento
  priceTiers: PriceTier[]; // Tabela de preços por faixa de quantidade
  printPricingRules: PrintPricingRule[]; // Regras de preço de impressão
  printTypes: PrintType[]; // Tipos de impressão disponíveis
  pricePerCm2?: number; // Preço por cm² para cálculo por dimensão (opcional)
}

// ==========================================
// TIPOS DE AUTENTICACAO
// ==========================================

// Interface para histórico de preços
// Rastreia mudanças de preço ao longo do tempo para produtos e variáveis
export interface PriceHistory {
  id: string;
  entityType: 'product' | 'variable';
  entityId: string;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  reason?: string;
  createdAt: Date;
}

export interface TokenPayload {
  id: string;
  username: string;
  role: 'admin' | 'seller';
  exp?: number;
}
