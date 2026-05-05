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
    `A custom logo is screen-printed directly on the front surface of the product. ` +
    `The logo ink has been absorbed into the material fibers, creating a seamless, ` +
    `natural integration. The logo follows the natural surface texture, folds, and lighting ` +
    `of the product material. The printed area has a soft matte appearance with slightly ` +
    `fuzzy edges where the ink meets the material. ` +
    `There is NO visible border, NO rectangular frame, NO background behind the logo. ` +
    `The logo looks like it was printed during manufacturing, not applied afterward. ` +
    `Ultra-realistic, indistinguishable from a real product photo. 8k, sharp focus, ` +
    `commercial e-commerce photography, Canon EOS R5, 100mm macro lens.`;

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
 * Remove o fundo da logo de forma robusta.
 * Lida com fundos gradiente (ex: #101828 → #3B4B5C), retangulares, claros e escuros.
 *
 * Estratégia:
 * 1. Amostra TODOS os pixels das bordas (não apenas 8 pontos)
 * 2. Detecta se o fundo é claro ou escuro pela luminância média
 * 3. Para fundos escuros: usa luminância + distância de cor
 * 4. Para fundos claros: usa distância de cor tradicional
 * 5. Aplica feathering suave nas bordas de transição
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

  // =============================================
  // 1. Amostrar TODOS os pixels das bordas
  //    (muito mais robusto que 8 pontos)
  // =============================================
  const edgePixels: { r: number; g: number; b: number }[] = [];
  const borderWidth = Math.max(3, Math.floor(Math.min(w, h) * 0.05)); // 5% da menor dimensão

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Só pixels das bordas (top, bottom, left, right)
      const isTop = y < borderWidth;
      const isBottom = y >= h - borderWidth;
      const isLeft = x < borderWidth;
      const isRight = x >= w - borderWidth;

      if (isTop || isBottom || isLeft || isRight) {
        const idx = (y * w + x) * channels;
        edgePixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
      }
    }
  }

  // =============================================
  // 2. Analisar luminância das bordas
  //    Detectar se fundo é escuro (gradiente) ou claro
  // =============================================
  const edgeBrightnesses = edgePixels.map(p => p.r * 0.299 + p.g * 0.587 + p.b * 0.114);
  const avgBrightness = edgeBrightnesses.reduce((s, b) => s + b, 0) / edgeBrightnesses.length;

  // Calcular variância para saber se o fundo é uniforme
  const brightnessVariance = edgeBrightnesses.reduce((s, b) => s + (b - avgBrightness) ** 2, 0) / edgeBrightnesses.length;
  const brightnessStdDev = Math.sqrt(brightnessVariance);

  console.log(`[removeLogoBackground] Edge analysis: avgBrightness=${avgBrightness.toFixed(1)}, stdDev=${brightnessStdDev.toFixed(1)}, pixels=${edgePixels.length}`);

  // Determinar threshold baseado na luminância do fundo
  let brightnessThreshold: number;
  let colorThreshold: number;

  if (avgBrightness < 80) {
    // Fundo ESCURO (gradiente dark como #101828 → #3B4B5C)
    // Usar luminância como principal critério
    brightnessThreshold = avgBrightness + 40; // Tudo mais escuro que isso é fundo
    colorThreshold = 100; // Distância de cor ampla para gradientes
  } else if (avgBrightness < 160) {
    // Fundo CINZA/MÉDIO
    brightnessThreshold = avgBrightness;
    colorThreshold = 70;
  } else {
    // Fundo CLARO (branco, off-white)
    brightnessThreshold = avgBrightness - 30;
    colorThreshold = 80;
  }

  // =============================================
  // 3. Detectar a cor predominante das bordas
  //    (para gradientes, usar a média)
  // =============================================
  const bgR = Math.round(edgePixels.reduce((s, p) => s + p.r, 0) / edgePixels.length);
  const bgG = Math.round(edgePixels.reduce((s, p) => s + p.g, 0) / edgePixels.length);
  const bgB = Math.round(edgePixels.reduce((s, p) => s + p.b, 0) / edgePixels.length);

  console.log(`[removeLogoBackground] Background: rgb(${bgR},${bgG},${bgB}) brightness=${avgBrightness.toFixed(0)} threshold=${brightnessThreshold.toFixed(0)}`);

  // =============================================
  // 4. Remover fundo pixel a pixel
  //    Combina luminância + distância de cor
  // =============================================
  const isDarkBg = avgBrightness < 80;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * channels;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2];

      const pixelBrightness = r * 0.299 + g * 0.587 + b * 0.114;
      const colorDist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

      let isBackground: boolean;
      let alpha: number;

      if (isDarkBg) {
        // Fundo escuro: usar luminância como critério principal
        // Pixels escuros E próximos da cor do fundo = fundo
        const brightnessMatch = pixelBrightness < brightnessThreshold;
        const colorMatch = colorDist < colorThreshold;

        if (brightnessMatch && colorMatch) {
          isBackground = true;
          alpha = 0;
        } else if (brightnessMatch || (pixelBrightness < brightnessThreshold + 20 && colorDist < colorThreshold * 0.7)) {
          // Zona de transição
          const t = Math.min(
            (pixelBrightness - (brightnessThreshold - 20)) / 40,
            (colorDist - colorThreshold * 0.3) / (colorThreshold * 0.7),
          );
          const smoothT = Math.max(0, Math.min(1, t));
          const smooth = smoothT * smoothT * (3 - 2 * smoothT);
          isBackground = false;
          alpha = Math.round(smooth * 255);
        } else {
          isBackground = false;
          alpha = 255;
        }
      } else {
        // Fundo claro: usar distância de cor tradicional
        if (colorDist < colorThreshold * 0.4) {
          isBackground = true;
          alpha = 0;
        } else if (colorDist < colorThreshold) {
          const t = (colorDist - colorThreshold * 0.4) / (colorThreshold * 0.6);
          const smooth = t * t * (3 - 2 * t);
          isBackground = false;
          alpha = Math.round(smooth * 255);
        } else {
          isBackground = false;
          alpha = 255;
        }
      }

      outputBuffer[dstIdx] = r;
      outputBuffer[dstIdx + 1] = g;
      outputBuffer[dstIdx + 2] = b;
      outputBuffer[dstIdx + 3] = alpha;
    }
  }

  // =============================================
  // 5. Crop para o conteúdo (remove bordas transparentes)
  //    e aplicar feathering suave
  // =============================================
  const result = await sharp(outputBuffer, { raw: { width: w, height: h, channels: 4 } })
    .ensureAlpha()
    .png()
    .toBuffer();

  // Auto-crop para conteúdo visível
  const cropped = await sharp(result)
    .trim({ threshold: 10 })
    .png()
    .toBuffer();

  // Feathering nas bordas (blur suave no alpha)
  const feathered = await sharp(cropped)
    .blur(1.5)
    .png()
    .toBuffer();

  return feathered;
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
    'rectangular border, logo background, logo box, dark rectangle, ' +
    'logo frame, logo container, visible border around logo, ' +
    'logo not integrated, logo pasted on surface';

  console.log(`[product-image] Integrating logo via img2img (strength=0.40, steps=35)...`);

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
          strength: 0.40, // Moderado: permite transformação realista da logo
          guidance_scale: 8.0,
          num_inference_steps: 35,
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
