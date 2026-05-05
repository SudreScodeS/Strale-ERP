// app/api/product-image/route.ts
// Gera imagem de produto usando IA — forma consistente + cor via img2img + logo integrada
//
// FLUXO:
// 1. Gera base NEUTRA (cinza claro) UMA VEZ por estilo → cache
// 2. Para cada cor: img2img muda a cor mantendo a forma (SDXL)
// 3. Remove fundo da logo + compõe com sharp
// 4. img2img final integra a logo no material

import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';
import sharp from 'sharp';

// Cache de imagens (por prompt+logo hash)
const imageCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

// Cache de bases neutras por estilo — GARANTE mesma forma para todas as cores
const neutralBaseCache = new Map<string, Buffer>();

// Token HF cacheado
let hfTokenCache: string | null = null;

function getCacheKey(color: string, style: string, variables: string[], logoHash?: string): string {
  const parts = [color, style, ...variables];
  if (logoHash) parts.push(logoHash);
  return parts.join('|');
}

// ==========================================
// PROMPTS
// ==========================================

/**
 * Prompt para gerar a base NEUTRA (cinza claro).
 * Esta imagem é gerada UMA VEZ e reusada para todas as cores.
 */
function buildNeutralBasePrompt(style: string, variables: string[]): string {
  const sizeVar = variables.find(v =>
    ['pequeno', 'small', 'médio', 'medio', 'medium', 'grande', 'large', 'extra'].some(s => v.toLowerCase().includes(s))
  );
  const materialVar = variables.find(v =>
    ['nylon', 'tnt', 'algodão', 'algodao', 'cotton', 'lona', 'canvas', 'ecobag'].some(s => v.toLowerCase().includes(s))
  );

  let sizeDesc = 'medium-sized';
  if (sizeVar) {
    const l = sizeVar.toLowerCase();
    if (l.includes('pequeno') || l.includes('small')) sizeDesc = 'small compact';
    else if (l.includes('grande') || l.includes('large')) sizeDesc = 'large roomy';
    else if (l.includes('extra')) sizeDesc = 'extra-large oversized';
  }

  let materialDesc = 'woven cotton canvas fabric';
  if (materialVar) {
    const l = materialVar.toLowerCase();
    if (l.includes('nylon')) materialDesc = 'nylon';
    else if (l.includes('tnt')) materialDesc = 'non-woven TNT fabric';
    else if (l.includes('algodão') || l.includes('algodao') || l.includes('cotton')) materialDesc = 'cotton canvas';
    else if (l.includes('lona') || l.includes('canvas')) materialDesc = 'sturdy canvas';
    else if (l.includes('ecobag')) materialDesc = 'eco-friendly recycled fabric';
  }

  const base = 'professional product photography, studio lighting, white seamless background, centered, commercial e-commerce photo, 4k, ultra sharp focus, Canon EOS R5, 100mm macro lens, high detail, realistic material texture';

  const stylePrompts: Record<string, string> = {
    sacola: `a single ${sizeDesc} tote bag made of ${materialDesc}, rectangular shape, flat bottom, two sturdy rope handles attached at the top, clean front panel, solid medium gray color, visible fabric weave texture, natural fabric drape, ${base}`,
    camiseta: `a single ${sizeDesc} crew-neck t-shirt made of ${materialDesc}, short sleeves, displayed on invisible mannequin showing natural drape, solid medium gray color, visible knit texture, neat collar, ${base}`,
    caneca: `a single ${sizeDesc} ceramic coffee mug with C-shaped handle, cylindrical body, smooth glossy glaze finish, solid medium gray color, subtle highlight reflection on surface, ${base}`,
  };

  return stylePrompts[style] || stylePrompts.sacola;
}

/**
 * Prompt para mudar a cor via img2img.
 * Descreve o produto com a cor desejada, preservando forma e material.
 */
