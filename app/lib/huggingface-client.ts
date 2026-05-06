// app/lib/huggingface-client.ts
// Wrapper para Hugging Face Inference API
// Usado APENAS para refinamento leve (img2img) — NÃO para geração do zero
// Fallback seguro: se a API falhar, retorna a imagem original

const HF_API_BASE = 'https://router.huggingface.co/hf-inference/models';
const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell';

interface RefineOptions {
  /** Strength do img2img (0.0 = sem mudança, 1.0 = regenera tudo) */
  strength?: number;
  /** Número de inference steps */
  steps?: number;
  /** Largura da imagem */
  width?: number;
  /** Altura da imagem */
  height?: number;
  /** Modelo alternativo */
  model?: string;
}

const DEFAULT_REFINE_OPTIONS: Required<RefineOptions> = {
  strength: 0.25,
  steps: 4,
  width: 512,
  height: 640,
  model: DEFAULT_MODEL,
};

/**
 * Refina uma imagem usando img2img via Hugging Face Inference API.
 * O strength baixo (0.2-0.35) faz apenas um refinamento leve,
 * mantendo a estrutura, cor e composição da imagem original.
 *
 * @param imageBuffer - Buffer da imagem original (PNG ou JPEG)
 * @param prompt - Prompt descritivo do que manter/refinar
 * @param options - Opções de refinamento
 * @returns Buffer da imagem refinada, ou a original se a API falhar
 */
export async function refineImageWithAI(
  imageBuffer: Buffer,
  prompt: string,
  options?: RefineOptions,
): Promise<Buffer> {
  const opts = { ...DEFAULT_REFINE_OPTIONS, ...options };
  const token = process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_TOKEN;

  if (!token) {
    console.log('[hf-client] No API key configured — skipping refinement');
    return imageBuffer;
  }

  try {
    // Converter para base64 para img2img
    const base64 = imageBuffer.toString('base64');
    const mimeType = detectMimeType(imageBuffer);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const url = `${HF_API_BASE}/${opts.model}`;
    console.log(`[hf-client] Refining image (${imageBuffer.length} bytes, strength=${opts.strength})...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'image/png',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          image: dataUrl,
          strength: opts.strength,
          num_inference_steps: opts.steps,
          width: opts.width,
          height: opts.height,
          guidance_scale: 7.5,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      console.error(`[hf-client] API error ${response.status}: ${errorText}`);

      // Modelo carregando — informar para retry
      if (response.status === 503) {
        console.log('[hf-client] Model is loading, returning original image');
      }

      return imageBuffer; // Fallback seguro
    }

    const result = Buffer.from(new Uint8Array(await response.arrayBuffer()));

    if (result.length < 100) {
      console.error('[hf-client] Response too small, likely an error');
      return imageBuffer;
    }

    console.log(`[hf-client] Refinement complete: ${result.length} bytes`);
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[hf-client] Request timed out (30s)');
    } else {
      console.error('[hf-client] Error:', error instanceof Error ? error.message : error);
    }
    return imageBuffer; // Fallback seguro
  }
}

/**
 * Gera uma imagem do zero usando text-to-image.
 * Usado apenas para criar a base neutra do produto.
 */
export async function generateImage(
  prompt: string,
  options?: { width?: number; height?: number; steps?: number; model?: string },
): Promise<Buffer | null> {
  const token = process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_TOKEN;
  if (!token) {
    console.error('[hf-client] No API key for generation');
    return null;
  }

  const model = options?.model || DEFAULT_MODEL;
  const url = `${HF_API_BASE}/${model}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'image/png',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width: options?.width || 512,
          height: options?.height || 640,
          num_inference_steps: options?.steps || 6,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      console.error(`[hf-client] Generation failed ${response.status}: ${errorText}`);
      return null;
    }

    const buffer = Buffer.from(new Uint8Array(await response.arrayBuffer()));
    console.log(`[hf-client] Generated image: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error('[hf-client] Generation error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Detecta MIME type pelos magic bytes
 */
function detectMimeType(buffer: Buffer): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/webp';
  return 'image/png';
}
