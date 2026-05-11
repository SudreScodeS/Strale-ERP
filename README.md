# Elitium — Sistema de Gestão Empresarial

## Visão Geral

**Elitium** é um ERP desenvolvido em **Next.js 16**, **TypeScript** e **Tailwind CSS**, especializado em empresas que trabalham com **produtos customizáveis** — sacolas personalizadas, televisões, brindes corporativos, camisetas, e qualquer negócio que precise gerenciar estoque com variações (cor, tamanho, material) e calcular preço por dimensão/impressão.

**100% local** — sem dependência de APIs externas de IA. Tudo roda no servidor do cliente.

---

## Módulos

### Estoque Dinâmico
- Produtos base com **grupos de configuração** (Material, Tamanho, Cor, etc.)
- Variáveis com estoque individual e preço adicional
- Alertas automáticos: estoque crítico (≤10) e atenção (≤30)
- Estrutura hierárquica: Produto → Grupo → Variável

### Vendas
- Fluxo completo: selecionar produto → variáveis → configuração de impressão → upload de logo → calcular preço → finalizar
- Carrinho de compras com múltiplos itens
- Cálculo automático: custo base + variáveis + dimensão + impressão + margem
- Baixa automática do estoque ao finalizar pedido
- Geração de nota fiscal

### Orçamentos
- Criação de orçamentos profissionais com validade configurável
- Cálculo por dimensão (largura × altura em cm)
- Configuração detalhada de impressão (tipo, tamanho, posição)
- Tabela de preços por faixa de quantidade
- Clonagem rápida de orçamentos
- Ciclo de vida: rascunho → enviado → aprovado/rejeitado → convertido em pedido

### Previsão de Demanda
- Análise de histórico de vendas por **semana ISO**
- **Regressão linear** para detecção de tendências (crescente/estável/decrescente)
- Previsão de demanda semanal e mensal com ajuste de tendência
- Recomendação de reposição de estoque (meta: 4 semanas de cobertura)
- Detecção de excesso de estoque (>8 semanas de demanda parada)
- Classificação de risco: alto, médio, baixo, sem risco

### Assistente Inteligente
- Perguntas em **linguagem natural** (português)
- 20+ intenções pré-configuradas: "produto mais vendido", "estoque baixo", "lucro total", "previsão de demanda", etc.
- **Com Ollama:** entende perguntas livres (ex: "quanto custa 500 sacolas TNT azuis?")
- **Sem Ollama:** pattern matching local com sugestões clicáveis
- Respostas com dados reais do sistema
- Interface de chat com status da IA em tempo real

### Análise de Logo (Local)
- Detecção de cores dominantes via **sharp** (processamento local de imagem)
- Quantização por bucketing em espaço de cores **CIELAB** para identificar cores significativas
- Remoção automática de fundo
- Nomeação automática das cores em português
- Classificação de complexidade (simples/moderado/complexo)
- Google Cloud Vision é **opcional** — funciona sem nenhuma configuração externa

### Financeiro
- Registro automático de vendas como entradas
- Controle de despesas e compras como saídas
- Cálculo de lucro (vendas − despesas)
- Dashboard com métricas consolidadas

### Compras e Fornecedores
- Cadastro de fornecedores
- Pedidos de compra para reposição de estoque
- Sugestão automática de compra baseada na previsão de demanda
- Vinculação com registros financeiros

### Geração de Imagem de Produto
- Pipeline inteligente: análise de referência → geração via IA → recoloração → composição de logo
- Recoloração preservando luminância
- Composição de logo com efeitos profissionais (sombra, especular, textura)
- Cache de imagens geradas

### Autenticação e Usuários
- Dois perfis: **admin** (acesso total) e **seller** (vendas)
- JWT com expiração
- Proteção de rotas e páginas
- Gestão de usuários (criar, editar, desativar)

### Dashboard
- Métricas consolidadas em tempo real
- Vendas, estoque, financeiro em uma única visão
- Layout com seções arrastáveis e reorganizáveis

