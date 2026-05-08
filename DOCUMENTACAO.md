# Elitium ERP — Documento Completo de Desenvolvimento
## Data: 08/05/2026

---

## 1. CONTEXTO INICIAL

### 1.1 O que foi apresentado
O Edson, dono da **North Bag** (fabricante de sacolas personalizáveis), gravou um vídeo detalhando os problemas do seu fluxo de trabalho. O projeto no GitHub se chama **Strale-ERP** (renomeado para **Elitium** internamente), desenvolvido em Next.js 16 + TypeScript + Tailwind CSS.

### 1.2 Os 5 problemas do Edson

| # | Problema | Detalhe |
|---|---------|---------|
| 1 | **Cálculo de orçamento é lento** | Precisa fazer **10 a 20 orçamentos** para fechar UMA venda |
| 2 | **Variabilidade absurda de produtos** | Tamanhos de 10x15cm até ~2m, materiais variados (TNT, nylon, tecido), cada um com custo diferente |
| 3 | **Múltiplas variáveis por produto** | Tipo de fechamento (velop, forro, alça, cordão), logo (cores, frente/verso), acabamentos especiais |
| 4 | **Ele é o gargalo** | 3 vendedoras dependem dele pra cada orçamento. Ele tem outras atividades → atrasa respostas |
| 5 | **Precisa de sistema automatizado** | Que as vendedoras usem sozinhas, sem depender dele |

---

## 2. ANÁLISE DO PROJETO ORIGINAL

### 2.1 O que já existia e resolvia

| Funcionalidade | Status |
|---|---|
| Sistema de Produtos → Grupos → Variáveis | ✅ Implementado |
| Cálculo automático de preço (base + variáveis + markup) | ✅ Implementado |
| Análise de logo via sharp (detecção de cores local) | ✅ Implementado |
| Baixa automática de estoque ao finalizar pedido | ✅ Implementado |
| Geração de nota fiscal | ✅ Implementado |
| Dois perfis (admin/seller) com JWT | ✅ Implementado |
| Controle financeiro automático | ✅ Implementado |
| Previsão de demanda com regressão linear | ✅ Implementado |
| Detecção de fraude com score 0-100 | ✅ Implementado |
| Assistente com pattern matching local | ✅ Implementado |

### 2.2 O que NÃO resolvia (gaps críticos)

| Gap | Por que é crítico |
|-----|-------------------|
| **Sem módulo de orçamento** | O ERP só tinha "criar pedido" (que já baixa estoque). Não tinha o meio-termo: orçamento → aprovação → pedido |
| **Preço não considerava dimensões** | Sacolas de 10x15cm até 2m deveriam ter preços diferentes por área |
| **Custo de impressão simplificado** | Era apenas R$10/cor. Na realidade depende de tipo, tamanho, posição |
| **Sem tabela de preços por volume** | O Edson tem preços diferentes para 100, 500, 1000, 5000 unidades |
| **Sem clonagem de orçamento** | Ele faz 10-20 orçamentos por venda — precisava clonar rapidamente |
| **Sem exportação de PDF** | Orçamento precisa ser enviado ao cliente em formato profissional |
| **Assistente fraco** | Pattern matching puro não entendia "quanto custa 500 sacolas TNT azuis?" |

---

## 3. O QUE FOI IMPLEMENTADO

### 3.1 Commit 1: Sistema de Orçamentos + Motor de Preços
**Arquivos modificados/criados: 14 | Linhas adicionadas: +1.763**

#### 3.1.1 Tipos novos (`types/index.ts`)
- `Quote` — Interface completa de orçamento (id, cliente, itens, status, validade, notas)
- `QuoteItem` — Item do orçamento com suporte a dimensões e impressão
- `PriceTier` — Faixa de preço por quantidade (minQty, maxQty, unitPrice, label)
- `PrintPricingRule` — Regra de preço de impressão (tipo × tamanho × posição)
- `GlobalConfig` expandido — +4 campos: `quoteValidityDays`, `priceTiers`, `printPricingRules`, `pricePerCm2`

