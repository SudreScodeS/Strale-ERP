# Simple ERP - Sistema de Gestão Empresarial Completo

## 🎯 Visão Geral

O **Simple ERP** é um sistema completo de gestão empresarial desenvolvido em **Next.js 16** com **TypeScript** e **Tailwind CSS**. Especializado em empresas que trabalham com produtos customizáveis (como camisetas, canecas, brindes personalizados), oferece módulos integrados de estoque, vendas, finanças e emissão de notas fiscais.

**Diferencial**: Arquitetura preparada para crescimento, com abstração de dados que facilita migração para PostgreSQL e integrações com APIs externas.

## 🏗️ Arquitetura Técnica

### Tecnologias Principais
- **Frontend**: Next.js 16 (App Router), React 18, TypeScript 5.x, Tailwind CSS
- **Backend**: API Routes do Next.js (Serverless Functions)
- **Autenticação**: JWT (JSON Web Tokens) + bcrypt para hash seguro de senhas
- **Banco de Dados**: JSON files local (preparado para PostgreSQL)
- **Estado**: Client-side state management com React hooks
- **Build**: Turbopack para desenvolvimento rápido

### Estrutura de Diretórios
```
📁 Simple-erp/
├── 📁 app/                    # Next.js App Router
│   ├── 📁 api/               # Endpoints REST da API
│   │   ├── 📁 auth/          # Autenticação (login/register)
│   │   ├── 📁 inventory/     # Gestão de produtos/estoque
│   │   ├── 📁 orders/        # Pedidos de venda
│   │   ├── 📁 finance/       # Relatórios financeiros
│   │   ├── 📁 dashboard/     # Métricas do dashboard
│   │   └── 📁 config/        # Configurações globais
│   ├── 📁 components/        # Componentes React reutilizáveis
│   ├── 📁 lib/              # Lógica de negócio e utilitários
│   │   ├── 📄 data.ts        # Camada de abstração de dados
│   │   ├── 📄 auth.ts        # Autenticação e autorização
│   │   ├── 📄 business.ts    # Regras de negócio
│   │   └── 📄 dashboard.ts   # Lógica do dashboard
│   ├── 📄 layout.tsx         # Layout principal da aplicação
│   ├── 📄 page.tsx           # Dashboard administrativo
│   ├── 📄 globals.css        # Estilos globais
│   └── 📁 [páginas]/         # Páginas específicas (login, sales, etc.)
├── 📁 config/                # Configurações globais editáveis
│   └── 📄 global.ts          # Regras de negócio configuráveis
├── 📁 types/                 # Definições TypeScript
│   └── 📄 index.ts           # Interfaces e tipos do sistema
├── 📁 data/                  # "Banco de dados" JSON
│   ├── 📄 users.json         # Usuários do sistema
│   ├── 📄 products.json      # Produtos base
│   ├── 📄 groups.json        # Grupos de configuração
│   ├── 📄 variables.json     # Variáveis de produto
│   ├── 📄 orders.json        # Pedidos de venda
│   ├── 📄 finance.json       # Registros financeiros
│   ├── 📄 invoices.json      # Notas fiscais
│   ├── 📄 suppliers.json     # Fornecedores
│   └── 📄 purchase-orders.json # Pedidos de compra
├── 📄 package.json           # Dependências e scripts
├── 📄 tailwind.config.js     # Configuração Tailwind CSS
└── 📄 README.md              # Esta documentação
```

## 🚀 Funcionalidades Principais

### 1. 📦 Gestão de Produtos e Estoque
- **Produtos Base**: Cadastro de produtos principais (camiseta, caneca, boné, etc.)
- **Grupos de Configuração**: Categorias de personalização (tamanho, cor, material, estampa)
- **Variáveis**: Opções específicas dentro de cada grupo (P/M/G/XG para tamanho)
- **Controle de Estoque**: Quantidade individual por variável com alertas automáticos
- **Preços Dinâmicos**: Custo base do produto + adicionais por variável selecionada