---

## Arquitetura Técnica

### Stack
| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | API Routes do Next.js (Serverless Functions) |
| Autenticação | JWT + bcryptjs |
| Banco de Dados | JSON files (preparado para PostgreSQL) |
| Processamento de Imagem | sharp (local, sem API externa) |
| IDs | UUID v4 |

### Estrutura de Diretórios

```
elitium-erp/
├── app/
│   ├── api/
│   │   ├── assistant/           # Assistente inteligente
│   │   ├── auth/                # Login / Registro
│   │   ├── config/              # Configurações globais
│   │   ├── dashboard/           # Métricas consolidadas
│   │   ├── demand-forecast/     # Previsão de demanda
│   │   ├── finance/             # Financeiro
│   │   ├── inventory/           # Estoque (produto/grupo/variável)
│   │   ├── logo-analysis/       # Análise de imagem
│   │   ├── orders/              # Pedidos
│   │   ├── product-image/       # Geração de imagem de produto
│   │   ├── purchases/           # Compras
│   │   ├── quotes/              # Orçamentos
│   │   ├── suppliers/           # Fornecedores
│   │   ├── system/              # Health check do sistema
│   │   └── users/               # Usuários
│   ├── components/              # UI reutilizável
│   │   ├── ui.tsx               # Sidebar, MetricCard, PageHeader
│   │   ├── layout-context.tsx   # Contexto de layout
│   │   ├── draggable-section.tsx# Seções arrastáveis
│   │   ├── product-preview.tsx  # Preview de produto com logo
│   │   └── protected.tsx        # Wrapper de autenticação
│   ├── lib/
│   │   ├── assistant.ts         # Motor de consultas em linguagem natural
│   │   ├── auth.ts              # Autenticação JWT (server)
│   │   ├── authClient.ts        # Helpers de auth (client)
│   │   ├── business.ts          # Regras de negócio
│   │   ├── color-analyzer.ts    # Análise de cores via sharp (K-means em CIELAB)
│   │   ├── config.ts            # Persistência de configurações
│   │   ├── dashboard.ts         # Lógica do dashboard
│   │   ├── data.ts              # Camada de abstração de dados (JSON)
│   │   ├── demand-forecast.ts   # Motor de previsão de demanda
│   │   ├── finance.ts           # Lógica financeira
│   │   ├── inventory.ts         # Consultas de estoque
│   │   ├── ollama-client.ts     # Cliente Ollama para IA local
│   │   ├── pricing.ts           # Motor de preços unificado
│   │   ├── purchases.ts         # Lógica de compras
│   │   └── vision.ts            # Análise de logo (local + Google Vision opcional)
│   ├── admin/                   # Painel administrativo
│   ├── assistant/               # Chat do assistente
│   ├── demand-forecast/         # Dashboard de previsão
│   ├── finance/                 # Dashboard financeiro
│   ├── inventory/               # Gestão de estoque
│   ├── login/                   # Login
│   ├── purchases/               # Compras
│   ├── quotes/                  # Orçamentos
│   ├── register/                # Registro
│   ├── reports/                 # Relatórios
│   ├── sales/                   # Pedidos (criar + buscar)
│   └── users/                   # Gestão de usuários
├── config/
│   └── global.ts                # Configurações editáveis do sistema
├── data/                        # JSON files (banco de dados)
│   ├── finance.json
│   ├── groups.json
│   ├── invoices.json
│   ├── orders.json
│   ├── products.json
│   ├── purchase-orders.json
│   ├── quotes.json
│   ├── suppliers.json
│   ├── users.json
│   └── variables.json
├── public/                      # Assets estáticos
├── types/
│   └── index.ts                 # Interfaces globais
├── .env.local.example           # Exemplo de variáveis de ambiente
└── package.json
```

---

## Fluxo Completo de Pedido

