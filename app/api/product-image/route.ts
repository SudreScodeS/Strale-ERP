// app/api/product-image/route.ts
// Gera imagem de produto usando IA — com logo integrada via img2img
// Fluxo: prompt detalhado → gera base → remove fundo da logo → compõe → img2img integra

import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';
import sharp from 'sharp';

// Cache em memória (por hash do prompt+logo)
const imageCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

function getCacheKey(prompt: string, logoHash?: string): string {
  // Hash simples do prompt + logo para cache
  let hash = 0;
  const str = prompt + (logoHash || '');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `img-${Math.abs(hash).toString(36)}`;
}

/**
 * Constrói prompt detalhado do produto com TODAS as variáveis visuais.
 * Descreve o produto de forma extremamente detalhada para a IA gerar
 * a imagem corretamente com cor, tamanho, material e estilo.
 */
function buildDetailedPrompt(
  colorName: string,
  style: string,
  variables: string[],
  hasLogo: boolean,
): string {
  // Extrair variáveis relevantes
  const sizeVar = variables.find(v =>
    ['pequeno', 'small', 'médio', 'medio', 'medium', 'grande', 'large', 'extra'].some(s => v.toLowerCase().includes(s))
  );
  const materialVar = variables.find(v =>
    ['nylon', 'tnt', 'algodão', 'algodao', 'cotton', 'tnt', 'ecobag', 'lona', 'canvas'].some(s => v.toLowerCase().includes(s))
  );
  const otherVars = variables.filter(v => v !== sizeVar && v !== materialVar);

  // Dimensões baseadas no tamanho
  let sizeDesc = 'medium-sized';
  if (sizeVar) {
    const lower = sizeVar.toLowerCase();
    if (lower.includes('pequeno') || lower.includes('small')) sizeDesc = 'small compact';
    else if (lower.includes('médio') || lower.includes('medio') || lower.includes('medium')) sizeDesc = 'medium-sized';
    else if (lower.includes('grande') || lower.includes('large')) sizeDesc = 'large roomy';
    else if (lower.includes('extra')) sizeDesc = 'extra-large oversized';
  }

  // Material
  let materialDesc = 'woven fabric';
  if (materialVar) {
    const lower = materialVar.toLowerCase();
    if (lower.includes('nylon')) materialDesc = 'nylon';
    else if (lower.includes('tnt')) materialDesc = 'non-woven TNT fabric';
    else if (lower.includes('algodão') || lower.includes('algodao') || lower.includes('cotton')) materialDesc = 'cotton canvas';
    else if (lower.includes('lona') || lower.includes('canvas')) materialDesc = 'sturdy canvas';
    else if (lower.includes('ecobag')) materialDesc = 'eco-friendly recycled fabric';
  }

  // Descrição de variáveis extras
  const extrasDesc = otherVars.length > 0
    ? ` with the following custom options: ${otherVars.join(', ')}`
    : '';

  // Descrição da logo
  const logoDesc = hasLogo
    ? ` A bag has a professional logo printed on the front panel. The logo is screen-printed directly into the fabric material with ink that absorbs into the textile fibers, creating a soft matte appearance. The logo follows the natural drape and folds of the fabric naturally.`
    : '';

  const stylePrompts: Record<string, string> = {
    sacola: `Professional studio product photograph of a single ${sizeDesc} tote bag made of ${materialDesc}. ` +
      `The bag is ${colorName} colored, solid uniform color throughout. ` +
      `It has a clean rectangular shape with a flat bottom and two sturdy handles attached at the top. ` +
      `The fabric has a visible natural weave texture with subtle fiber detail. ` +
      `The bag is hanging naturally showing the fabric's weight and slight drape.${logoDesc}${extrasDesc} ` +
      `Clean front face, no text, no writing unless specified. ` +
      `White seamless background. Centered composition. ` +
      `Studio lighting from the upper left creates soft directional shadows. ` +
      `Ultra-realistic commercial product photography, 8k resolution, sharp focus, ` +
      `Canon EOS R5, 100mm macro lens, indistinguishable from a real product photo.`,

    camiseta: `Professional studio product photograph of a single ${sizeDesc} t-shirt made of ${materialDesc}. ` +
      `The t-shirt is ${colorName} colored, solid uniform color throughout. ` +
      `It is displayed on an invisible mannequin showing the natural fabric drape. ` +
      `The fabric has a visible fine knit texture.${logoDesc}${extrasDesc} ` +
      `Clean chest area, no text, no print unless specified. ` +
      `White seamless background. Centered composition. ` +
      `Studio lighting from the upper left creates soft shadows under the collar and sleeves. ` +
      `Ultra-realistic commercial product photography, 8k resolution, sharp focus, ` +
      `Canon EOS R5, 100mm macro lens.`,

    caneca: `Professional studio product photograph of a single ${sizeDesc} ceramic mug made of smooth glossy ceramic. ` +
      `The mug is ${colorName} colored, solid uniform color throughout. ` +
      `It has a cylindrical body with a C-shaped handle. ` +
      `The ceramic surface has a smooth glossy glaze finish with subtle highlight reflections.${logoDesc}${extrasDesc} ` +
      `Clean surface, no text, no print unless specified. ` +
      `White seamless background. Centered composition. ` +
      `Studio lighting from the upper left creates a highlight on the rim and a soft shadow on the right. ` +
      `Ultra-realistic commercial product photography, 8k resolution, sharp focus, ` +
      `Canon EOS R5, 100mm macro lens.`,
  };

  return stylePrompts[style] || stylePrompts.sacola;
}

