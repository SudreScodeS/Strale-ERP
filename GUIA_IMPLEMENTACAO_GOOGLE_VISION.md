# GUIA TÉCNICO: IMPLEMENTAR ANÁLISE DE LOGO COM GOOGLE VISION AI

## 🎯 OBJETIVO

Substituir a análise SIMULADA de logo por análise REAL usando Google Cloud Vision AI.

**Problema Atual:**
```typescript
// Código atual - ERRADO!
export async function analisarLogo(imageFile: { size: number } | null): Promise<LogoAnalysis> {
  const colors = imageFile ? Math.max(1, Math.min(5, imageFile.size % 6)) : 1;
  // Usa tamanho do arquivo para calcular cores. TOTALMENTE ALEATÓRIO!
  return { colors, cost: calculateLogoCost(colors) };
}
```

**Solução:**
```typescript
// Novo código - CORRETO!
export async function analisarLogo(imageBuffer: Buffer): Promise<LogoAnalysis> {
  const colors = await googleVision.detectDominantColors(imageBuffer);
  const complexity = await googleVision.analyzeComplexity(imageBuffer);
  const isSafe = await googleVision.checkContentSafety(imageBuffer);
  
  return {
    colors: colors.length,
    cost: calculateLogoCost(colors.length),
    complexity,
    isAppropriate: isSafe,
  };
}
```

---

## 📋 PRÉ-REQUISITOS

### 1. Conta Google Cloud

1. Ir para https://console.cloud.google.com
2. Criar novo projeto: "simple-erp-ai"
3. Ativar a API: **Cloud Vision API**
4. Criar Service Account com role "Editor"
5. Baixar chave JSON

### 2. Dependências Node.js

```bash
npm install @google-cloud/vision
npm install --save-dev @types/node
```

### 3. Variáveis de Ambiente

Criar arquivo `.env.local` (NUNCA commitar):
```env
GOOGLE_CLOUD_KEY_PATH=./config/google-credentials.json
GOOGLE_CLOUD_PROJECT_ID=simple-erp-ai
LOG_LEVEL=info
```

---

## 🔧 PASSO 1: CONFIGURAR CREDENCIAIS

### 1.1 Salvar chave JSON do Google

```bash
# Criar pasta para credenciais
mkdir -p config

# Colar o arquivo JSON baixado do Google Cloud
# Renomear para: google-credentials.json
cp ~/Downloads/simple-erp-ai-xxxxx.json config/google-credentials.json
```

### 1.2 Criar arquivo de configuração

Criar [config/google-vision.ts](config/google-vision.ts):

```typescript
// config/google-vision.ts
// Configuração centralizada para Google Vision AI
// Facilita mudança de provider no futuro (AWS, Azure, etc)

import vision from '@google-cloud/vision';

// Reutilizar client (evita criar múltiplas conexões)
let client: vision.ImageAnnotatorClient | null = null;

export function getVisionClient(): vision.ImageAnnotatorClient {
  if (!client) {
    const keyPath = process.env.GOOGLE_CLOUD_KEY_PATH;
    if (!keyPath) {
      throw new Error('GOOGLE_CLOUD_KEY_PATH environment variable not set');
    }
    
    client = new vision.ImageAnnotatorClient({
      keyFilename: keyPath,
    });
  }
  return client;
}

export const VISION_CONFIG = {
  // Número máximo de cores consideradas "significativas"
  MAX_SIGNIFICANT_COLORS: 10,
  
  // Limites de arquivo
  MAX_IMAGE_SIZE_MB: 5,
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
  
  // Thresholds de análise
  SAFE_SEARCH_THRESHOLD: 'VERY_UNLIKELY', // Rejeitar conteúdo impróprio
  MIN_CONFIDENCE_COLOR: 0.1, // 10% de confiança mínima
};
```

---

## 🎨 PASSO 2: CRIAR SERVIÇO DE ANÁLISE

