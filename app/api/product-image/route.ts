// app/api/product-image/route.ts
// Gera imagem de produto usando IA — com logo integrada via img2img
// Fluxo: gera sacola base → compõe logo com sharp → img2img para integrar naturalmente

import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';
import sharp from 'sharp';

// Cache em memória (por cor+produto+logo) — sobrevive durante a vida do server
const imageCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

function getCacheKey(color: string, style: string, imageUrl?: string, logoHash?: string): string {
  const parts = [];
  if (imageUrl) {
    const imgHash = imageUrl.split('/').pop()?.substring(0, 20) || 'noimg';
    parts.push(`img2img-${imgHash}`);
  } else {
    parts.push('txt2img');
  }
  parts.push(color, style);
  if (logoHash) parts.push(`logo-${logoHash}`);
  return parts.join('-');
}

function buildPrompt(colorName: string, style: string): string {
  const stylePrompts: Record<string, string> = {
    sacola: `professional product photography of a single clean empty tote bag, flat woven fabric shopping bag, rectangular shape, sturdy handles, clean front face, no text no logos no writing, solid ${colorName} color, studio lighting, white background, centered, high quality, commercial product photo, 4k, sharp focus, professional lighting`,
    camiseta: `professional product photography of a single plain t-shirt, no text no logos no print, solid ${colorName} color, neatly folded, studio lighting, white background, centered, high quality, commercial product photo, 4k, sharp focus`,
    caneca: `professional product photography of a single plain ceramic mug, no text no logos no print, solid ${colorName} color, studio lighting, white background, centered, high quality, commercial product photo, 4k, sharp focus`,
  };
  return stylePrompts[style] || stylePrompts.sacola;
}

/**
 * Prompt para integração da logo via img2img.
 * Descreve o produto como se a logo já fosse parte do material —
 * como tinta absorvida pelo tecido/cerâmica, não como um sticker.
 */
function buildLogoPrompt(colorName: string, style: string): string {
  const logoIntegration = `The logo must look like it was printed directly into the fabric material. ` +
    `The ink absorbs into the textile fibers, creating a soft matte appearance. ` +
    `The logo follows the natural drape and folds of the fabric — where the material creases, ` +
    `the logo distorts slightly and naturally. ` +
    `In shadow areas the logo appears darker and more saturated. ` +
    `In highlight areas the logo fades slightly as light reflects off the fibers. ` +
    `The edges of the printed design are slightly fuzzy where ink bleeds into the weave. ` +
    `The logo is NOT a flat sticker, NOT a decal, NOT floating above the surface. ` +
    `It is screen-printed ink that has become part of the material itself.`;

  const stylePrompts: Record<string, string> = {
    sacola: `Professional studio product photograph of a ${colorName} woven fabric tote bag. ` +
      `A custom logo is screen-printed on the front panel of the bag. ` +
      `The tote bag is hanging naturally, showing the fabric's weight and slight drape. ` +
      `${logoIntegration} ` +
      `The bag has a clean rectangular shape with sturdy rope handles. ` +
      `Studio lighting from the upper left creates soft directional shadows. ` +
      `White seamless background. Centered composition. ` +
      `Ultra-realistic, indistinguishable from a real product photo. 8k resolution, sharp focus, ` +
      `commercial e-commerce photography, Canon EOS R5, 100mm macro lens.`,

    camiseta: `Professional studio product photograph of a ${colorName} cotton t-shirt. ` +
      `A custom logo is screen-printed on the chest area. ` +
      `The t-shirt is displayed on an invisible mannequin, showing the natural fabric drape. ` +
      `${logoIntegration} ` +
      `The cotton jersey has a visible fine knit texture. ` +
      `Studio lighting from the upper left creates soft shadows under the collar and sleeves. ` +
      `White seamless background. Centered composition. ` +
      `Ultra-realistic, indistinguishable from a real product photo. 8k resolution, sharp focus, ` +
      `commercial e-commerce photography, Canon EOS R5, 100mm macro lens.`,

    caneca: `Professional studio product photograph of a ${colorName} ceramic mug. ` +
      `A custom logo is sublimation-printed on the curved surface of the mug. ` +
      `The logo wraps naturally around the cylindrical shape, with subtle perspective distortion at the edges. ` +
      `The ceramic surface has a smooth glossy finish that creates a subtle highlight streak across the printed area. ` +
      `The printed ink bonds with the ceramic glaze, creating a permanent smooth finish — not raised, not textured. ` +
      `Studio lighting from the upper left creates a highlight on the rim and a soft shadow on the right side. ` +
      `White seamless background. Centered composition. ` +
      `Ultra-realistic, indistinguishable from a real product photo. 8k resolution, sharp focus, ` +
      `commercial e-commerce photography, Canon EOS R5, 100mm macro lens.`,
  };
  return stylePrompts[style] || stylePrompts.sacola;
}

