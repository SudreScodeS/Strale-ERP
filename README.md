# Elitium - Sistema de Gestao Empresarial

## Visao Geral

O **Elitium** e um sistema de gestao empresarial desenvolvido em **Next.js 16** com **TypeScript** e **Tailwind CSS**. Especializado em empresas que trabalham com produtos customizaveis (como sacolas personalizadas, televisoes, etc.), oferece modulos integrados de estoque, vendas, orcamentos, financas, previsao de demanda, deteccao de fraude e assistente inteligente.

**100% local** — sem dependencia de APIs externas de IA.

## Modulos

### Previsao de Demanda
- Analise de historico de vendas por semana ISO
- Regressao linear para deteccao de tendencias (crescente/estavel/decrescente)
- Previsao de demanda semanal e mensal com ajuste de tendencia
- Recomendacao de reposicao de estoque (meta: 4 semanas de cobertura)
- Deteccao de excesso de estoque (>8 semanas de demanda parada)
- Classificacao de risco: alto, medio, baixo, sem risco

### Deteccao de Fraude
- Score de risco 0-100 com 11 regras de analise
- Analise automatica a cada pedido finalizado
- Regras: valor alto, frequencia, intervalo entre pedidos, quantidades anormais, usuario novo, cancelamentos, produtos atipicos
- Classificacao: aprovado (<40), suspeito (40-69), bloqueado (70+)
- Logs de analise salvos para auditoria e revisao por admin
- Dashboard com pendentes de revisao e tendencias semanais

### Assistente Inteligente
- Perguntas em linguagem natural (portugues)
- 20+ intencoes: "produto mais vendido", "estoque baixo", "lucro total", "previsao de demanda", etc.
- Pattern matching local — sem APIs externas, sem ChatGPT
- Respostas com dados reais do sistema
- Interface de chat com sugestoes clicaveis

### Analise de Logo (Local)
- Deteccao de cores dominantes via **sharp** (processamento local de imagem)
- Quantizacao por bucketing para identificar cores significativas
- Nomeacao automatica das cores em portugues
- Classificacao de complexidade (Elitium/moderate/complex)
- Google Cloud Vision e **opcional** — funciona sem nenhuma configuracao externa

## Arquitetura Tecnica

### Tecnologias Principais
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: API Routes do Next.js (Serverless Functions)
- **Autenticacao**: JWT + bcryptjs
- **Banco de Dados**: JSON files (preparado para PostgreSQL)
- **Processamento de Imagem**: sharp (local, sem API externa)
- **IDs**: UUID v4

### Estrutura de Diretorios
```
Elitium-ERP/
├── app/
│   ├── api/
│   │   ├── assistant/           # Assistente inteligente
│   │   ├── auth/                # Login / Registro
│   │   ├── config/              # Configuracoes globais
│   │   ├── dashboard/           # Metricas consolidadas
│   │   ├── demand-forecast/     # Previsao de demanda
│   │   ├── finance/             # Financeiro
│   │   ├── fraud/               # Deteccao de fraude
│   │   ├── inventory/           # Estoque (produto/grupo/variavel)
│   │   ├── logo-analysis/       # Analise de imagem
│   │   ├── orders/              # Pedidos
│   │   ├── purchases/           # Compras
│   │   ├── quotes/              # Orcamentos
│   │   ├── suppliers/           # Fornecedores
│   │   ├── system/              # Health check do sistema
│   │   └── users/               # Usuarios
│   ├── components/              # UI reutilizavel (Sidebar, MetricCard, etc.)
│   ├── lib/
│   │   ├── assistant.ts         # Motor de consultas em linguagem natural
│   │   ├── auth.ts              # Autenticacao JWT
│   │   ├── authClient.ts        # Helpers de auth no client
│   │   ├── business.ts          # Regras de negocio (preco, pedidos, estoque)
│   │   ├── color-analyzer.ts    # Analise de cores via sharp
│   │   ├── config.ts            # Persistencia de configuracoes
│   │   ├── dashboard.ts         # Logica do dashboard principal
│   │   ├── data.ts              # Camada de abstracao de dados
│   │   ├── demand-forecast.ts   # Motor de previsao de demanda
│   │   ├── finance.ts           # Logica financeira
│   │   ├── fraud-detection.ts   # Motor de deteccao de fraude
│   │   ├── huggingface-client.ts# Cliente HuggingFace (opcional)
│   │   ├── inventory.ts         # Consultas de estoque
│   │   ├── logo-compositor.ts   # Composicao de logo sobre produto
│   │   ├── ollama-client.ts     # Cliente Ollama para IA local
│   │   ├── pricing.ts           # Motor de precos unificado
│   │   ├── purchases.ts         # Logica de compras
│   │   └── vision.ts            # Analise de logo (local + Google Vision opcional)
│   ├── assistant/               # Chat do assistente
│   ├── demand-forecast/         # Dashboard de previsao
│   ├── fraud/                   # Dashboard de fraudes
│   ├── finance/                 # Dashboard financeiro
│   ├── inventory/               # Gestao de estoque
│   ├── login/                   # Login
│   ├── purchases/               # Compras
│   ├── quotes/                  # Orcamentos
│   ├── register/                # Registro
│   ├── sales/                   # Pedidos (criar + buscar)
│   └── users/                   # Gestao de usuarios
├── config/
│   └── global.ts                # Configuracoes editaveis
├── data/                        # JSON files (banco de dados)
│   ├── finance.json
│   ├── fraud-logs.json
│   ├── groups.json
│   ├── invoices.json
│   ├── orders.json
│   ├── products.json
│   ├── purchase-orders.json
│   ├── quotes.json
│   ├── suppliers.json
│   ├── users.json
│   └── variables.json
├── types/
│   └── index.ts                 # Interfaces globais
└── package.json
```