### 2. 🛒 Sistema de Vendas
- **Pedidos Customizáveis**: Cliente escolhe produto + variações + upload de logo
- **Análise de Logo**: Simulação de IA para contar cores do logo (preparado para API real)
- **Cálculo Automático**: Preço = custo + markup configurável + custo do logo
- **Baixa Automática**: Estoque reduzido automaticamente na venda
- **Nota Fiscal**: Geração automática de NF com dados completos do pedido

### 3. 💰 Gestão Financeira
- **Registro Automático**: Toda venda gera entrada no financeiro
- **Relatórios**: Totais de vendas, despesas e cálculo de lucros
- **Margem Configurável**: Percentual de lucro ajustável globalmente
- **Histórico Completo**: Rastreamento de todas as transações

### 4. 🔐 Controle de Acesso
- **Dois Níveis**: Admin (acesso total) e Seller (apenas vendas próprias)
- **Autenticação JWT**: Sessões seguras com expiração automática
- **Proteção de Rotas**: Middleware que valida permissões automaticamente
- **Páginas Protegidas**: Redirecionamento inteligente baseado na role

## 📊 Regras de Negócio

### Cálculos de Preço
```
Preço de Venda = (Custo Base + Σ Custos das Variáveis) × (1 + Margem/100) + Custo do Logo

Exemplo Prático:
- Camiseta básica: R$ 20,00
- Tamanho G: +R$ 3,00
- Logo 3 cores: +R$ 30,00
- Subtotal: R$ 53,00
- Margem 20%: +R$ 10,60
- Preço Final: R$ 63,60
```

### Alertas de Estoque
- **Configurável Globalmente**: Padrão ≤ 5 unidades por variável
- **Personalizável por Produto**: Produtos críticos podem ter limites diferentes
- **Sugestão Automática**: Sistema identifica itens para reposição

### Personalização de Logo
- **Análise Simulada**: Baseada no tamanho do arquivo de imagem
- **Custo por Cor**: Configurável (padrão: R$ 10 por cor detectada)
- **Integração Futura**: Preparado para APIs como Google Vision, AWS Rekognition

## 🛠️ Instalação e Configuração

### Pré-requisitos
- **Node.js**: Versão 18.0 ou superior
- **npm** ou **yarn**: Gerenciador de pacotes
- **Git**: Para clonar o repositório

### Instalação Rápida
```bash
# 1. Clonar o repositório
git clone [url-do-repositorio]
cd Simple-erp

# 2. Instalar dependências
npm install

# 3. Executar em desenvolvimento
npm run dev

# 4. Acessar no navegador
# http://localhost:3000
```

### Build para Produção
```bash
# Build otimizado
npm run build

# Executar em produção
npm start
```

### Configuração Inicial
1. **Primeiro Login**: Use as credenciais padrão
   - Usuário: `admin`
   - Senha: `admin123`

2. **Ajustes Iniciais**:
   - Modificar configurações em `config/global.ts`
   - Cadastrar produtos e variações
   - Testar fluxo completo de vendas

## 🔌 API Endpoints

### Autenticação
```http
POST /api/auth/login       # Login de usuário
POST /api/auth/register    # Cadastro (apenas admin)
```

### Gestão de Estoque
```http
GET  /api/inventory        # Listar produtos, grupos e variáveis
POST /api/inventory        # Criar produto/grupo/variável
PATCH /api/inventory       # Atualizar estoque/preços
```

### Vendas e Pedidos
```http
GET  /api/orders           # Listar pedidos (com filtro por role)
POST /api/orders           # Criar/finalizar pedido
PATCH /api/orders          # Atualizar status do pedido
```

### Financeiro
```http
GET /api/finance           # Relatório financeiro
POST /api/finance          # Registrar transação manual
```

### Dashboard e Configurações
```http
GET /api/dashboard         # Métricas consolidadas
GET /api/config            # Configurações globais
```

## ⚙️ Configurações Editáveis

### Arquivo `config/global.ts`
```typescript
export const globalConfig = {
  profitMargin: 20,        // Margem de lucro em %
  logoPricePerColor: 10,   // R$ por cor na logo
  minStockAlert: 5,        // Alerta quando estoque ≤ 5
  systemName: 'Simple ERP', // Nome exibido no sistema
  companyName: 'Minha Empresa' // Para notas fiscais
};
```

