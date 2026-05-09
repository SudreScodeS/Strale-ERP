// lib/ollama-client.ts
// Cliente para Ollama local — interpreta perguntas em linguagem natural
// Roda 100% local, sem APIs externas, sem custo
// Requer: Ollama instalado e rodando com um modelo (ex: qwen2.5:7b)

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

// Modelos em ordem de preferência (fallback automático)
const MODEL_FALLBACKS = [
  OLLAMA_MODEL,
  'qwen2.5:7b',
  'qwen2.5:3b',
  'llama3.2:3b',
  'llama3.2:1b',
  'phi3:mini',
  'gemma2:2b',
];

// ==========================================
// TIPOS
// ==========================================

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
}

interface OllamaTag {
  name: string;
  size: number;
}

interface OllamaTagsResponse {
  models: OllamaTag[];
}

/** Parâmetros extraídos de uma pergunta livre */
export interface ExtractedParams {
  intent: 'quote' | 'query' | 'help' | 'unknown';
  product?: string;          // Nome do produto mencionado
  material?: string;         // Material (TNT, nylon, tecido...)
  color?: string;            // Cor mencionada
  quantity?: number;         // Quantidade
  closure?: string;          // Tipo de fechamento (velop, cordão...)
  dimensions?: { width: number; height: number }; // Dimensões
  printType?: string;        // Tipo de impressão
  printSize?: string;        // Tamanho da logo
  printPosition?: string;    // Posição (frente/verso)
  originalQuestion?: string; // Pergunta original
}

// ==========================================
// HELPERS
// ==========================================

/** Tenta encontrar o primeiro modelo disponível na lista de fallbacks */
async function findAvailableModel(): Promise<string | null> {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return null;

    const data: OllamaTagsResponse = await response.json();
    const availableNames = (data.models || []).map(m => m.name);

    // Procura o primeiro fallback que existe localmente
    for (const candidate of MODEL_FALLBACKS) {
      const baseName = candidate.split(':')[0];
      const found = availableNames.find(name => name.includes(baseName));
      if (found) {
        console.log(`[ollama] Modelo encontrado: ${found}`);
        return found;
      }
    }

    // Se nenhum fallback foi encontrado, usa o primeiro modelo disponível
    if (availableNames.length > 0) {
      console.log(`[ollama] Nenhum modelo preferido encontrado. Usando: ${availableNames[0]}`);
      return availableNames[0];
    }

    return null;
  } catch {
    return null;
  }
}

// ==========================================
// FUNÇÃO PRINCIPAL: EXTRAIR PARÂMETROS
// ==========================================

/**
 * Usa Ollama para interpretar uma pergunta em linguagem natural
 * e extrair parâmetros estruturados para cálculo de preço.
 *
 * Se Ollama não estiver disponível, retorna null (fallback para pattern matching).
 */