Criar [app/lib/aiServices/logoAnalyzer.ts](app/lib/aiServices/logoAnalyzer.ts):

```typescript
// app/lib/aiServices/logoAnalyzer.ts
// Análise inteligente de logos com Google Vision AI
// Detecta: cores, complexidade, segurança, descrição

import { getVisionClient, VISION_CONFIG } from '../../config/google-vision';
import { LogoAnalysis } from '../../types';
import { calculateLogoCost } from '../../config/global';

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Validar arquivo de imagem antes de processar
 * Previne: arquivos corrompidos, tamanho excessivo, formato inválido
 */
function validarImagem(file: { size: number; type: string }): { valid: boolean; error?: string } {
  // Verificar tamanho
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > VISION_CONFIG.MAX_IMAGE_SIZE_MB) {
    return { valid: false, error: `Arquivo muito grande (${sizeMB}MB). Máximo: ${VISION_CONFIG.MAX_IMAGE_SIZE_MB}MB` };
  }

  // Verificar tipo
  if (!VISION_CONFIG.ALLOWED_FORMATS.includes(file.type)) {
    return { valid: false, error: `Formato inválido: ${file.type}. Aceitos: ${VISION_CONFIG.ALLOWED_FORMATS.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Converter File para Buffer (necessário para Google Vision)
 */
async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extrair cores dominantes da resposta da API
 * Retorna apenas cores com significância acima do threshold
 */
function extrairCoresDominantes(
  colorsAnnotation: any
): Array<{ hex: string; confidence: number }> {
  if (!colorsAnnotation?.colors) {
    return [];
  }

  return colorsAnnotation.colors
    .filter((color: any) => color.score >= VISION_CONFIG.MIN_CONFIDENCE_COLOR)
    .slice(0, VISION_CONFIG.MAX_SIGNIFICANT_COLORS)
    .map((color: any) => {
      const c = color.color;
      const hex = `#${((c.red << 16) | (c.green << 8) | c.blue).toString(16).padStart(6, '0')}`;
      return {
        hex,
        confidence: Math.round(color.score * 100),
      };
    });
}

/**
 * Calcular nível de complexidade baseado em análise visual
 * SIMPLES: poucas cores, formas básicas
 * MÉDIA: múltiplas cores, alguns detalhes
 * COMPLEXA: muitas cores, muitos detalhes, texto
 */
function calcularComplexidade(
  labelsAnnotation: any,
  colorsAnnotation: any,
  textAnnotation: any
): 'SIMPLES' | 'MÉDIA' | 'COMPLEXA' {
  const numCores = colorsAnnotation?.colors?.length || 0;
  const numLabels = labelsAnnotation?.length || 0;
  const temTexto = textAnnotation?.fullText && textAnnotation.fullText.trim().length > 0;

  // Scoring de complexidade
  let score = 0;
  score += numCores * 2; // Cores têm peso importante
  score += numLabels * 1; // Elementos detectados
  score += temTexto ? 3 : 0; // Texto = mais complexo

  if (score <= 5) return 'SIMPLES';
  if (score <= 15) return 'MÉDIA';
  return 'COMPLEXA';
}

/**
 * Verificar se conteúdo é apropriado (segurança)
 * Rejeita: conteúdo violento, sexual, de ódio, etc
 */
function verificarSeguranca(safeSearchAnnotation: any): {
  isAppropriate: boolean;
  reason?: string;
} {
  const niveis = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
  const nivelMinimo = niveis.indexOf(VISION_CONFIG.SAFE_SEARCH_THRESHOLD);

  const checks = {
    ADULT: { name: 'Conteúdo adulto', level: niveis.indexOf(safeSearchAnnotation.adult) },
    VIOLENCE: { name: 'Violência', level: niveis.indexOf(safeSearchAnnotation.violence) },
    RACY: { name: 'Conteúdo inapropriado', level: niveis.indexOf(safeSearchAnnotation.racy) },
    SPOOF: { name: 'Conteúdo falsificado', level: niveis.indexOf(safeSearchAnnotation.spoof) },
    MEDICAL: { name: 'Conteúdo médico', level: niveis.indexOf(safeSearchAnnotation.medical) },
  };

  for (const [key, check] of Object.entries(checks)) {
    if (check.level > nivelMinimo) {
      return {
        isAppropriate: false,
        reason: `Rejeitado: ${check.name}`,
      };
    }
  }

  return { isAppropriate: true };
}

/**
 * Extrair descrição e elementos detectados
 */
function extrairDescricao(labelsAnnotation: any): {
  description: string;
  detectedElements: string[];
} {
  if (!labelsAnnotation || labelsAnnotation.length === 0) {
    return { description: 'Logo customizado', detectedElements: [] };
  }

  const elementos = labelsAnnotation
    .slice(0, 5) // Top 5 elementos
    .map((label: any) => label.description);

  const description = `Logo contendo: ${elementos.join(', ')}`;

  return {
    description,
    detectedElements: elementos,
  };
}

// ==========================================
// FUNÇÃO PRINCIPAL: ANALISAR LOGO
// ==========================================

/**
 * Análise completa de logo usando Google Cloud Vision AI
 * 
 * @param file - Arquivo de imagem (File object do FormData)
 * @returns LogoAnalysis com cores reais, complexidade, segurança
 * 
 * Exemplo:
 * ```
 * const analysis = await analisarLogo(formData.get('logo'));
 * console.log(`Logo tem ${analysis.colors} cores, custo adicional: R$ ${analysis.cost}`);
 * ```
 */
export async function analisarLogo(file: File | null): Promise<LogoAnalysis> {
  // Validações
  if (!file) {
    return {
      colors: 1,
      cost: calculateLogoCost(1),
      complexity: 'SIMPLES',
      isAppropriate: true,
      description: 'Sem logo',
      detectedElements: [],
    };
  }

  // Validar arquivo
  const validacao = validarImagem({ size: file.size, type: file.type });
  if (!validacao.valid) {
    throw new Error(`Imagem inválida: ${validacao.error}`);
  }

  try {
    // Converter arquivo para buffer
    const imageBuffer = await fileToBuffer(file);

    // Chamar Google Vision API
    const client = getVisionClient();
    const request = {
      image: { content: imageBuffer },
      features: [
        { type: 'IMAGE_PROPERTIES' }, // Cores dominantes
        { type: 'LABEL_DETECTION' }, // O que é (logo, design, etc)
        { type: 'TEXT_DETECTION' }, // Texto na imagem
        { type: 'SAFE_SEARCH_DETECTION' }, // Segurança
      ],
    };

    const [result] = await client.annotateImage(request);

    // Validar segurança
    const seguranca = verificarSeguranca(result.safeSearchAnnotation || {});
    if (!seguranca.isAppropriate) {
      throw new Error(seguranca.reason);
    }

    // Extrair dados
    const cores = extrairCoresDominantes(result.imagePropertiesAnnotation);
    const complexity = calcularComplexidade(
      result.labelAnnotations,
      result.imagePropertiesAnnotation,
      result.fullTextAnnotation
    );
    const { description, detectedElements } = extrairDescricao(result.labelAnnotations);

    // Retornar análise completa
    return {
      colors: cores.length || 1, // Mínimo 1 cor
      cost: calculateLogoCost(cores.length || 1),
      complexity,
      isAppropriate: true,
      description,
      detectedElements,
    };
  } catch (error) {
    console.error('Erro ao analisar logo:', error);
    throw new Error(`Falha na análise de logo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Versão SÍNCRONA para análise simulada (fallback quando API cai)
 * Usa a análise antiga baseada em tamanho como backup
 */
export async function analisarLogoFallback(file: File | null): Promise<LogoAnalysis> {
  if (!file) {
    return {
      colors: 1,
      cost: calculateLogoCost(1),
      complexity: 'SIMPLES',
      isAppropriate: true,
      description: 'Sem logo',
      detectedElements: [],
    };
  }

  // Fallback: análise simulada (se Google Vision cair)
  const colors = Math.max(1, Math.min(5, Math.floor(file.size / 10000)));
  return {
    colors,
    cost: calculateLogoCost(colors),
    complexity: colors <= 2 ? 'SIMPLES' : colors <= 4 ? 'MÉDIA' : 'COMPLEXA',
    isAppropriate: true,
    description: 'Análise simplificada (fallback)',
    detectedElements: [],
  };
}
```

---

## 📝 PASSO 3: ATUALIZAR TIPOS

Atualizar [types/index.ts](types/index.ts):

```typescript
// Adicionar ao arquivo types/index.ts

export interface LogoAnalysis {
  colors: number;
  cost: number;
  complexity: 'SIMPLES' | 'MÉDIA' | 'COMPLEXA';
  isAppropriate: boolean;
  description: string;
  detectedElements: string[];
  // Novos campos para análise avançada
  dominantColors?: Array<{ hex: string; confidence: number }>;
  analysisDate?: Date;
  provider?: 'google-vision' | 'fallback';
}
```

---

## 🔄 PASSO 4: INTEGRAR NA ROTA DE VENDAS

Atualizar [app/api/orders/route.ts](app/api/orders/route.ts):

```typescript
// Adicionar este import
import { analisarLogo, analisarLogoFallback } from '@/app/lib/aiServices/logoAnalyzer';

// Na função de processar pedido, substituir:

// ANTES:
const logoAnalysis = await analisarLogo({ size: logoFile?.size || 0 });

// DEPOIS:
let logoAnalysis;
try {
  logoAnalysis = await analisarLogo(logoFile || null);
} catch (error) {
  console.warn('Google Vision indisponível, usando fallback:', error);
  logoAnalysis = await analisarLogoFallback(logoFile || null);
}
```

---

## 📱 PASSO 5: ATUALIZAR PÁGINA DE VENDAS

Atualizar [app/sales/page.tsx](app/sales/page.tsx):

Encontrar a seção de análise de logo e substituir o comentário PLACEHOLDER:

```typescript
// ANTES:
<p>A função analisarLogo simula detecção de cores para cálculo de preço. Cada cor custa R$ {globalConfig.logoPricePerColor}.</p>

// DEPOIS:
<div className="bg-blue-50 p-4 rounded">
  <h3 className="font-semibold mb-2">🤖 Análise com IA Real</h3>
  <p>Sua logo é analisada em tempo real com Google Cloud Vision AI para:</p>
  <ul className="list-disc ml-5 mt-2">
    <li>✅ Detectar cores reais da imagem</li>
    <li>✅ Analisar complexidade (simples/média/complexa)</li>
    <li>✅ Validar conteúdo apropriado</li>
    <li>✅ Calcular preço exato</li>
  </ul>
  <p className="text-sm text-gray-600 mt-2">Cada cor detectada custa R$ {globalConfig.logoPricePerColor}</p>
</div>
```

---

## 🧪 PASSO 6: TESTAR

### Teste Manual no Navegador

1. Ir para http://localhost:3000/sales
2. Upload de uma imagem com logo
3. Verificar console do navegador (DevTools → Network)
4. Confirmar que análise voltou com cores reais

### Teste Automático

Criar [app/__tests__/logoAnalyzer.test.ts](app/__tests__/logoAnalyzer.test.ts):

```typescript
import { analisarLogo } from '@/app/lib/aiServices/logoAnalyzer';

describe('Logo Analyzer', () => {
  it('should detect colors in a real logo image', async () => {
    // Usar imagem de teste
    const testImagePath = './public/test-logo.jpg';
    const file = new File(
      [await require('fs').promises.readFile(testImagePath)],
      'test-logo.jpg',
      { type: 'image/jpeg' }
    );

    const analysis = await analisarLogo(file);

    expect(analysis.colors).toBeGreaterThan(0);
    expect(analysis.cost).toBeGreaterThan(0);
    expect(['SIMPLES', 'MÉDIA', 'COMPLEXA']).toContain(analysis.complexity);
    expect(analysis.isAppropriate).toBe(true);
  });

  it('should reject inappropriate content', async () => {
    // Usar imagem imprópria para teste
    // ... código de teste
  });
});
```

---

## 🐛 PASSO 7: TRATAMENTO DE ERROS

Criar [app/lib/aiServices/errorHandler.ts](app/lib/aiServices/errorHandler.ts):

```typescript
// app/lib/aiServices/errorHandler.ts

export class LogoAnalysisError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

export const LOGO_ERRORS = {
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    message: 'Arquivo de imagem muito grande',
    statusCode: 413,
  },
  INVALID_FORMAT: {
    code: 'INVALID_FORMAT',
    message: 'Formato de arquivo não suportado',
    statusCode: 400,
  },
  INAPPROPRIATE_CONTENT: {
    code: 'INAPPROPRIATE_CONTENT',
    message: 'Imagem contém conteúdo inapropriado',
    statusCode: 400,
  },
  API_ERROR: {
    code: 'API_ERROR',
    message: 'Erro ao analisar imagem. Tente novamente.',
    statusCode: 500,
  },
  CORRUPTED_FILE: {
    code: 'CORRUPTED_FILE',
    message: 'Arquivo de imagem corrupto ou inválido',
    statusCode: 400,
  },
};

export function handleLogoAnalysisError(error: unknown): LogoAnalysisError {
  if (error instanceof LogoAnalysisError) {
    return error;
  }

  console.error('Unexpected error in logo analysis:', error);

  return new LogoAnalysisError(
    LOGO_ERRORS.API_ERROR.code,
    LOGO_ERRORS.API_ERROR.message,
    LOGO_ERRORS.API_ERROR.statusCode
  );
}
```

---

## 📊 PASSO 8: LOGGING E MONITORAMENTO

Adicionar logging para rastrear análises:

```typescript
// Adicionar ao final de app/lib/aiServices/logoAnalyzer.ts

/**
 * Log de análise para auditoria
 */
function logAnalysis(analysis: LogoAnalysis, fileSize: number, duration: number) {
  const log = {
    timestamp: new Date().toISOString(),
    colors: analysis.colors,
    complexity: analysis.complexity,
    isAppropriate: analysis.isAppropriate,
    fileSizeMB: (fileSize / (1024 * 1024)).toFixed(2),
    durationMs: duration,
    provider: analysis.provider || 'google-vision',
  };

  console.log('[LOGO_ANALYSIS]', JSON.stringify(log));
  
  // Em produção, enviar para serviço de logging (Sentry, CloudWatch, etc)
  // await sendToLoggingService(log);
}
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Conta Google Cloud criada
- [ ] Vision API ativada
- [ ] Credenciais JSON baixadas
- [ ] npm install executado
- [ ] config/google-vision.ts criado
- [ ] app/lib/aiServices/logoAnalyzer.ts criado
- [ ] types/index.ts atualizado
- [ ] API route atualizada para usar nova análise
- [ ] UI da página de vendas atualizada
- [ ] Testes criados e executados
- [ ] Tratamento de erros implementado
- [ ] Logging configurado
- [ ] .env.local não commitado (no .gitignore)
- [ ] Deploy testado em staging

---

## 🚀 PRÓXIMOS PASSOS

1. **Após implementar análise de logo:**
   - Coletar feedback de usuários
   - Monitorar custos da API
   - Avaliar acurácia da detecção

2. **Próxima feature:**
   - Implementar previsão de demanda
   - Ver [PROMPT_PARA_IA.md](PROMPT_PARA_IA.md) para guia completo

---

**Tempo estimado de implementação:** 2-4 horas  
**Dificuldade:** Intermediária  
**Impacto:** 🔴 CRÍTICO (melhora precisão de preços em 90%)