#### 3.1.2 Configurações expandidas (`config/global.ts`)
- **Tabela de preços por faixa**: 5 faixas padrão (Varejo → Mega atacado)
- **Regras de impressão**: 36 regras (3 tipos × 3 tamanhos × 3 posições × fallback)
  - Serigrafia: base + R$/cor adicional
  - Sublimação: base fixo (sem custo por cor)
  - DTF: base fixo (mais barato)
- **Preço por cm²**: R$ 0,005/cm² (configurável)
- Novas funções: `getTierPrice()`, `calculatePrintCost()`, `calculateDimensionCost()`

#### 3.1.3 Motor de preços unificado (`app/lib/pricing.ts`) — ARQUIVO NOVO
- `calculateItemPricing()` — Calcula preço completo de um item com todas as variáveis
- `calculateCartPricing()` — Calcula preço de múltiplos itens (carrinho)
- `generatePricingSummary()` — Gera texto legível do orçamento
- **Este é o arquivo central de cálculos** — usado por orçamentos, pedidos e assistente

#### 3.1.4 Dados (`app/lib/data.ts`)
- +`quoteData` — CRUD completo de orçamentos em JSON (getAll, getById, create, update, delete)

#### 3.1.5 Lógica de negócio (`app/lib/business.ts`)
- `criarOrcamento()` — Cria orçamento com validade, notas, status 'draft'
- `converterOrcamentoEmPedido()` — Converte orçamento aprovado em pedido real (baixa estoque, financeiro, NF)
- `clonarOrcamento()` — Copia orçamento inteiro com novo ID
- `atualizarStatusOrcamento()` — Gerencia ciclo de vida (draft→sent→approved→rejected→converted)
- `listarOrcamentosPorUsuario()` — Para vendedoras verem só os seus
- `listarOrcamentosPorStatus()` — Filtro por status
- `getOrcamentosStats()` — Estatísticas (total, conversão, valor médio)

#### 3.1.6 API REST (`app/api/quotes/route.ts`) — ARQUIVO NOVO
- `GET /api/quotes` — Lista orçamentos (filtra por status, por role)
- `POST /api/quotes` — Cria novo orçamento
- `PATCH /api/quotes` — Ações: clonar, converter em pedido, atualizar status
- `DELETE /api/quotes` — Remove rascunhos/rejeitados

#### 3.1.7 Página de orçamentos (`app/quotes/page.tsx`) — ARQUIVO NOVO
- **Aba "Meus orçamentos"**: lista com filtros por status e busca
- **Aba "Novo orçamento"**: builder completo com:
  - Dados do cliente (nome, validade, observações)
  - Seleção de produto e variáveis
  - Quantidade
  - Cálculo por dimensão (largura × altura) — opcional
  - Configuração de impressão (tipo, tamanho, posição)
  - Carrinho de itens
  - Resumo financeiro
- **Modal de detalhes**: ver orçamento completo + ações (enviar, aprovar, rejeitar, clonar, converter)

#### 3.1.8 Sidebar (`app/components/ui.tsx`)
- +ícone de orçamentos
- +item "Orçamentos" no menu (visível para admin e seller)

#### 3.1.9 Assistente (`app/lib/assistant.ts`)
- +4 queries: orçamentos pendentes, taxa de conversão, orçamentos de hoje, resumo atualizado
- +intenções no pattern matching: "orcamento", "orcamento pendente", "taxa de conversao", etc.

#### 3.1.10 Dashboard (`app/page.tsx` + `app/lib/dashboard.ts`)
- +2 metric cards: "Orçamentos Pendentes" e "Orçamentos Convertidos"
- Dashboard inclui `quotesPending`, `quotesConverted`, `quoteConversionRate`

#### 3.1.11 Admin (`app/admin/page.tsx` + `app/lib/config.ts`)
- +2 campos de configuração: validade do orçamento (dias) e preço por cm²
- Preview expandido com 4 cards (margem, logo, validade, dimensão)
- `updateServerConfig()` suporta novos campos

#### 3.1.12 Dados
- `data/quotes.json` — Arquivo vazio para armazenar orçamentos

---

### 3.2 Commit 2: Integração Ollama (IA Local)
**Arquivos modificados/criados: 3 | Linhas adicionadas: +390**