/**
 * Prompt para img2img de integração da logo.
 * Descreve o produto como se a logo já fosse parte do material.
 */
function buildIntegrationPrompt(colorName: string, style: string): string {
  const base = `Professional studio product photograph of a ${colorName} colored ${style}. ` +
    `A custom logo is printed directly on the front surface. ` +
    `The printed ink has absorbed into the material creating a seamless integration. ` +
    `The logo follows the natural surface texture and lighting of the product. ` +
    `Ultra-realistic, indistinguishable from a real product photo. 8k, sharp focus, commercial photography.`;

  return base;
}

/**
 * Converte hex para nome de cor em inglês
 */
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

/**
 * Remove o fundo da logo (branco/preto/retangular) e aplica feathering.
 * Detecta automaticamente a cor de fundo das bordas.
 */
async function removeLogoBackground(logoBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(logoBuffer).metadata();
  const hasAlpha = meta.channels === 4;

  // Se já tem alpha (PNG com transparência), verificar se o fundo é transparente
  if (hasAlpha) {
    return sharp(logoBuffer).ensureAlpha().png().toBuffer();
  }

  // Sem alpha — precisa remover fundo
  const { data, info } = await sharp(logoBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;
  const outputBuffer = Buffer.alloc(w * h * 4);

  // Detectar cor de fundo das bordas (média de 8 pontos)
  const bgSamples: { r: number; g: number; b: number }[] = [];
  const margin = Math.max(2, Math.floor(Math.min(w, h) * 0.02));
  const samplePositions = [
    [margin, margin], [w - 1 - margin, margin],
    [margin, h - 1 - margin], [w - 1 - margin, h - 1 - margin],
    [Math.floor(w / 2), margin], [Math.floor(w / 2), h - 1 - margin],
    [margin, Math.floor(h / 2)], [w - 1 - margin, Math.floor(h / 2)],
  ];

  for (const [sx, sy] of samplePositions) {
    const idx = (sy * w + sx) * channels;
    bgSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
  }

  const bgR = Math.round(bgSamples.reduce((s, c) => s + c.r, 0) / bgSamples.length);
  const bgG = Math.round(bgSamples.reduce((s, c) => s + c.g, 0) / bgSamples.length);
  const bgB = Math.round(bgSamples.reduce((s, c) => s + c.b, 0) / bgSamples.length);

  const bgBrightness = bgR * 0.299 + bgG * 0.587 + bgB * 0.114;
  const baseThreshold = bgBrightness > 200 ? 80 : bgBrightness < 50 ? 70 : 60;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * channels;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2];
      const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

      if (dist < baseThreshold * 0.5) {
        outputBuffer[dstIdx] = r;
        outputBuffer[dstIdx + 1] = g;
        outputBuffer[dstIdx + 2] = b;
        outputBuffer[dstIdx + 3] = 0; // Fundo → transparente
      } else if (dist < baseThreshold) {
        const t = (dist - baseThreshold * 0.5) / (baseThreshold * 0.5);
        const smoothT = t * t * (3 - 2 * t); // smoothstep
        outputBuffer[dstIdx] = r;
        outputBuffer[dstIdx + 1] = g;
        outputBuffer[dstIdx + 2] = b;
        outputBuffer[dstIdx + 3] = Math.round(smoothT * 255);
      } else {
        outputBuffer[dstIdx] = r;
        outputBuffer[dstIdx + 1] = g;
        outputBuffer[dstIdx + 2] = b;
        outputBuffer[dstIdx + 3] = 255; // Logo → opaco
      }
    }
  }

  return sharp(outputBuffer, { raw: { width: w, height: h, channels: 4 } })
    .blur(2) // Feathering nas bordas
    .png()
    .toBuffer();
}