### Como Modificar Configurações
1. Editar valores em `config/global.ts`
2. Testar impacto nos cálculos
3. Verificar relatórios e preços
4. Fazer backup antes de alterações em produção

## 🚀 Migração para Produção

### Banco de Dados
**Atual**: JSON files para simplicidade de desenvolvimento
**Produção**: PostgreSQL recomendado

#### Passos para Migração:
1. **Instalar PostgreSQL** e criar banco
2. **Configurar conexão** em variável de ambiente
3. **Instalar ORM** (recomendado: Prisma ou Drizzle)
4. **Migrar dados** dos JSON para tabelas SQL
5. **Atualizar `lib/data.ts`** com queries SQL

### Segurança em Produção
```bash
# Variáveis de ambiente obrigatórias
JWT_SECRET=chave-secreta-muito-forte-aqui
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NODE_ENV=production
```

### Melhorias de Performance
- **Redis**: Para cache de sessões e dados frequentes
- **CDN**: Para assets estáticos (imagens, CSS, JS)
- **Database Indexing**: Índices em campos de busca frequente
- **Pagination**: Em listagens grandes de pedidos/produtos

## 🧪 Desenvolvimento

### Scripts Disponíveis
```bash
npm run dev          # Desenvolvimento com hot reload
npm run build        # Build para produção
npm run start        # Executar build de produção
npm run lint         # Verificar qualidade do código
npm test            # Executar testes (quando implementados)
```

### Convenções de Código
- **TypeScript**: Tipagem estrita obrigatória
- **Componentes**: Funções nomeadas com props tipadas
- **API**: Padrão REST com códigos HTTP apropriados
- **Estado**: Client-side com hooks do React
- **Commits**: Padrão Conventional Commits

### Debugging
- **API Routes**: Logs aparecem no terminal do servidor
- **Client-side**: React DevTools no navegador
- **Database**: Verificar arquivos JSON em `/data/`
- **Network**: Aba Network do DevTools para requests

## 📈 Monitoramento e Logs

### Métricas Essenciais
- **Performance**: Tempo de resposta das APIs
- **Uptime**: Disponibilidade do sistema
- **Vendas**: Volume diário de pedidos
- **Estoque**: Itens com estoque crítico

### Logs Importantes
- Tentativas de login (sucesso/falha)
- Erros em cálculos de preço
- Baixas de estoque abaixo do mínimo
- Modificações em configurações globais

## 🔄 Roadmap de Melhorias

### Próximas Versões (Planejado)
1. **v2.0**: Dashboard com gráficos e métricas em tempo real
2. **v2.1**: Integração com gateways de pagamento
3. **v2.2**: Sistema de notificações push/email
4. **v2.3**: Mobile app com React Native
5. **v2.4**: Multi-empresa (mesmo sistema para várias empresas)

### Funcionalidades Futuras
- ✅ Relatórios avançados (PDF/Excel)
- ✅ Integração com marketplaces (Mercado Livre, Shopify)
- ✅ Controle de qualidade de produtos
- ✅ Gestão avançada de fornecedores
- ✅ Sistema de devoluções e trocas
- ✅ API para integrações externas
- ✅ Backup automático e recuperação

## 🆘 Suporte e Troubleshooting

### Problemas Comuns

**Erro de Login**:
- Verificar se usuário existe em `data/users.json`
- Confirmar senha (lembrar: senhas são hasheadas)

**Preços Incorretos**:
- Verificar configurações em `config/global.ts`
- Checar se variáveis têm preços adicionais corretos

**Estoque Não Baixa**:
- Confirmar que pedido foi finalizado com sucesso
- Verificar se variáveis existem e têm estoque

### Backup Essencial
- Pasta `/data/` completa (todos os JSON)
- Arquivo `config/global.ts`
- Logs do sistema (se implementados)

## 📝 Licença e Créditos

**Desenvolvido com ❤️ para empresas que valorizam eficiência e controle total dos seus processos.**

---

**🚀 Pronto para escalar seu negócio? O Simple ERP cresce com você!**