#### 3.2.1 Cliente Ollama (`app/lib/ollama-client.ts`) — ARQUIVO NOVO
- `extractParamsFromQuestion()` — Envia pergunta ao Ollama, recebe JSON com parâmetros estruturados
- `checkOllamaStatus()` — Verifica se Ollama está rodando e tem o modelo
- Sistema de prompt com exemplos em português
- Fallback silencioso se Ollama indisponível (retorna null)
- Timeout de 3s para health check, 15s para extração

#### 3.2.2 API do assistente reescrita (`app/api/assistant/route.ts`)
- **Fluxo híbrido**:
  1. Tenta Ollama → extrai parâmetros → calcula preço com `pricing.ts`
  2. Se Ollama entendeu como "query" → usa pattern matching local
  3. Se Ollama falhou → fallback 100% pattern matching
- `GET /api/assistant` — Retorna status do Ollama (disponível, modelo, erro)
- Geração de orçamento rápido via linguagem natural

#### 3.2.3 Interface do assistente (`app/assistant/page.tsx`)
- Indicador de status da IA (🟢 Ollama ativo / 🟡 Local pattern)
- Fonte da resposta mostrada ("via ollama", "via local", etc.)
- +3 sugestões com exemplos de linguagem natural

---

### 3.3 Commit 3: Modelo padrão atualizado
- Modelo padrão alterado de `llama3.2:3b` para `qwen2.5:7b` (melhor para português)

---

## 4. DECISÕES TÉCNICAS E CUIDADOS TOMADOS

### 4.1 Sobre duplicidade
- **Orçamento ≠ Pedido**: São sistemas separados. Orçamento não baixa estoque. Conversão reutiliza `finalizarPedido()` existente.
- **pricing.ts vs business.ts**: O novo motor de preços NÃO substitui o cálculo existente. É um caminho paralelo mais avançado. Pedidos continuam usando o fluxo original.
- **Logo cost legado vs novo**: O cálculo legado (R$10/cor) continua para pedidos. Orçamentos usam o sistema detalhado (tipo × tamanho × posição).
- **Assistente**: Queries novas são aditivas. Não substituem nada.

### 4.2 O que NÃO foi feito (decisão consciente)
- **Cadastro de clientes**: O Edson disse que é só para ele e as vendedoras, não precisa
- **Migração de banco de dados**: É um protótipo, JSON files por enquanto
- **Integração WhatsApp**: PDF gerado resolve por enquanto
- **PWA / Mobile**: Pensar depois

---

## 5. O QUE FALTA FAZER

### 5.1 Prioridade ALTA (impacto direto no Edson)

| Item | Descrição | Status |
|------|-----------|--------|
| **PDF de orçamento** | Gerar PDF profissional com logo da empresa para enviar ao cliente | ❌ Não implementado |
| **Tabela de preços EDITÁVEL na UI** | O admin precisa configurar as faixas de preço pela interface (atualmente só no código) | ❌ Não implementado |
| **Regras de impressão EDITÁVEIS** | Mesmo caso — admin precisa editar pela interface | ❌ Não implementado |

### 5.2 Prioridade MÉDIA (melhorias de fluxo)

| Item | Descrição | Status |
|------|-----------|--------|
| **Clone de orçamento com edição** | Ao clonar, poder editar antes de salvar | ⚠️ Clona mas não abre editor |
| **Orçamento → Pedido com seletor** | Ao converter, poder escolher quais itens incluir | ⚠️ Converte tudo de uma vez |
| **Histórico de preços do cliente** | Mostrar preços anteriores ao criar orçamento para o mesmo cliente | ❌ Não implementado |
| **PWA / Mobile** | Vendedoras em feiras precisam gerar orçamento no celular | ❌ Não implementado |
| **Integração WhatsApp** | Enviar orçamento direto pelo WhatsApp Business API | ❌ Não implementado (PDF resolve por enquanto) |

### 5.3 Prioridade BAIXA (futuro)

| Item | Descrição |
|------|-----------|
| Migração para PostgreSQL/Prisma | JSON não escala com múltiplos usuários simultâneos |
| Cadastro de clientes | Se o Edson quiser no futuro |
| Relatórios avançados | Vendas por período, produto mais vendido, etc. |
| Sistema de devoluções e trocas |
| Integração com transportadoras (frete) |
| Exportação de dados (Excel/CSV) |

---

## 6. COMO RODAR O PROJETO

