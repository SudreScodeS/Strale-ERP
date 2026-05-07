# Elitium - Sistema de Gestão Empresarial Completo

## 🎯 Visão Geral

O **Elitium** é um sistema completo de gestão empresarial desenvolvido em **Next.js 16** com **TypeScript** e **Tailwind CSS**. Especializado em empresas que trabalham com produtos customizáveis (como sacolas personalizadas, televisões, etc.), oferece módulos integrados de estoque, vendas, finanças, previsão de demanda, detecção de fraude e assistente inteligente — **tudo 100% local, sem dependência de APIs externas de IA**.

## 🧠 Módulos Inteligentes (100% Locais)

### 📈 Previsão de Demanda
- Análise de histórico de vendas por semana ISO
- Regressão linear para detecção de tendências (crescente/estável/decrescente)
- Previsão de demanda semanal e mensal com ajuste de tendência
- Recomendação de reposição de estoque (meta: 4 semanas de cobertura)
- Detecção de excesso de estoque (>8 semanas de demanda parada)
- Classificação de risco: alto, médio, baixo, sem risco

### 🛡️ Detecção de Fraude
- Score de risco 0-100 com 11 regras de análise
- Análise automática a cada pedido finalizado
- Regras: valor alto, frequência, intervalo entre pedidos, quantidades anormais, usuário novo, cancelamentos, produtos atípicos
- Classificação: aprovado (<40), suspeito (40-69), bloqueado (70+)
- Logs de análise salvos para auditoria e revisão por admin
- Dashboard com pendentes de revisão e tendências semanais

### 🤖 Assistente Inteligente
- Perguntas em linguagem natural (português)
- 20+ intenções: "produto mais vendido", "estoque baixo", "lucro total", "previsão de demanda", etc.
- Pattern matching local — sem APIs externas, sem ChatGPT
- Respostas com dados reais do sistema
- Interface de chat com sugestões clicáveis

### 🎨 Análise de Logo (Local)
- Detecção de cores dominantes via **sharp** (processamento local de imagem)
- Quantização por bucketing para identificar cores significativas
- Nomeação automática das cores em português
- Classificação de complexidade (Elitium/moderate/complex)
- Google Cloud Vision é **opcional** — funciona sem nenhuma configuração externa

## 🏗️ Arquitetura Técnica

### Tecnologias Principais
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: API Routes do Next.js (Serverless Functions)
- **Autenticação**: JWT + bcryptjs
- **Banco de Dados**: JSON files (preparado para PostgreSQL)
- **Processamento de Imagem**: sharp (local, sem API externa)
- **IDs**: UUID v4

### Estrutura de Diretórios
```
📁 Elitium-ERP/
├── 📁 app/
│   ├── 📁 api/
│   │   ├── 📁 assistant/       # Assistente inteligente
│   │   ├── 📁 auth/            # Login / Registro
│   │   ├── 📁 config/          # Configurações globais
│   │   ├── 📁 dashboard/       # Métricas consolidadas
│   │   ├── 📁 demand-forecast/ # Previsão de demanda
│   │   ├── 📁 finance/         # Financeiro
│   │   ├── 📁 fraud/           # Detecção de fraude
│   │   ├── 📁 inventory/       # Estoque (produto/grupo/variável)
│   │   ├── 📁 logo-analysis/   # Análise de imagem
│   │   ├── 📁 orders/          # Pedidos
│   │   ├── 📁 purchases/       # Compras
│   │   ├── 📁 suppliers/       # Fornecedores
│   │   ├── 📁 system/          # Health check do sistema
│   │   └── 📁 users/           # Usuários
│   ├── 📁 components/          # UI reutilizável (Sidebar, MetricCard, etc.)
│   ├── 📁 lib/
│   │   ├── 📄 assistant.ts     # Motor de consultas em linguagem natural
│   │   ├── 📄 auth.ts          # Autenticação JWT
│   │   ├── 📄 authClient.ts    # Helpers de auth no client
│   │   ├── 📄 business.ts      # Regras de negócio (preço, pedidos, estoque)
│   │   ├── 📄 color-analyzer.ts# Análise de cores via sharp
│   │   ├── 📄 dashboard.ts     # Lógica do dashboard principal
│   │   ├── 📄 data.ts          # Camada de abstração de dados
│   │   ├── 📄 demand-forecast.ts# Motor de previsão de demanda
│   │   ├── 📄 fraud-detection.ts# Motor de detecção de fraude
│   │   ├── 📄 inventory.ts     # Consultas de estoque
│   │   └── 📄 vision.ts        # Análise de logo (local + Google Vision opcional)
│   ├── 📁 assistant/           # Chat do assistente
│   ├── 📁 demand-forecast/     # Dashboard de previsão
│   ├── 📁 fraud/               # Dashboard de fraudes
│   ├── 📁 finance/             # Dashboard financeiro
│   ├── 📁 inventory/           # Gestão de estoque
│   ├── 📁 login/               # Login
│   ├── 📁 purchases/           # Compras
│   ├── 📁 register/            # Registro
│   ├── 📁 sales/               # Pedidos (criar + buscar)
│   └── 📁 users/               # Gestão de usuários
├── 📁 config/
│   └── 📄 global.ts            # Configurações editáveis
├── 📁 data/                    # JSON files (banco de dados)
│   ├── 📄 finance.json
│   ├── 📄 fraud-logs.json
│   ├── 📄 groups.json
│   ├── 📄 invoices.json
│   ├── 📄 orders.json
│   ├── 📄 products.json
│   ├── 📄 purchase-orders.json
│   ├── 📄 suppliers.json
│   ├── 📄 users.json
│   └── 📄 variables.json
├── 📁 types/
│   └── 📄 index.ts             # Interfaces globais
└── 📄 package.json
```