function buildColorChangePrompt(colorName: string, style: string): string {
  const stylePrompts: Record<string, string> = {
    sacola: `a ${colorName} colored woven fabric tote bag, same rectangular shape, sturdy rope handles, solid ${colorName} fabric, product photography, white background, studio lighting, 4k, commercial photo, sharp focus`,
    camiseta: `a ${colorName} colored cotton t-shirt, same shirt shape and fabric, solid ${colorName} color, product photography, white background, studio lighting, 4k, sharp focus`,
    caneca: `a ${colorName} colored ceramic mug, same cylindrical mug shape, solid ${colorName} color, product photography, white background, studio lighting, 4k, sharp focus`,
  };
  return stylePrompts[style] || stylePrompts.sacola;
}

/**
 * Prompt para integrar a logo via img2img (passo final).
 */
function buildLogoIntegrationPrompt(colorName: string, style: string): string {
  return `Professional studio product photograph of a ${colorName} colored ${style}. ` +
    `A custom logo is screen-printed directly on the front surface. ` +
    `The logo ink has been absorbed into the material fibers, creating a seamless, natural integration. ` +
    `The logo follows the natural surface texture, folds, and lighting of the product material. ` +
    `The printed area has a soft matte appearance with slightly fuzzy edges where the ink meets the material. ` +
    `There is NO visible border, NO rectangular frame, NO background behind the logo. ` +
    `The logo looks like it was printed during manufacturing, not applied afterward. ` +
    `Ultra-realistic, indistinguishable from a real product photo. 8k, sharp focus, ` +
    `commercial e-commerce photography, Canon EOS R5, 100mm macro lens.`;
}

// ==========================================
// UTILITÁRIOS DE COR
// ==========================================

function hexToColorName(hex: string): string {
  const colorNames: Record<string, string> = {
    '#dc2626': 'red', '#ef4444': 'bright red',
    '#2563eb': 'royal blue', '#3b82f6': 'blue', '#1e40af': 'dark blue', '#1e3a8a': 'navy blue',
    '#16a34a': 'green', '#22c55e': 'bright green', '#15803d': 'forest green',
    '#eab308': 'yellow', '#f59e0b': 'amber',
    '#1e293b': 'black', '#0f172a': 'dark black',
    '#f8fafc': 'white', '#ffffff': 'pure white',
    '#ec4899': 'pink', '#f472b6': 'light pink',
    '#9333ea': 'purple', '#a855f7': 'bright purple',
    '#ea580c': 'orange', '#f97316': 'bright orange',
    '#64748b': 'gray', '#94a3b8': 'light gray',
    '#92400e': 'brown', '#b45309': 'warm brown',
    '#ca8a04': 'gold', '#d4a574': 'beige',
    '#7f1d1d': 'dark red wine',
    '#06b6d4': 'cyan', '#22d3ee': 'bright cyan',
    '#d946ef': 'magenta',
  };
  if (colorNames[hex]) return colorNames[hex];
  const rgb = hexToRgb(hex);
  if (!rgb) return 'blue';
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const h = hsl[0], s = hsl[1], l = hsl[2];
  if (s < 10) { if (l < 20) return 'black'; if (l > 80) return 'white'; return 'gray'; }
  if (h < 15) return l > 60 ? 'light red' : 'red';
  if (h < 45) return l > 60 ? 'light orange' : 'orange';
  if (h < 70) return l > 60 ? 'light yellow' : 'yellow';
  if (h < 160) return l > 60 ? 'light green' : 'green';
  if (h < 200) return l > 60 ? 'light cyan' : 'cyan';
  if (h < 260) return l > 60 ? 'light blue' : 'blue';
  if (h < 300) return l > 60 ? 'light purple' : 'purple';
  return l > 60 ? 'light pink' : 'pink';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

// ==========================================
// HUGGING FACE API
// ==========================================

async function callHfApi(
  hfToken: string,
  model: string,
  body: object,
): Promise<{ ok: boolean; status: number; buffer?: Buffer; error?: string }> {
  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    return { ok: false, status: response.status, error: errText.substring(0, 300) };
  }

  const arrayBuf = await response.arrayBuffer();
  return { ok: true, status: response.status, buffer: Buffer.from(new Uint8Array(arrayBuf)) };
}

