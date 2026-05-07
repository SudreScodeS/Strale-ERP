// app/lib/krea-client.ts
// Wrapper para Krea AI API
// Usado para geração do zero (text-to-image) e refinamento (img2img)
// API assíncrona: submit job → poll → download result
// Fallback seguro: se a API falhar, retorna a imagem original

const KREA_API_BASE = 'https://api.krea.ai';

// Models
const TEXT_TO_IMAGE_MODEL = 'bfl/flux-1-dev';       // Fast, good quality, ~7s
const IMAGE_EDIT_MODEL = 'bfl/flux-1-kontext-dev';  // Image editing, ~23s

interface GenerateOptions {
  width?: number;
  height?: number;
  steps?: number;
}

interface RefineOptions {
  /** Strength do img2img (0.0 = sem mudança, 1.0 = regenera tudo) */
  strength?: number;
  /** Número de inference steps */
  steps?: number;
  /** Largura da imagem */
  width?: number;
  /** Altura da imagem */
  height?: number;
  /** Negative prompt — what the AI should avoid generating */
  negativePrompt?: string;
}

const DEFAULT_REFINE_OPTIONS: Required<RefineOptions> = {
  strength: 0.38,
  steps: 25,
  width: 512,
  height: 640,
  negativePrompt: '',
};

const DEFAULT_GENERATE_OPTIONS: Required<GenerateOptions> = {
  width: 512,
  height: 640,
  steps: 25,
};

// ==========================================
// Job polling
// ==========================================

interface KreaJobResult {
  job_id: string;
  status: string;
  result: {
    urls?: string[];
    error?: string;
  } | null;
}

async function pollJob(jobId: string, token: string, maxWaitMs = 180_000): Promise<Buffer | null> {
  const startTime = Date.now();
  const pollInterval = 2_000; // 2s initial

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${KREA_API_BASE}/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error(`[krea-client] Poll error ${response.status}`);
      return null;
    }

    const job: KreaJobResult = await response.json();

    if (job.status === 'completed' && job.result?.urls?.length) {
      // Download the generated image
      const imageUrl = job.result.urls[0];
      console.log(`[krea-client] Job completed, downloading from ${imageUrl.substring(0, 60)}...`);
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        console.error(`[krea-client] Image download failed: ${imgResponse.status}`);
        return null;
      }
      const buffer = Buffer.from(new Uint8Array(await imgResponse.arrayBuffer()));
      console.log(`[krea-client] Downloaded: ${buffer.length} bytes`);
      return buffer;
    }

    if (job.status === 'failed' || job.status === 'cancelled') {
      console.error(`[krea-client] Job ${job.status}: ${job.result?.error || 'unknown error'}`);
      return null;
    }

    // Still processing — wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  console.error(`[krea-client] Job timed out after ${maxWaitMs}ms`);
  return null;
}

// ==========================================
// Asset upload (for img2img)
// ==========================================

async function uploadAsset(imageBuffer: Buffer, token: string): Promise<string | null> {
  try {
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('file', blob, 'image.png');

    const response = await fetch(`${KREA_API_BASE}/assets`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      console.error(`[krea-client] Asset upload failed ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log(`[krea-client] Asset uploaded: ${data.image_url?.substring(0, 60)}...`);
    return data.image_url || null;
  } catch (error) {
    console.error('[krea-client] Asset upload error:', error instanceof Error ? error.message : error);
    return null;
  }
}

// ==========================================
// Text-to-image generation
// ==========================================

/**
 * Gera uma imagem do zero usando text-to-image via Krea (Flux).
 * Usado apenas para criar a base neutra do produto.
 */
export async function generateImage(
  prompt: string,
  options?: GenerateOptions,
): Promise<Buffer | null> {
  const token = process.env.KREA_API_KEY;
  if (!token) {
    console.error('[krea-client] No API key for generation');
    return null;
  }

  const opts = { ...DEFAULT_GENERATE_OPTIONS, ...options };

  try {
    console.log(`[krea-client] Generating image (${opts.width}x${opts.height}, steps=${opts.steps})...`);

    const response = await fetch(`${KREA_API_BASE}/generate/image/${TEXT_TO_IMAGE_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        width: opts.width,
        height: opts.height,
        steps: opts.steps,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      console.error(`[krea-client] Generation request failed ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json();
    const jobId = data.job_id;

    if (!jobId) {
      console.error('[krea-client] No job_id in response');
      return null;
    }

    console.log(`[krea-client] Job created: ${jobId}, polling...`);
    return pollJob(jobId, token, 120_000);
  } catch (error) {
    console.error('[krea-client] Generation error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Refina uma imagem usando img2img via Krea (Flux Kontext).
 * Upload da imagem → gera com strength baixo → baixa resultado.
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
  const token = process.env.KREA_API_KEY;
  if (!token) {
    console.log('[krea-client] No API key configured — skipping refinement');
    return imageBuffer;
  }

  const opts = { ...DEFAULT_REFINE_OPTIONS, ...options };

  try {
    // Step 1: Upload image to Krea assets to get a URL
    console.log(`[krea-client] Uploading image for refinement (${imageBuffer.length} bytes)...`);
    const imageUrl = await uploadAsset(imageBuffer, token);
    if (!imageUrl) {
      console.error('[krea-client] Failed to upload image, returning original');
      return imageBuffer;
    }

    // Step 2: Submit img2img job via Flux Kontext
    console.log(`[krea-client] Refining image (strength=${opts.strength}, steps=${opts.steps})...`);

    const body: Record<string, unknown> = {
      prompt,
      imageUrl,
      strength: opts.strength,
      steps: opts.steps,
      width: opts.width,
      height: opts.height,
    };

    if (opts.negativePrompt) {
      body.negative_prompt = opts.negativePrompt;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(`${KREA_API_BASE}/generate/image/${IMAGE_EDIT_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      console.error(`[krea-client] Refinement request failed ${response.status}: ${errorText}`);
      return imageBuffer;
    }

    const data = await response.json();
    const jobId = data.job_id;

    if (!jobId) {
      console.error('[krea-client] No job_id in refinement response');
      return imageBuffer;
    }

    console.log(`[krea-client] Refinement job: ${jobId}, polling...`);
    const result = await pollJob(jobId, token, 180_000);

    if (result && result.length > 100) {
      console.log(`[krea-client] Refinement complete: ${result.length} bytes`);
      return result;
    }

    console.log('[krea-client] Refinement produced no usable result, returning original');
    return imageBuffer;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[krea-client] Refinement request timed out (30s)');
    } else {
      console.error('[krea-client] Refinement error:', error instanceof Error ? error.message : error);
    }
    return imageBuffer;
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