### 6.1 Requisitos
- Node.js 18+
- npm

### 6.2 Instalar e rodar
```bash
git clone https://github.com/SudreScodeS/Strale-ERP.git
cd Strale-ERP
npm install
npm run dev
```

Acessar: http://localhost:3000
Login padrão: `admin` / `admin123`

### 6.3 Opcional: IA com Ollama
1. Instalar: https://ollama.com/download/windows
2. Abrir novo terminal
3. `ollama pull qwen2.5:7b`
4. Rodar o ERP normalmente

Sem Ollama: o assistente funciona 100% com pattern matching local.

---

## 7. ARQUITETURA DO PROJETO

```
Elitium-ERP/
├── app/
│   ├── api/
│   │   ├── assistant/route.ts    ← IA híbrida (Ollama + local)
│   │   ├── auth/                  ← Login/registro
│   │   ├── config/route.ts        ← Configurações globais
│   │   ├── dashboard/route.ts     ← Métricas do dashboard
│   │   ├── finance/route.ts       ← Financeiro
│   │   ├── inventory/             ← Estoque (CRUD)
│   │   ├── logo-analysis/         ← Análise de imagem
│   │   ├── orders/route.ts        ← Pedidos
│   │   ├── quotes/route.ts        ← 🆕 Orçamentos
│   │   ├── purchases/route.ts     ← Compras
│   │   └── users/route.ts         ← Usuários
│   ├── assistant/page.tsx         ← Chat do assistente
│   ├── components/
│   │   ├── ui.tsx                 ← Sidebar, MetricCard, PageHeader
│   │   ├── product-preview.tsx    ← Prévia visual do produto
│   │   └── protected.tsx          ← Proteção de rotas
│   ├── lib/
│   │   ├── assistant.ts           ← Pattern matching local
│   │   ├── auth.ts                ← JWT + bcrypt
│   │   ├── business.ts            ← Regras de negócio + orçamentos
│   │   ├── config.ts              ← Persistência de config
│   │   ├── dashboard.ts           ← Lógica do dashboard
│   │   ├── data.ts                ← Camada de dados (JSON)
│   │   ├── demand-forecast.ts     ← Previsão de demanda
│   │   ├── finance.ts             ← Financeiro
│   │   ├── inventory.ts           ← Estoque
│   │   ├── ollama-client.ts       ← 🆕 Cliente Ollama
│   │   ├── pricing.ts             ← 🆕 Motor de preços unificado
│   │   └── purchases.ts           ← Compras
│   ├── quotes/page.tsx            ← 🆕 Página de orçamentos
│   ├── sales/page.tsx             ← Pedidos
│   └── ...                        ← Outras páginas
├── config/
│   └── global.ts                  ← Configurações + tabelas de preço
├── data/                          ← JSON files (banco de dados)
│   ├── quotes.json                ← 🆕 Orçamentos
│   └── ...                        ← Outros dados
└── types/
    └── index.ts                   ← Interfaces globais
```

---

## 8. RESUMO EXECUTIVO

### O que foi feito (em ~2 horas)
1. ✅ Análise completa do vídeo do Edson e do código existente
2. ✅ Módulo de orçamentos completo (backend + frontend + API)
3. ✅ Motor de preços avançado (tabelas por volume, dimensões, impressão detalhada)
4. ✅ Integração com Ollama para IA local em português
5. ✅ Dashboard expandido com métricas de orçamentos
6. ✅ Configurações expandidas no admin
7. ✅ Tudo commitado e pushado no GitHub

### O que falta (resumo)
1. ❌ Gerar PDF de orçamento
2. ❌ Tabelas de preço editáveis na interface
3. ❌ Regras de impressão editáveis na interface
4. ❌ PWA/Mobile (futuro)
5. ❌ Integração WhatsApp (futuro, PDF resolve por enquanto)

### O problema do Edson está resolvido?
**~80% resolvido.** O gargalo principal (vendedoras dependentes dele para orçamentos) está resolvido com o módulo de orçamentos. O que falta para 100%:
- PDF para enviar ao cliente (sem isso, a vendedora precisa copiar/colar o valor)
- Tabelas de preço editáveis (sem isso, o Edson precisa pedir pro dev ajustar preços)