// ==========================================
// PASSO 1: Gerar base neutra (UMA VEZ por estilo)
// ==========================================

async function getOrCreateNeutralBase(
  hfToken: string,
  style: string,
  variables: string[],
): Promise<Buffer | null> {
  const cacheKey = `neutral-${style}-${variables.join(',')}`;
  const cached = neutralBaseCache.get(cacheKey);
  if (cached) {
    console.log(`[product-image] Using cached neutral base for ${style}`);
    return cached;
  }

  const prompt = buildNeutralBasePrompt(style, variables);
  console.log(`[product-image] Generating neutral base for ${style}...`);

  const result = await callHfApi(
    hfToken,
    'black-forest-labs/FLUX.1-schnell',
    {
      inputs: prompt,
      parameters: { width: 512, height: 640, num_inference_steps: 6 },
    },
  );

  if (!result.ok || !result.buffer) {
    console.error(`[product-image] Neutral base generation failed: ${result.status} ${result.error}`);
    return null;
  }

  neutralBaseCache.set(cacheKey, result.buffer);
  console.log(`[product-image] Neutral base cached for ${style}: ${result.buffer.length} bytes`);
  return result.buffer;
}

// ==========================================
// PASSO 2: Recolorir via img2img (SDXL)
// ==========================================

async function recolorViaImg2Img(
  hfToken: string,
  neutralBuffer: Buffer,
  colorName: string,
  style: string,
): Promise<Buffer | null> {
  const base64 = neutralBuffer.toString('base64');
  const prompt = buildColorChangePrompt(colorName, style);

  console.log(`[product-image] Recoloring to ${colorName} via img2img (strength=0.55)...`);

  const result = await callHfApi(
    hfToken,
    'stabilityai/stable-diffusion-xl-refiner-1.0',
    {
      inputs: prompt,
      parameters: {
        image: `data:image/png;base64,${base64}`,
        strength: 0.55, // Moderado: muda cor mas preserva forma
        guidance_scale: 7.5,
        num_inference_steps: 30,
        negative_prompt: 'different shape, different product, deformed, blurry, low quality, distorted, text, logo, watermark',
      },
    },
  );

  if (!result.ok || !result.buffer) {
    console.log(`[product-image] Recolor failed (${result.status}): ${result.error}`);
    return null;
  }

  return result.buffer;
}

// ==========================================
// PASSO 3: Remover fundo da logo
// ==========================================