## 🚀 Funcionalidades

### 📦 Estoque
- Produtos base com grupos de configuração (Material, Tamanho, etc.)
- Variáveis com estoque individual e preço adicional
- Alertas automáticos: crítico (≤10) e atenção (≤30)

### 🛒 Vendas
- Fluxo completo: selecionar produto → variáveis → upload logo → calcular preço → finalizar
- Carrinho de compras com múltiplos itens
- Cálculo automático: custo + markup + custo do logo
- Baixa automática do estoque
- Geração de nota fiscal

### 💰 Financeiro
- Registro automático de vendas
- Controle de despesas e compras
- Cálculo de lucro (vendas - despesas)

### 🔐 Autenticação
- Dois perfis: admin (acesso total) e seller (vendas)
- JWT com expiração
- Proteção de rotas e páginas

## 🔌 API Endpoints (13 rotas)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Registro (admin) |
| GET | `/api/inventory` | Listar estoque |
| POST/PATCH | `/api/inventory` | Criar/atualizar produto/grupo/variável |
| GET/POST/PATCH/DELETE | `/api/orders` | CRUD de pedidos |
| GET/POST | `/api/finance` | Financeiro |
| GET | `/api/dashboard` | Métricas do dashboard |
| POST | `/api/logo-analysis` | Análise de logo |
| GET/PATCH | `/api/fraud` | Detecção de fraude |
| GET | `/api/demand-forecast` | Previsão de demanda |
| POST | `/api/assistant` | Assistente inteligente |
| GET | `/api/system` | Health check do sistema |
| GET/POST | `/api/suppliers` | Fornecedores |
| GET/POST/PATCH | `/api/purchases` | Pedidos de compra |

## 📊 Fluxo Completo de Pedido

```
1. Usuário seleciona produto e variáveis
2. Upload de logo (análise local via sharp)
3. Sistema detecta cores dominantes automaticamente
4. Preço calculado: custo + variáveis + logo + margem
5. Pedido finalizado → dispara:
   ├── ✅ Baixa de estoque das variáveis
   ├── ✅ Registro financeiro automático
   ├── ✅ Geração de nota fiscal
   └── ✅ Análise de fraude (score 0-100)
6. Dashboard atualizado com novos dados
```

## ⚙️ Configurações (`config/global.ts`)

```typescript
export const globalConfig = {
  profitMargin: 20,          // Margem de lucro em %
  logoPricePerColor: 10,     // R$ por cor detectada na logo
  minStockAlert: 5,          // Alerta quando estoque ≤ 5
  systemName: 'Elitium',  // Nome do sistema
  companyName: 'North Bag',  // Nome da empresa
};
```

## 🛠️ Instalação

```bash
git clone https://github.com/SudreScodeS/Elitium-ERP.git
cd Elitium-ERP
npm install
npm run dev
```

Acesse `http://localhost:3000` — Login padrão: `admin` / `admin123`

## 🧪 Validação do Sistema

```bash
# Health check via API
curl http://localhost:3000/api/system

# Ou via interface: acesse qualquer página do dashboard
```

O endpoint `/api/system` verifica:
- ✅ Integridade de todos os arquivos JSON
- ✅ Funcionamento de cada módulo (dados, financeiro, estoque, previsão, fraude, assistente)
- ✅ Disponibilidade do sharp (análise de imagem)
- ✅ Status geral do sistema

## 📝 Licença

Desenvolvido com ❤️ para empresas que valorizam eficiência e controle total.

---

**🚀 100% local. Zero dependência externa de IA. Cresce com você.**
