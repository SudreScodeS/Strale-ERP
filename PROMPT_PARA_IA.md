# PROMPT PARA MELHORIA E INTEGRAÇÃO DE IA - SIMPLE ERP

## 📋 CONTEXTO DO PROJETO

### O que é o Simple ERP?
**Simple ERP** é um sistema de gestão empresarial completo desenvolvido em Next.js 16 com TypeScript e Tailwind CSS. Especializado em empresas que trabalham com **produtos customizáveis** (camisetas, canecas, brindes personalizados), oferecendo módulos integrados de:
- 📦 Estoque e Inventário
- 🛒 Vendas e Pedidos
- 💰 Finanças e Relatórios
- 📄 Notas Fiscais (NF)
- 👥 Controle de Acesso (Admin/Seller)

### Stack Tecnológico Atual
```
Frontend:    Next.js 16, React 19, TypeScript 5, Tailwind CSS 4
Backend:     API Routes do Next.js (Serverless)
Database:    JSON Files (preparado para PostgreSQL)
Auth:        JWT + bcrypt
State:       React Hooks + Context API
```

---

## 🔴 PROBLEMAS E LACUNAS IDENTIFICADOS

### 1. **Análise de Logo SIMULADA (Principal Lacuna)**
**Status:** Apenas simula análise baseada no tamanho do arquivo
```typescript
// Problema atual em lib/business.ts
export async function analisarLogo(imageFile: { size: number } | null): Promise<LogoAnalysis> {
  const colors = imageFile ? Math.max(1, Math.min(5, imageFile.size % 6)) : 1;
  // Não faz nada com a imagem real - apenas calcula cores aleatoriamente
}
```

**Impacto:** 
- Análise de cores inaccurada
- Cálculo de preço baseado em simulação, não em realidade
- Cliente não sabe realmente quantas cores tem seu logo
- Possíveis perdas financeiras

**Solução Proposta:**
- Integração com API de Visão Computacional (Google Vision AI, AWS Rekognition ou OpenAI Vision)
- Detectar cores REAIS da imagem do logo
- Retornar também análise de complexidade (áreas, formas, texto)

---

### 2. **Falta de Previsão de Demanda**
Comentário no código indica funcionalidade planejada mas não implementada:
```typescript
// Em lib/business.ts linha 220
// 6. Análise de demanda para previsão de vendas (NÃO IMPLEMENTADO)
```

**Oportunidade de IA:**
- Analisar histórico de vendas
- Prever demanda futura (ML)
- Sugerir reposição de estoque inteligente
- Alertar sobre produtos em tendência

---

### 3. **Sem Sugestões Inteligentes de Preço**
O sistema usa margem FIXA de 20%, sem considerar:
- Demanda de cada produto
- Sazonalidade
- Concorrência
- Estoque disponível

**Oportunidade de IA:**
- Análise de preço dinâmico
- Sugestão automática de markups ideais
- Otimização de lucro vs volume

---

### 4. **Sem Análise de Clientes e Vendedores**
Sistema não tem:
- Segmentação de clientes
- Análise de performance do vendedor
- Recomendações personalizadas

---

### 5. **Validações Simples de Entrada**
- Sem detecção de fraude (pedidos suspeitos)
- Sem validação de logo (pode ser imagem corrompida)
- Sem sanitização avançada de dados

---

### 6. **Dashboard com Dados Estáticos**
- Sem insights gerados por IA
- Sem recomendações automáticas
- Sem anomalias detectadas

---

## 🎯 MELHORIAS PROPOSTAS (Priorizadas)

### PRIORIDADE 1: Análise de Logo com IA (CRÍTICA)