```
1. Usuário seleciona produto e variáveis (material, cor, tamanho...)
2. (Opcional) Configura dimensão (largura × altura) e impressão (tipo, tamanho, posição)
3. Upload de logo do cliente
4. Sistema analisa cores dominantes da logo (sharp, processamento local)
5. Preço calculado automaticamente:
   custo base + variáveis + dimensão + impressão + margem de lucro
6. Pedido finalizado → dispara:
   ├── Baixa de estoque das variáveis utilizadas
   ├── Registro financeiro automático (entrada)
   └── Geração de nota fiscal
7. Dashboard atualizado com novos dados
```

---

## Configurações (`config/global.ts`)

```typescript
export const globalConfig = {
  systemName: 'Elitium',         // Nome do sistema
  companyName: 'North Bag',      // Nome da empresa
  profitMargin: 20,              // Margem de lucro em %
  logoPricePerColor: 10,         // R$ por cor detectada na logo
  minStockAlert: 5,              // Alerta quando estoque ≤ 5
  quoteValidityDays: 7,          // Dias de validade padrão do orçamento
  pricePerCm2: 0.005,            // R$ por cm² para cálculo por dimensão
};
```

---

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Registro (admin) |
| GET | `/api/inventory` | Listar estoque completo |
| POST/PATCH | `/api/inventory/product` | Criar/atualizar produto |
| POST/PATCH | `/api/inventory/group` | Criar/atualizar grupo |
| POST/PATCH | `/api/inventory/variable` | Criar/atualizar variável |
| GET/POST/PATCH/DELETE | `/api/orders` | CRUD de pedidos |
| GET/POST/PATCH/DELETE | `/api/quotes` | CRUD de orçamentos |
| GET/POST | `/api/finance` | Financeiro |
| GET | `/api/dashboard` | Métricas do dashboard |
| GET/POST | `/api/config` | Configurações globais |
| POST | `/api/logo-analysis` | Análise de cores da logo |
| POST | `/api/product-image` | Geração de imagem do produto |
| GET | `/api/demand-forecast` | Previsão de demanda |
| POST | `/api/assistant` | Assistente inteligente |
| GET | `/api/system` | Health check do sistema |
| GET/POST | `/api/suppliers` | Fornecedores |
| GET/POST/PATCH | `/api/purchases` | Pedidos de compra |
| GET/POST/PATCH/DELETE | `/api/users` | Gestão de usuários |

---

## Instalação

### Requisitos
- Node.js 18+
- npm

### Passos

```bash
git clone https://github.com/SudreScodeS/Strale-ERP.git
cd Strale-ERP
npm install
npm run dev
```

Acesse `http://localhost:3000`

**Login padrão:** `admin` / `admin123`

### Opcional: IA com Ollama (linguagem natural)

O assistente funciona com pattern matching (sem configurar nada). Para entender perguntas livres em linguagem natural:

1. **Instalar Ollama:** https://ollama.com/download
2. **Baixar um modelo:** `ollama pull qwen2.5:7b` (ou `qwen2.5:3b` para máquinas com menos RAM)
3. **Iniciar o Ollama:** `ollama serve`
4. **Configurar `.env.local`** (copie de `.env.local.example`):
   ```
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=qwen2.5:7b
   ```
5. **Rodar o ERP:** `npm run dev`

**Sem Ollama**, o assistente funciona 100% com pattern matching local (20+ intenções pré-configuradas).

### Opcional: Google Cloud Vision

Para análise de imagem com Google Cloud Vision (além do processamento local via sharp):

```
GOOGLE_VISION_API_KEY=sua-chave-aqui
```

Se não configurado, o sistema usa sharp local — funciona perfeitamente.

---

## Validação do Sistema

```bash
# Health check via API
curl http://localhost:3000/api/system
```

O endpoint `/api/system` verifica:
- Integridade de todos os arquivos JSON
- Funcionamento de cada módulo (dados, financeiro, estoque, previsão, assistente)
- Disponibilidade do sharp (análise de imagem)
- Status geral do sistema

---

## Licença

Desenvolvido para empresas que valorizam eficiência e controle total.

100% local. Zero dependência externa de IA.