export async function extractParamsFromQuestion(question: string): Promise<ExtractedParams | null> {
  // 1. Verifica se Ollama está disponível e encontra modelo
  const model = await findAvailableModel();
  if (!model) {
    console.log('[ollama] Nenhum modelo disponível — usando pattern matching');
    return null;
  }

  const systemPrompt = `Você é um extrator de parâmetros para um ERP de fabricação de sacolas personalizadas.
Sua ÚNICA tarefa é extrair dados estruturados de perguntas em português.

Responda APENAS com JSON válido, sem texto adicional. Formato:

{
  "intent": "quote" | "query" | "help" | "unknown",
  "product": "nome do produto se mencionado",
  "material": "material se mencionado (TNT, nylon, tecido, etc)",
  "color": "cor se mencionada",
  "quantity": número_se_mencionado,
  "closure": "tipo de fechamento se mencionado (velop, cordão, alça, forro)",
  "dimensions": { "width": número_cm, "height": número_cm } ou null,
  "printType": "serigrafia" | "sublimacao" | "dtf" ou null,
  "printSize": "small" | "medium" | "large" ou null,
  "printPosition": "front" | "back" | "both" ou null
}

Exemplos:

Pergunta: "Quanto custa 500 sacolas TNT azuis com velcro?"
{"intent":"quote","product":"sacola","material":"TNT","color":"azul","quantity":500,"closure":"velop","dimensions":null,"printType":null,"printSize":null,"printPosition":null}

Pergunta: "Qual o preço de 1000 sacolas nylon 30x40 com serigrafia frente 2 cores?"
{"intent":"quote","product":"sacola","material":"nylon","color":null,"quantity":1000,"closure":null,"dimensions":{"width":30,"height":40},"printType":"serigrafia","printSize":"medium","printPosition":"front"}

Pergunta: "produto mais vendido"
{"intent":"query","product":null,"material":null,"color":null,"quantity":null,"closure":null,"dimensions":null,"printType":null,"printSize":null,"printPosition":null}

Pergunta: "quanto custa 200 sacolas sublimação grande frente e verso?"
{"intent":"quote","product":"sacola","material":null,"color":null,"quantity":200,"closure":null,"dimensions":null,"printType":"sublimacao","printSize":"large","printPosition":"both"}`;

  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ];

  try {
    console.log(`[ollama] Enviando pergunta para modelo ${model}...`);
    const startTime = Date.now();

    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: 0.1, // Baixa temperatura para respostas determinísticas
          num_predict: 200,  // Resposta curta (só JSON)
        },
      }),
      signal: AbortSignal.timeout(30000), // 30s (modelos maiores podem ser mais lentos)
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      console.error(`[ollama] Erro ${response.status}: ${errorText}`);
      return null;
    }

    const data: OllamaResponse = await response.json();
    const content = data.message?.content?.trim();

    if (!content) {
      console.error('[ollama] Resposta vazia do modelo');
      return null;
    }

    console.log(`[ollama] Resposta recebida em ${elapsed}ms: ${content.substring(0, 100)}...`);

    // Tenta parsear o JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ollama] Nenhum JSON encontrado na resposta');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as ExtractedParams;
    parsed.originalQuestion = question;
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[ollama] Timeout (30s) — modelo muito lento ou travado');
    } else {
      console.error('[ollama] Erro:', error instanceof Error ? error.message : error);
    }
    return null;
  }
}

// ==========================================
// VERIFICAÇÃO DE DISPONIBILIDADE
// ==========================================

/**
 * Verifica se Ollama está rodando e tem modelos instalados.
 * Usado pelo frontend para mostrar status da IA.
 */
export async function checkOllamaStatus(): Promise<{
  available: boolean;
  model?: string;
  models?: string[];
  error?: string;
}> {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return { available: false, error: `Ollama retornou status ${response.status}` };
    }

    const data: OllamaTagsResponse = await response.json();
    const models = (data.models || []).map(m => m.name);

    if (models.length === 0) {
      return {
        available: true,
        model: OLLAMA_MODEL,
        models: [],
        error: 'Ollama está rodando mas nenhum modelo foi baixado. Execute: ollama pull qwen2.5:7b',
      };
    }

    // Verifica se o modelo preferido está disponível
    const preferredBase = OLLAMA_MODEL.split(':')[0];
    const hasModel = models.some(m => m.includes(preferredBase));

    if (!hasModel) {
      // Tenta encontrar um modelo fallback
      const fallback = await findAvailableModel();
      return {
        available: true,
        model: fallback || OLLAMA_MODEL,
        models,
        error: `Modelo "${OLLAMA_MODEL}" não encontrado. Usando: ${fallback || 'nenhum'}. Modelos disponíveis: ${models.join(', ')}`,
      };
    }

    return {
      available: true,
      model: OLLAMA_MODEL,
      models,
    };
  } catch {
    return {
      available: false,
      error: `Ollama não está rodando em ${OLLAMA_BASE}. Instale com: curl -fsSL https://ollama.com/install.sh | sh`,
    };
  }
}
