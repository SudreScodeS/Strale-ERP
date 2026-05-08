// lib/ollama-client.ts
// Cliente para Ollama local — interpreta perguntas em linguagem natural
// Roda 100% local, sem APIs externas, sem custo
// Requer: Ollama instalado e rodando com um modelo (ex: llama3.2:3b)

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

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
// FUNÇÃO PRINCIPAL: EXTRAIR PARÂMETROS
// ==========================================

/**
 * Usa Ollama para interpretar uma pergunta em linguagem natural
 * e extrair parâmetros estruturados para cálculo de preço.
 *
 * Se Ollama não estiver disponível, retorna null (fallback para pattern matching).
 */
export async function extractParamsFromQuestion(question: string): Promise<ExtractedParams | null> {
  try {
    // Verifica se Ollama está disponível
    const healthCheck = await fetch(`${OLLAMA_BASE}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (!healthCheck.ok) return null;
  } catch {
    // Ollama não está rodando — fallback para pattern matching
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
    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.1, // Baixa temperatura para respostas determinísticas
          num_predict: 200,  // Resposta curta (só JSON)
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data: OllamaResponse = await response.json();
    const content = data.message?.content?.trim();

    if (!content) return null;

    // Tenta parsear o JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as ExtractedParams;
    parsed.originalQuestion = question;
    return parsed;
  } catch {
    // Erro na comunicação com Ollama — fallback silencioso
    return null;
  }
}

// ==========================================
// VERIFICAÇÃO DE DISPONIBILIDADE
// ==========================================

/**
 * Verifica se Ollama está rodando e tem o modelo instalado.
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

    const data = await response.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);
    const hasModel = models.some((m: string) => m.includes(OLLAMA_MODEL.split(':')[0]));

    return {
      available: true,
      model: OLLAMA_MODEL,
      models,
      ...((!hasModel) ? { error: `Modelo ${OLLAMA_MODEL} não encontrado. Modelos disponíveis: ${models.join(', ')}` } : {}),
    };
  } catch {
    return { available: false, error: 'Ollama não está rodando. Instale com: curl -fsSL https://ollama.com/install.sh | sh' };
  }
}
