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

/** Prompt para img2img com logo — descreve o produto COM a logo estampada */
function buildLogoPrompt(colorName: string, style: string): string {
  const stylePrompts: Record<string, string> = {
    sacola: `professional product photography of a ${colorName} tote bag with a custom logo printed on the front face, the logo is clearly visible and well-integrated into the fabric, printed design on textile, commercial product photo, studio lighting, white background, centered, 4k, sharp focus, realistic mockup`,
    camiseta: `professional product photography of a ${colorName} t-shirt with a custom logo printed on the chest area, the logo is clearly visible and well-integrated into the fabric, screen printed design, commercial product photo, studio lighting, white background, centered, 4k, sharp focus, realistic mockup`,
    caneca: `professional product photography of a ${colorName} ceramic mug with a custom logo printed on the side, the logo is clearly visible and well-integrated, sublimation print on ceramic, commercial product photo, studio lighting, white background, centered, 4k, sharp focus, realistic mockup`,
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
 * Compõe a logo sobre a imagem do produto usando sharp.
 * Posiciona a logo na área frontal do produto com blending adequado.
 */
async function compositeLogoOnImage(
  baseImageBuffer: Buffer,
  logoDataUrl: string,
  style: string,
): Promise<Buffer> {
  // Extrair base64 da data URL
  const logoBase64 = logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const logoBuffer = Buffer.from(logoBase64, 'base64');

  // Obter dimensões da imagem base
  const baseMeta = await sharp(baseImageBuffer).metadata();
  const baseW = baseMeta.width || 512;
  const baseH = baseMeta.height || 640;

  // Calcular área de impressão baseada no tipo de produto
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

  // Redimensionar logo para caber na área de impressão
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoMaxW, logoMaxH, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  // Obter metadados da logo redimensionada
  const logoMeta = await sharp(resizedLogo).metadata();
  const logoW = logoMeta.width || logoMaxW;
  const logoH = logoMeta.height || logoMaxH;

  // Centralizar logo na área de impressão
  const finalX = Math.round(logoX + (logoMaxW - logoW) / 2);
  const finalY = Math.round(logoY + (logoMaxH - logoH) / 2);

  // Compor logo sobre a imagem base
  // Usar blend: 'over' com some transparency para simular impressão
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
 * Usa strength baixo para preservar a forma do produto + logo,
 * mas alto o suficiente para suavizar a composição.
 */
async function integrateLogoViaImg2Img(
  hfToken: string,
  compositedBuffer: Buffer,
  colorName: string,
  style: string,
): Promise<Buffer | null> {
  const compositedBase64 = compositedBuffer.toString('base64');
  const prompt = buildLogoPrompt(colorName, style);

  console.log(`[product-image] Integrating logo via img2img...`);

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
          strength: 0.30, // Baixo — preserva a logo, apenas suaviza integração
          guidance_scale: 7.5,
          num_inference_steps: 25,
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