#### Implementação com Google Vision AI
```typescript
// Novo arquivo: app/lib/aiServices/logoAnalyzer.ts

import vision from '@google-cloud/vision';

export async function analisarLogoComIA(imageBuffer: Buffer): Promise<LogoAnalysis> {
  const client = new vision.ImageAnnotatorClient();
  
  const request = {
    image: { content: imageBuffer },
    features: [
      { type: 'IMAGE_PROPERTIES' },  // Cores dominantes
      { type: 'LABEL_DETECTION' },   // O que é (logo, design, etc)
      { type: 'TEXT_DETECTION' },    // Texto na imagem
      { type: 'SAFE_SEARCH_DETECTION' }, // Conteúdo apropriado
    ],
  };

  const [response] = await client.annotateImage(request);
  
  // Extrair cores dominantes
  const colors = response.imagePropertiesAnnotation?.dominantColors?.colors || [];
  const uniqueColors = colors.length;
  
  // Calcular complexidade
  const complexity = calculateComplexity(response);
  
  return {
    colors: uniqueColors,
    cost: calculateLogoCost(uniqueColors),
    complexity,
    isAppropriate: !response.safeSearchAnnotation?.inappropriate,
    description: extractDescription(response),
  };
}
```

**Dependências:**
- `npm install @google-cloud/vision`
- Variável ambiente: `GOOGLE_CLOUD_KEY` (arquivo JSON de credenciais)

**Benefícios:**
- ✅ Análise precisa de cores reais
- ✅ Detecção automática de logos inapropriados
- ✅ Descrição automática do logo
- ✅ Detecção de texto para análise de complexidade

---

### PRIORIDADE 2: Previsão de Demanda e Estoque Inteligente

#### Implementação com OpenAI (ChatGPT) ou TensorFlow.js

```typescript
// Novo arquivo: app/lib/aiServices/demandForecast.ts

import { orderData } from '../data';
import { globalConfig } from '../../config/global';

export function calcularDemandaFutura(productId: string, diasAfrente: number = 30) {
  const orders = orderData.getAll();
  
  // 1. Extrair histórico de vendas do produto
  const salesHistory = orders
    .filter(o => o.items.some(i => i.productId === productId))
    .map(o => ({
      date: new Date(o.createdAt),
      quantity: o.items
        .filter(i => i.productId === productId)
        .reduce((sum, i) => sum + i.quantity, 0),
    }));

  // 2. Análise de tendência
  const avgDaily = salesHistory.reduce((sum, s) => sum + s.quantity, 0) / 30;
  const trend = calcularTendencia(salesHistory);
  
  // 3. Previsão
  const forecast = avgDaily * diasAfrente * (1 + trend);
  
  return {
    productId,
    forecastDays: diasAfrente,
    expectedSales: Math.ceil(forecast),
    confidence: calculateConfidence(salesHistory),
    recommendation: {
      action: forecast > avgDaily ? 'AUMENTAR_REPOSICAO' : 'MANTER',
      quantity: Math.ceil(forecast * 1.2), // 20% margem de segurança
    },
  };
}

function calcularTendencia(sales: Array<{ date: Date; quantity: number }>): number {
  // Implementar regressão linear simples
  // Retornar: -1 (queda) a +1 (crescimento)
}

function calculateConfidence(sales: any[]): number {
  // Retornar confiabilidade da previsão (0-100%)
  // Baseado em consistência dos dados
}
```

**Benefícios:**
- ✅ Alertas automáticos de reposição
- ✅ Previsão de falta de estoque
- ✅ Otimização de compras a fornecedores
- ✅ Redução de produtos parados

---

### PRIORIDADE 3: Detecção de Fraude em Pedidos

```typescript
// Novo arquivo: app/lib/aiServices/fraudDetection.ts

export function detectarFraude(order: Order, user: User): {
  riskScore: number;
  flags: string[];
  recommendation: 'APROVAR' | 'REVISAR' | 'REJEITAR';
} {
  const flags: string[] = [];
  let riskScore = 0;

  // Critério 1: Valor anormalmente alto
  if (order.totalPrice > user.averageOrderValue * 5) {
    flags.push('VALOR_ANORMALMENTE_ALTO');
    riskScore += 20;
  }

  // Critério 2: Primeira compra com valor alto
  if (user.orderCount === 0 && order.totalPrice > 1000) {
    flags.push('PRIMEIRA_COMPRA_VALOR_ALTO');
    riskScore += 25;
  }

  // Critério 3: Múltiplos pedidos em curto período
  const recentOrders = getRecentOrdersCount(user.id, 24);
  if (recentOrders > 5) {
    flags.push('MULTIPLOS_PEDIDOS_RAPIDOS');
    riskScore += 15;
  }

  // Critério 4: Padrão de compra diferente
  if (!isPatternNormal(order, user)) {
    flags.push('PADRAO_DIFERENTE');
    riskScore += 10;
  }

  const recommendation = 
    riskScore >= 60 ? 'REJEITAR' :
    riskScore >= 40 ? 'REVISAR' :
    'APROVAR';

  return { riskScore, flags, recommendation };
}
```