function buildImg2ImgPrompt(colorName: string, style: string): string {
  const stylePrompts: Record<string, string> = {
    sacola: `a ${colorName} colored tote bag, same exact bag shape and material, ${colorName} solid color fabric, no text no logos, product photography, white background, studio lighting, 4k, high quality`,
    camiseta: `a ${colorName} colored t-shirt, same exact shirt shape and fabric, ${colorName} solid color, no text no logos, product photography, white background, studio lighting, 4k`,
    caneca: `a ${colorName} colored ceramic mug, same exact mug shape, ${colorName} solid color, no text no logos, product photography, white background, studio lighting, 4k`,
  };
  return stylePrompts[style] || stylePrompts.sacola;
}

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
 * Busca a imagem do produto e converte para base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error('[product-image] Error fetching product image:', err);
    return null;
  }
}

/**
 * Remove o fundo da logo (branco/preto) e aplica feathering nas bordas.
 * Retorna a logo com canal alpha limpo.
 *
 * Usa color distance em vez de threshold simples para melhor detecção
 * de fundos que não são branco/preto puro (ex: off-white, cinza claro).
 */
async function removeLogoBackground(logoBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(logoBuffer).metadata();
  const hasAlpha = meta.channels === 4;

  // Se já tem alpha (PNG com transparência), verificar se o fundo é transparente
  if (hasAlpha) {
    // Já tem alpha — apenas garantir que está em RGBA
    return sharp(logoBuffer)
      .ensureAlpha()
      .png()
      .toBuffer();
  }

  // Sem alpha — precisa remover fundo
  // Usar raw pixels para detecção mais precisa
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

  // Média ponderada do fundo
  const bgR = Math.round(bgSamples.reduce((s, c) => s + c.r, 0) / bgSamples.length);
  const bgG = Math.round(bgSamples.reduce((s, c) => s + c.g, 0) / bgSamples.length);
  const bgB = Math.round(bgSamples.reduce((s, c) => s + c.b, 0) / bgSamples.length);

  // Threshold adaptativo baseado no brilho do fundo
  const bgBrightness = bgR * 0.299 + bgG * 0.587 + bgB * 0.114;
  const baseThreshold = bgBrightness > 200 ? 80 : bgBrightness < 50 ? 70 : 60;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * channels;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2];

      const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

      if (dist < baseThreshold * 0.5) {
        // Fundo → transparente
        outputBuffer[dstIdx] = r;
        outputBuffer[dstIdx + 1] = g;
        outputBuffer[dstIdx + 2] = b;
        outputBuffer[dstIdx + 3] = 0;
      } else if (dist < baseThreshold) {
        // Zona de transição → feathering (smoothstep)
        const t = (dist - baseThreshold * 0.5) / (baseThreshold * 0.5);
        const smoothT = t * t * (3 - 2 * t); // smoothstep
        outputBuffer[dstIdx] = r;
        outputBuffer[dstIdx + 1] = g;
        outputBuffer[dstIdx + 2] = b;
        outputBuffer[dstIdx + 3] = Math.round(smoothT * 255);
      } else {
        // Logo → opaco
        outputBuffer[dstIdx] = r;
        outputBuffer[dstIdx + 1] = g;
        outputBuffer[dstIdx + 2] = b;
        outputBuffer[dstIdx + 3] = 255;
      }
    }
  }

  return sharp(outputBuffer, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Compõe a logo sobre a imagem do produto usando sharp.
 *
 * Estratégia de blending em camadas para criar um ponto de partida
 * melhor para o img2img de integração:
 *
 * 1. Camada multiply (sombra) — logo absorve a cor/textura do produto
 * 2. Camada over (cor) — mantém as cores vibrantes da logo
 * 3. Camada de textura — simula a aparência de tinta no tecido
 *
 * O resultado NÃO é o produto final — é o input para img2img
 * que vai integrar tudo de forma realista.
 */
async function compositeLogoOnImage(
  baseImageBuffer: Buffer,
  logoDataUrl: string,
  style: string,
): Promise<Buffer> {
  // Extrair base64 da data URL
  const logoBase64 = logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const logoBuffer = Buffer.from(logoBase64, 'base64');

  // 1. Remover fundo da logo
  const cleanLogo = await removeLogoBackground(logoBuffer);

  // 2. Obter dimensões da imagem base
  const baseMeta = await sharp(baseImageBuffer).metadata();
  const baseW = baseMeta.width || 512;
  const baseH = baseMeta.height || 640;

  // 3. Calcular área de impressão baseada no tipo de produto
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
    // sacola
    logoMaxW = Math.round(baseW * 0.5);
    logoMaxH = Math.round(baseH * 0.4);
    logoX = Math.round((baseW - logoMaxW) / 2);
    logoY = Math.round(baseH * 0.22);
  }

  // 4. Redimensionar logo para caber na área de impressão
  const resizedLogo = await sharp(cleanLogo)
    .resize(logoMaxW, logoMaxH, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  // 5. Obter metadados da logo redimensionada
  const logoMeta = await sharp(resizedLogo).metadata();
  const logoW = logoMeta.width || logoMaxW;
  const logoH = logoMeta.height || logoMaxH;

  // 6. Centralizar logo na área de impressão
  const finalX = Math.round(logoX + (logoMaxW - logoW) / 2);
  const finalY = Math.round(logoY + (logoMaxH - logoH) / 2);

  // 7. Criar camada multiply — logo absorve cor/textura do produto
  //    Isso faz a logo parecer "tingida" pelo material, não colada
  const multiplyLayer = await sharp(resizedLogo)
    .modulate({ brightness: 0.85, saturation: 0.9 })
    .png()
    .toBuffer();

  // 8. Primeira passada: multiply blend (integra cor da logo com cor do produto)
  const step1 = await sharp(baseImageBuffer)
    .composite([{
      input: multiplyLayer,
      left: finalX,
      top: finalY,
      blend: 'multiply',
    }])
    .png()
    .toBuffer();

  // 9. Segunda passada: over blend com opacidade reduzida
  //    Restaura a visibilidade da logo após o multiply
  //    Usa blend 'over' com a logo original a ~60% opacidade
  const logoWithReducedOpacity = await sharp(resizedLogo)
    .ensureAlpha()
    .png()
    .toBuffer();

  const step2 = await sharp(step1)
    .composite([{
      input: logoWithReducedOpacity,
      left: finalX,
      top: finalY,
      blend: 'over',
      // sharp não suporta opacity diretamente no composite,
      // mas o img2img vai cuidar da integração final
    }])
    .png()
    .toBuffer();

  return step2;
}

/**
 * Gera a imagem base do produto via FLUX
 */
async function generateBaseImage(
  hfToken: string,
  colorName: string,
  style: string,
  imageUrl?: string,
): Promise<{ buffer: Buffer; source: string } | null> {
  let response: Response | null = null;
  let imageSource = 'generated';

  // Se tem imageUrl, tenta img2img com a foto real como referência
  if (imageUrl) {
    console.log(`[product-image] Trying img2img with product photo...`);
    const imgBase64 = await fetchImageAsBase64(imageUrl);

    if (imgBase64) {
      const img2ImgPrompt = buildImg2ImgPrompt(colorName, style);
      console.log(`[product-image] img2img prompt: ${img2ImgPrompt.substring(0, 80)}...`);

      response = await fetch(
        'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-refiner-1.0',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: img2ImgPrompt,
            parameters: {
              image: imgBase64,
              strength: 0.35,
              guidance_scale: 7.5,
              num_inference_steps: 25,
            },
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        console.log(`[product-image] img2img failed (${response.status}): ${errText.substring(0, 200)}`);
        response = null;
      } else {
        imageSource = 'img2img';
      }
    } else {
      response = null;
    }
  }

  // Fallback: text-to-image com FLUX
  if (!response) {
    const prompt = buildPrompt(colorName, style);
    console.log(`[product-image] Text-to-image prompt: ${prompt.substring(0, 80)}...`);

    response = await fetch(
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
            num_inference_steps: 4,
          },
        }),
      },
    );
    imageSource = 'generated';
  }

  if (!response.ok) {
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), source: imageSource };
}