async function removeLogoBackground(logoBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(logoBuffer).metadata();
  if (meta.channels === 4) {
    return sharp(logoBuffer).ensureAlpha().png().toBuffer();
  }

  const { data, info } = await sharp(logoBuffer).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const outputBuffer = Buffer.alloc(w * h * 4);

  // Amostrar TODOS os pixels das bordas
  const edgePixels: { r: number; g: number; b: number }[] = [];
  const borderWidth = Math.max(3, Math.floor(Math.min(w, h) * 0.05));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < borderWidth || y >= h - borderWidth || x < borderWidth || x >= w - borderWidth) {
        const idx = (y * w + x) * channels;
        edgePixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
      }
    }
  }

  const avgBrightness = edgePixels.reduce((s, p) => s + (p.r * 0.299 + p.g * 0.587 + p.b * 0.114), 0) / edgePixels.length;
  const bgR = Math.round(edgePixels.reduce((s, p) => s + p.r, 0) / edgePixels.length);
  const bgG = Math.round(edgePixels.reduce((s, p) => s + p.g, 0) / edgePixels.length);
  const bgB = Math.round(edgePixels.reduce((s, p) => s + p.b, 0) / edgePixels.length);

  const isDarkBg = avgBrightness < 80;
  const brightnessThreshold = isDarkBg ? avgBrightness + 40 : avgBrightness - 30;
  const colorThreshold = isDarkBg ? 100 : 80;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * channels;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2];

      const pixelBrightness = r * 0.299 + g * 0.587 + b * 0.114;
      const colorDist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

      let alpha: number;

      if (isDarkBg) {
        if (pixelBrightness < brightnessThreshold && colorDist < colorThreshold) {
          alpha = 0;
        } else if (pixelBrightness < brightnessThreshold + 20 && colorDist < colorThreshold * 0.7) {
          const t = Math.min(
            (pixelBrightness - (brightnessThreshold - 20)) / 40,
            (colorDist - colorThreshold * 0.3) / (colorThreshold * 0.7),
          );
          const smooth = Math.max(0, Math.min(1, t));
          alpha = Math.round((smooth * smooth * (3 - 2 * smooth)) * 255);
        } else {
          alpha = 255;
        }
      } else {
        if (colorDist < colorThreshold * 0.4) {
          alpha = 0;
        } else if (colorDist < colorThreshold) {
          const t = (colorDist - colorThreshold * 0.4) / (colorThreshold * 0.6);
          alpha = Math.round((t * t * (3 - 2 * t)) * 255);
        } else {
          alpha = 255;
        }
      }

      outputBuffer[dstIdx] = r;
      outputBuffer[dstIdx + 1] = g;
      outputBuffer[dstIdx + 2] = b;
      outputBuffer[dstIdx + 3] = alpha;
    }
  }

  const result = await sharp(outputBuffer, { raw: { width: w, height: h, channels: 4 } }).ensureAlpha().png().toBuffer();
  const cropped = await sharp(result).trim({ threshold: 10 }).png().toBuffer();
  return sharp(cropped).blur(1.5).png().toBuffer();
}

// ==========================================
// PASSO 4: Compor logo sobre produto
// ==========================================