**Benefícios:**
- ✅ Proteção contra fraudes
- ✅ Economia em chargebacks
- ✅ Filtro automático de pedidos suspeitos

---

### PRIORIDADE 4: Dashboard com Insights de IA

```typescript
// Novo arquivo: app/lib/aiServices/dashboardInsights.ts

export async function gerarInsightsDashboard() {
  return {
    // Produto mais vendido vs mês passado
    productTrends: analisarTendenciasProdutos(),
    
    // Vendedor com melhor performance
    sellerPerformance: rankingSellers(),
    
    // Alertas automáticos
    alerts: [
      'Estoque crítico: 3 produtos',
      'Vendedor X com aumento de 45% em vendas',
      'Receita 12% acima da meta',
    ],
    
    // Recomendações
    recommendations: [
      'Aumentar estoque do produto X (tendência de crescimento)',
      'Revisar preço do produto Y (margem acima da média)',
      'Dar bônus ao vendedor X (performance excepcional)',
    ],
  };
}
```

---

### PRIORIDADE 5: Integração com LLM para Chat Assistente

```typescript
// Novo arquivo: app/api/ai-assistant/route.ts

import { OpenAI } from 'openai';

export async function POST(req: Request) {
  const { message, context } = await req.json();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const systemPrompt = `
    Você é um assistente IA de um ERP de gestão empresarial.
    Contexto do sistema:
    - Empresa: ${globalConfig.companyName}
    - Módulos: Estoque, Vendas, Finanças, Notas Fiscais
    - ${context}
    
    Responda perguntas sobre:
    - Status de pedidos
    - Análise de estoque
    - Performance de vendas
    - Sugestões de otimização
    
    Sempre cite números e dados reais do sistema.
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
  });

  return Response.json({
    answer: response.choices[0].message.content,
    timestamp: new Date(),
  });
}
```

**Exemplo de uso:**
- "Qual é a taxa de conversão de vendedores?"
- "Por que o estoque de X caiu 30% este mês?"
- "Qual produto deveria aumentar de preço?"

---

## 🛠️ IMPLEMENTAÇÃO - PLANO DE AÇÃO

### Fase 1: Setup de Integrações (Semana 1)
```bash
# 1. Instalar dependências
npm install @google-cloud/vision openai

# 2. Criar arquivo .env.local
GOOGLE_CLOUD_KEY="{JSON credentials}"
OPENAI_API_KEY="sk-..."

# 3. Criar pastas
mkdir -p app/lib/aiServices
```

### Fase 2: Análise de Logo Real (Semana 1-2)
- [ ] Implementar `logoAnalyzer.ts` com Google Vision
- [ ] Atualizar tipos em `types/index.ts`
- [ ] Testar com imagens reais
- [ ] Atualizar página de vendas para usar IA real

### Fase 3: Previsão de Demanda (Semana 2)
- [ ] Implementar `demandForecast.ts`
- [ ] Adicionar painel de previsões no dashboard
- [ ] Criar API endpoint `/api/forecast`

### Fase 4: Detecção de Fraude (Semana 3)
- [ ] Implementar `fraudDetection.ts`
- [ ] Integrar no processamento de pedidos
- [ ] Adicionar dashboard de pedidos de risco

### Fase 5: Dashboard com IA (Semana 3-4)
- [ ] Implementar `dashboardInsights.ts`
- [ ] Redesenhar página principal
- [ ] Adicionar gráficos de tendências

### Fase 6: Chat Assistente (Semana 4)
- [ ] Implementar endpoint do assistente
- [ ] Criar componente de chat na interface
- [ ] Treinar modelo com contexto do ERP

---

## 📊 ESTRUTURA DE TIPOS ESTENDIDA

```typescript
// types/index.ts - Adicionar:

export interface LogoAnalysis {
  colors: number;
  cost: number;
  complexity: 'SIMPLES' | 'MÉDIA' | 'COMPLEXA';
  isAppropriate: boolean;
  description: string;
  detectedElements: string[];
}

export interface DemandForecast {
  productId: string;
  forecastDays: number;
  expectedSales: number;
  confidence: number;
  trend: 'CRESCENTE' | 'ESTÁVEL' | 'DECRESCENTE';
}

export interface FraudScore {
  orderId: string;
  riskScore: number; // 0-100
  flags: string[];
  recommendation: 'APROVAR' | 'REVISAR' | 'REJEITAR';
}

export interface DashboardInsight {
  type: 'ALERTA' | 'TENDÊNCIA' | 'RECOMENDAÇÃO';
  title: string;
  description: string;
  actionUrl?: string;
  priority: 'ALTA' | 'MÉDIA' | 'BAIXA';
}
```

---

## 🔒 CONSIDERAÇÕES DE SEGURANÇA

1. **Variáveis de Ambiente Seguras:**
   ```bash
   # .env.local (NUNCA commitar)
   GOOGLE_CLOUD_KEY="credenciais_json"
   OPENAI_API_KEY="sk-xxx"
   ```

2. **Validação de Imagens:**
   - Máximo 5MB de tamanho
   - Apenas formatos: JPG, PNG, WebP
   - Verificar Safe Search antes de processar

3. **Rate Limiting:**
   - Limitar chamadas a APIs (custo financeiro)
   - Cache de resultados quando possível
   - Fila de processamento para operações em lote

4. **Logs Auditáveis:**
   - Registrar todas as análises de IA
   - Rastrear decisões de fraude
   - Permitir revisão manual

---

## 💰 ESTIMATIVA DE CUSTOS

| Serviço | Uso Mensal | Custo |
|---------|-----------|-------|
| Google Vision | 10k análises | ~$10 |
| OpenAI GPT-4 | 5k requisições | ~$50 |
| Armazenamento | 100 GB | Mínimo |
| **Total Estimado** | - | **~$100/mês** |

> Nota: Valores aumentam com escala. Considerar planos enterprise para 100k+ análises/mês.

---

## 📈 MÉTRICAS DE SUCESSO

Após implementação, espera-se:
- ✅ 95%+ acurácia na análise de logos (vs 50% atual)
- ✅ 40% menos erros de preço
- ✅ 25% melhoria no acerto de previsão de estoque
- ✅ 5% menos pedidos fraudulentos
- ✅ 30% economia em produtos obsoletos
- ✅ 20% aumento em satisfação do cliente

---

## 📝 PRÓXIMAS ETAPAS

1. **Escolher provider de IA:** Google Vision vs AWS Rekognition vs Claude Vision
2. **Criar credenciais:** Gerar chaves de API para cada serviço
3. **Implementar Fase 1:** Começar com análise de logo (ROI mais imediato)
4. **Testes:** Validar com dados reais antes de produção
5. **Iteração:** Coletar feedback e ajustar modelos

---

## 🎓 REFERÊNCIAS E RECURSOS

- **Google Vision API:** https://cloud.google.com/vision/docs
- **OpenAI API:** https://platform.openai.com/docs
- **AWS Rekognition:** https://aws.amazon.com/rekognition/
- **Detecção de Fraude:** https://www.sagemaker.readthedocs.io/
- **TypeScript + AI:** https://github.com/openai/openai-node

---

## ✅ CHECKLIST PARA IMPLEMENTAÇÃO

- [ ] Credenciais de API configuradas
- [ ] Variáveis de ambiente definidas
- [ ] Tipos TypeScript estendidos
- [ ] Análise de logo funcional
- [ ] Testes unitários de IA
- [ ] Documentação de endpoints
- [ ] Tratamento de erros
- [ ] Logging de chamadas
- [ ] Cache de resultados
- [ ] Deploy em produção

---

**Criado em:** 4 de Maio de 2026  
**Versão:** 1.0  
**Status:** Pronto para Implementação