/**
 * Integra a logo na imagem do produto via img2img (passo final).
 *
 * Usa strength moderado-alto (0.42) para permitir que o modelo:
 * - Ajuste a textura da logo para parecer tinta no tecido/cerâmica
 * - Modifique iluminação e sombras sobre a logo
 * - Distorça levemente a logo seguindo dobras do produto
 * - Mantenha a composição geral (posição, cor, shape do produto)
 *
 * O negative prompt reforça o que NÃO queremos (sticker, overlay, flat).
 */
async function integrateLogoViaImg2Img(
  hfToken: string,
  compositedBuffer: Buffer,
  colorName: string,
  style: string,
): Promise<Buffer | null> {
  const compositedBase64 = compositedBuffer.toString('base64');
  const prompt = buildLogoPrompt(colorName, style);

  // Negative prompt para evitar os defeitos mais comuns
  const negativePrompt =
    'sticker, decal, flat overlay, floating logo, pasted logo, cutout, ' +
    'paper cutout, photoshop, digital overlay, misaligned, blurry, ' +
    'low quality, distorted product shape, wrong colors, watermark, ' +
    'text artifacts, extra logos, busy background, unrealistic lighting';

  console.log(`[product-image] Integrating logo via img2img (strength=0.42, steps=35)...`);

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
          strength: 0.42, // Moderado-alto: permite transformação realista sem perder composição
          guidance_scale: 9.0, // Alto: força o modelo a seguir o prompt detalhado
          num_inference_steps: 35, // Mais steps = melhor qualidade de integração
          negative_prompt: negativePrompt,
        },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.log(`[product-image] Logo integration img2img failed (${response.status}): ${errText.substring(0, 200)}`);
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);

    const body = await request.json();
    const { color = '#2563eb', style = 'sacola', imageUrl, logoDataUrl } = body;

    const hasLogo = Boolean(logoDataUrl);
    console.log(`[product-image] Request: color=${color}, style=${style}, imageUrl=${imageUrl ? 'yes' : 'no'}, logo=${hasLogo ? 'yes' : 'no'}`);

    // Hash simples da logo para cache
    const logoHash = hasLogo ? logoDataUrl.substring(logoDataUrl.length - 30) : undefined;
    const cacheKey = getCacheKey(color, style, imageUrl, logoHash);

    // Verifica cache
    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[product-image] Cache hit for ${cacheKey}`);
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=3600',
          'X-Image-Source': 'cache',
        },
      });
    }

    const hfToken = process.env.HUGGINGFACE_API_TOKEN;
    console.log(`[product-image] Token exists: ${Boolean(hfToken)}, length: ${hfToken?.length || 0}`);

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

    const colorName = hexToColorName(color);

    // =============================================
    // PASSO 1: Gerar imagem base do produto
    // =============================================
    const baseResult = await generateBaseImage(hfToken, colorName, style, imageUrl);

    if (!baseResult) {
      return NextResponse.json(
        { error: 'Erro ao gerar imagem base do produto.' },
        { status: 502 },
      );
    }

    let finalBuffer = baseResult.buffer;
    let imageSource = baseResult.source;

    // =============================================
    // PASSO 2: Se tem logo, integrar na imagem
    // =============================================
    if (hasLogo && logoDataUrl) {
      try {
        console.log(`[product-image] Compositing logo onto product...`);

        // 2a. Compor logo sobre a imagem base com sharp
        const composited = await compositeLogoOnImage(baseResult.buffer, logoDataUrl, style);
        console.log(`[product-image] Logo composited: ${composited.length} bytes`);

        // 2b. Rodar img2img para integrar a logo naturalmente
        const integrated = await integrateLogoViaImg2Img(
          hfToken,
          composited,
          colorName,
          style,
        );

        if (integrated) {
          finalBuffer = integrated;
          imageSource = 'ai-with-logo';
          console.log(`[product-image] Logo integrated via img2img: ${integrated.length} bytes`);
        } else {
          // Se img2img falhar, usar a composição direta (melhor que nada)
          finalBuffer = composited;
          imageSource = 'composited';
          console.log(`[product-image] Using direct composite (img2img integration failed)`);
        }
      } catch (err) {
        console.error(`[product-image] Logo integration error:`, err);
        // Fallback: retorna a imagem base sem logo
        imageSource = baseResult.source;
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