async function compositeLogoOnImage(
  baseBuffer: Buffer,
  logoDataUrl: string,
  style: string,
): Promise<Buffer> {
  const logoBase64 = logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const logoBuffer = Buffer.from(logoBase64, 'base64');

  const cleanLogo = await removeLogoBackground(logoBuffer);

  const baseMeta = await sharp(baseBuffer).metadata();
  const baseW = baseMeta.width || 512;
  const baseH = baseMeta.height || 640;

  // Posição fixa por estilo
  let logoMaxW: number, logoMaxH: number, logoX: number, logoY: number;

  if (style === 'camiseta') {
    logoMaxW = Math.round(baseW * 0.35);
    logoMaxH = Math.round(baseH * 0.25);
    logoX = Math.round((baseW - logoMaxW) / 2);
    logoY = Math.round(baseH * 0.2);
  } else if (style === 'caneca') {
    logoMaxW = Math.round(baseW * 0.4);
    logoMaxH = Math.round(baseH * 0.4);
    logoX = Math.round((baseW - logoMaxW) / 2);
    logoY = Math.round(baseH * 0.25);
  } else {
    logoMaxW = Math.round(baseW * 0.5);
    logoMaxH = Math.round(baseH * 0.4);
    logoX = Math.round((baseW - logoMaxW) / 2);
    logoY = Math.round(baseH * 0.22);
  }

  const resizedLogo = await sharp(cleanLogo)
    .resize(logoMaxW, logoMaxH, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer();

  const logoMeta = await sharp(resizedLogo).metadata();
  const logoW = logoMeta.width || logoMaxW;
  const logoH = logoMeta.height || logoMaxH;

  const finalX = Math.round(logoX + (logoMaxW - logoW) / 2);
  const finalY = Math.round(logoY + (logoMaxH - logoH) / 2);

  return sharp(baseBuffer)
    .composite([{ input: resizedLogo, left: finalX, top: finalY, blend: 'over' }])
    .png()
    .toBuffer();
}

// ==========================================
// PASSO 5: Integrar logo via img2img (SDXL)
// ==========================================

async function integrateLogoViaImg2Img(
  hfToken: string,
  compositedBuffer: Buffer,
  colorName: string,
  style: string,
): Promise<Buffer | null> {
  const base64 = compositedBuffer.toString('base64');
  const prompt = buildLogoIntegrationPrompt(colorName, style);

  const negativePrompt =
    'sticker, decal, flat overlay, floating logo, pasted logo, cutout, ' +
    'paper cutout, photoshop, digital overlay, misaligned, blurry, ' +
    'low quality, distorted product shape, wrong colors, watermark, ' +
    'rectangular border, logo background, logo box, dark rectangle, ' +
    'logo frame, visible border around logo, logo not integrated';

  console.log(`[product-image] Integrating logo via img2img (strength=0.40, steps=35)...`);

  const result = await callHfApi(
    hfToken,
    'stabilityai/stable-diffusion-xl-refiner-1.0',
    {
      inputs: prompt,
      parameters: {
        image: `data:image/png;base64,${base64}`,
        strength: 0.40,
        guidance_scale: 8.0,
        num_inference_steps: 35,
        negative_prompt: negativePrompt,
      },
    },
  );

  if (!result.ok || !result.buffer) {
    console.log(`[product-image] Logo integration failed (${result.status}): ${result.error}`);
    return null;
  }

  return result.buffer;
}

// ==========================================
// API ROUTE
// ==========================================

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);

    const body = await request.json();
    const {
      color = '#2563eb',
      style = 'sacola',
      logoDataUrl,
      variables = [],
    } = body;

    const hasLogo = Boolean(logoDataUrl);
    console.log(`[product-image] Request: color=${color}, style=${style}, variables=[${variables.join(', ')}], logo=${hasLogo}`);

    const colorName = hexToColorName(color);
    const logoHash = hasLogo ? logoDataUrl.substring(logoDataUrl.length - 30) : undefined;
    const cacheKey = getCacheKey(color, style, variables, logoHash);

    // Verifica cache
    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[product-image] Cache hit`);
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Image-Source': 'cache' },
      });
    }

    const hfToken = process.env.HUGGINGFACE_API_TOKEN;
    if (!hfToken) {
      return NextResponse.json(
        { error: 'HUGGINGFACE_API_TOKEN não configurado.', fallback: true },
        { status: 503 },
      );
    }

    // =============================================
    // PASSO 1: Gerar base neutra (cached)
    // =============================================
    const neutralBase = await getOrCreateNeutralBase(hfToken, style, variables);
    if (!neutralBase) {
      return NextResponse.json({ error: 'Erro ao gerar imagem base do produto.' }, { status: 502 });
    }

    // =============================================
    // PASSO 2: Recolorir via img2img
    //    Mesma forma, cor diferente
    // =============================================
    let finalBuffer: Buffer;
    let imageSource: string;

    const recolored = await recolorViaImg2Img(hfToken, neutralBase, colorName, style);
    if (recolored) {
      finalBuffer = recolored;
      imageSource = 'recolor';
    } else {
      // Fallback: usar base neutra diretamente
      finalBuffer = neutralBase;
      imageSource = 'neutral-base';
    }

    // =============================================
    // PASSO 3+4+5: Se tem logo, integrar
    // =============================================
    if (hasLogo && logoDataUrl) {
      try {
        console.log(`[product-image] Compositing logo...`);
        const composited = await compositeLogoOnImage(finalBuffer, logoDataUrl, style);

        console.log(`[product-image] Integrating logo via img2img...`);
        const integrated = await integrateLogoViaImg2Img(hfToken, composited, colorName, style);

        if (integrated) {
          finalBuffer = integrated;
          imageSource = 'ai-with-logo';
        } else {
          finalBuffer = composited;
          imageSource = 'composited';
        }
      } catch (err) {
        console.error(`[product-image] Logo integration error:`, err);
      }
    }

    console.log(`[product-image] Final: ${finalBuffer.length} bytes, source: ${imageSource}`);

    imageCache.set(cacheKey, { buffer: finalBuffer, timestamp: Date.now() });

    return new NextResponse(new Uint8Array(finalBuffer), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Image-Source': imageSource },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno na geração de imagem.';
    console.error(`[product-image] ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