/**
 * Compõe a logo sobre a imagem do produto usando sharp.
 * Usa multiply blend para que a logo "absorva" a textura do tecido.
 */
async function compositeLogoOnImage(
  baseImageBuffer: Buffer,
  logoDataUrl: string,
  style: string,
): Promise<Buffer> {
  const logoBase64 = logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const logoBuffer = Buffer.from(logoBase64, 'base64');

  // 1. Remover fundo da logo
  const cleanLogo = await removeLogoBackground(logoBuffer);

  // 2. Dimensões da imagem base
  const baseMeta = await sharp(baseImageBuffer).metadata();
  const baseW = baseMeta.width || 512;
  const baseH = baseMeta.height || 640;

  // 3. Área de impressão por tipo de produto
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

  // 4. Redimensionar logo
  const resizedLogo = await sharp(cleanLogo)
    .resize(logoMaxW, logoMaxH, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer();

  const logoMeta = await sharp(resizedLogo).metadata();
  const logoW = logoMeta.width || logoMaxW;
  const logoH = logoMeta.height || logoMaxH;

  // 5. Centralizar
  const finalX = Math.round(logoX + (logoMaxW - logoW) / 2);
  const finalY = Math.round(logoY + (logoMaxH - logoH) / 2);

  // 6. Compor: logo sobre produto (blend over — usa alpha channel)
  const composited = await sharp(baseImageBuffer)
    .composite([{
      input: resizedLogo,
      left: finalX,
      top: finalY,
      blend: 'over',
    }])
    .png()
    .toBuffer();

  return composited;
}

/**
 * Integra a logo via img2img — faz a logo parecer impressa no material.
 * Usa SDXL refiner com strength moderado para preservar o produto
 * enquanto transforma a logo em parte do material.
 */
async function integrateLogoViaImg2Img(
  hfToken: string,
  compositedBuffer: Buffer,
  colorName: string,
  style: string,
): Promise<Buffer | null> {
  const compositedBase64 = compositedBuffer.toString('base64');
  const prompt = buildIntegrationPrompt(colorName, style);

  const negativePrompt =
    'sticker, decal, flat overlay, floating logo, pasted logo, cutout, ' +
    'paper cutout, photoshop, digital overlay, misaligned, blurry, ' +
    'low quality, distorted product shape, wrong colors, watermark, ' +
    'text artifacts, extra logos, busy background, unrealistic lighting, ' +
    'rectangular border, logo background, logo box';

  console.log(`[product-image] Integrating logo via img2img (strength=0.35, steps=30)...`);

  const response = await fetch(
    'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-refiner-1.0',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          image: `data:image/png;base64,${compositedBase64}`,
          strength: 0.35, // Baixo: preserva o produto, só integra a logo
          guidance_scale: 7.5,
          num_inference_steps: 30,
          negative_prompt: negativePrompt,
        },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.log(`[product-image] img2img integration failed (${response.status}): ${errText.substring(0, 200)}`);
    return null;
  }

  const arrayBuf = await response.arrayBuffer();
  return Buffer.from(new Uint8Array(arrayBuf));
}

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);

    const body = await request.json();
    const {
      color = '#2563eb',
      style = 'sacola',
      imageUrl,
      logoDataUrl,
      variables = [],
    } = body;

    const hasLogo = Boolean(logoDataUrl);
    const hasVariables = variables.length > 0;
    console.log(`[product-image] Request: color=${color}, style=${style}, variables=[${variables.join(', ')}], logo=${hasLogo ? 'yes' : 'no'}`);

    const colorName = hexToColorName(color);

    // =============================================
    // PASSO 1: Construir prompt detalhado
    // =============================================
    const prompt = buildDetailedPrompt(colorName, style, variables, hasLogo);
    console.log(`[product-image] Prompt: ${prompt.substring(0, 150)}...`);

    // Hash para cache
    const logoHash = hasLogo ? logoDataUrl.substring(logoDataUrl.length - 30) : undefined;
    const cacheKey = getCacheKey(prompt, logoHash);

    // Verifica cache
    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[product-image] Cache hit`);
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=3600',
          'X-Image-Source': 'cache',
        },
      });
    }

    const hfToken = process.env.HUGGINGFACE_API_TOKEN;
    if (!hfToken) {
      return NextResponse.json(
        {
          error: 'HUGGINGFACE_API_TOKEN não configurado.',
          hint: 'Adicione HUGGINGFACE_API_TOKEN ao .env.local na raiz do projeto',
          fallback: true,
        },
        { status: 503 },
      );
    }

    // =============================================
    // PASSO 2: Gerar imagem base do produto
    // =============================================
    console.log(`[product-image] Generating base product image...`);

    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            width: 512,
            height: 640,
            num_inference_steps: 6,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 503) {
        return NextResponse.json(
          { error: 'Modelo carregando, tente novamente em alguns segundos.', retry: true },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: `Erro na API de imagem: ${response.status} — ${errText}` },
        { status: 502 },
      );
    }

    let finalBuffer = Buffer.from(new Uint8Array(await response.arrayBuffer()));
    let imageSource = 'generated';

    // =============================================
    // PASSO 3: Se tem logo, integrar na imagem
    // =============================================
    if (hasLogo && logoDataUrl) {
      try {
        console.log(`[product-image] Compositing logo onto product...`);

        // 3a. Compor logo sobre a imagem base com sharp (fundo removido)
        const composited = await compositeLogoOnImage(finalBuffer, logoDataUrl, style);
        console.log(`[product-image] Logo composited: ${composited.length} bytes`);

        // 3b. Integrar via img2img (faz a logo parecer impressa no material)
        const integrated = await integrateLogoViaImg2Img(
          hfToken,
          composited,
          colorName,
          style,
        );

        if (integrated) {
          finalBuffer = Buffer.from(integrated);
          imageSource = 'ai-with-logo';
          console.log(`[product-image] Logo integrated via img2img: ${integrated.length} bytes`);
        } else {
          // img2img falhou — usar composição direta (melhor que nada)
          finalBuffer = Buffer.from(composited);
          imageSource = 'composited';
          console.log(`[product-image] Using direct composite (img2img failed)`);
        }
      } catch (err) {
        console.error(`[product-image] Logo integration error:`, err);
        imageSource = 'generated';
      }
    }

    console.log(`[product-image] Final: ${finalBuffer.length} bytes, source: ${imageSource}`);

    // Salva no cache
    imageCache.set(cacheKey, { buffer: finalBuffer, timestamp: Date.now() });

    return new NextResponse(new Uint8Array(finalBuffer), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=3600',
        'X-Image-Source': imageSource,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno na geração de imagem.';
    console.error(`[product-image] ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==========================================
// Utilitários de cor
// ==========================================

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