## Funcionalidades

### Estoque
- Produtos base com grupos de configuracao (Material, Tamanho, Cor, etc.)
- Variaveis com estoque individual e preco adicional
- Alertas automaticos: critico (<=10) e atencao (<=30)

### Orcamentos
- Criacao de orcamentos profissionais com validade configuravel
- Calculo automatico por dimensao (largura x altura)
- Configuracao de impressao detalhada (tipo, tamanho, posicao)
- Tabela de precos por faixa de quantidade
- Clonagem rapida de orcamentos
- Ciclo de vida: rascunho -> enviado -> aprovado/rejeitado -> convertido em pedido

### Vendas
- Fluxo completo: selecionar produto -> variaveis -> upload logo -> calcular preco -> finalizar
- Carrinho de compras com multiplos itens
- Calculo por dimensao e impressao da logo
- Calculo automatico: custo + markup + custo do logo
- Baixa automatica do estoque
- Geracao de nota fiscal

### Financeiro
- Registro automatico de vendas
- Controle de despesas e compras
- Calculo de lucro (vendas - despesas)

### Autenticacao
- Dois perfis: admin (acesso total) e seller (vendas)
- JWT com expiracao
- Protecao de rotas e paginas

## API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Registro (admin) |
| GET | `/api/inventory` | Listar estoque completo |
| POST/PATCH | `/api/inventory/product` | Criar/atualizar produto |
| POST/PATCH | `/api/inventory/group` | Criar/atualizar grupo |
| POST/PATCH | `/api/inventory/variable` | Criar/atualizar variavel |
| GET/POST/PATCH/DELETE | `/api/orders` | CRUD de pedidos + deteccao de fraude |
| GET/POST/PATCH/DELETE | `/api/quotes` | CRUD de orcamentos |
| GET/POST | `/api/finance` | Financeiro |
| GET | `/api/dashboard` | Metricas do dashboard |
| GET/POST | `/api/config` | Configuracoes globais |
| POST | `/api/logo-analysis` | Analise de logo |
| POST | `/api/product-image` | Geracao de imagem do produto |
| GET | `/api/demand-forecast` | Previsao de demanda |
| POST | `/api/assistant` | Assistente inteligente |
| GET | `/api/system` | Health check do sistema |
| GET/POST | `/api/suppliers` | Fornecedores |
| GET/POST/PATCH | `/api/purchases` | Pedidos de compra |
| GET/POST/PATCH/DELETE | `/api/users` | Gestao de usuarios |

## Fluxo Completo de Pedido

```
1. Usuario seleciona produto e variaveis
2. (Opcional) Configura dimensao e impressao
3. Upload de logo (analise local via sharp)
4. Sistema detecta cores dominantes automaticamente
5. Preco calculado: custo + variaveis + dimensao + impressao + margem
6. Pedido finalizado -> dispara:
   - Baixa de estoque das variaveis
   - Registro financeiro automatico
   - Geracao de nota fiscal
   - Analise de fraude (score 0-100)
7. Dashboard atualizado com novos dados
```

## Configuracoes (`config/global.ts`)

```typescript
export const globalConfig = {
  profitMargin: 20,              // Margem de lucro em %
  logoPricePerColor: 10,         // R$ por cor detectada na logo
  minStockAlert: 5,              // Alerta quando estoque <= 5
  systemName: 'Elitium',         // Nome do sistema
  companyName: 'North Bag',      // Nome da empresa
  quoteValidityDays: 7,          // Dias de validade padrao do orcamento
  pricePerCm2: 0.005,            // R$ por cm² para calculo por dimensao
};
```

## Instalacao

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

**Login padrao:** `admin` / `admin123`

### Opcional: IA com Ollama

1. Instalar Ollama: https://ollama.com/download
2. `ollama pull qwen2.5:7b`
3. Rodar o ERP normalmente

Sem Ollama, o assistente funciona 100% com pattern matching local.

## Validacao do Sistema

```bash
# Health check via API
curl http://localhost:3000/api/system
```

O endpoint `/api/system` verifica:
- Integridade de todos os arquivos JSON
- Funcionamento de cada modulo (dados, financeiro, estoque, previsao, fraude, assistente)
- Disponibilidade do sharp (analise de imagem)
- Status geral do sistema

## Licenca

Desenvolvido para empresas que valorizam eficiencia e controle total.

100% local. Zero dependencia externa de IA.
