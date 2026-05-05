// app/api/product-image/route.ts
// Gera imagem de produto usando IA — com suporte a img2img (foto real como referência)
// Quando imageUrl é fornecida, usa img2img para gerar variação com cor diferente
// Sem imageUrl, gera do zero via text-to-image

import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';

// Cache em memória (por cor+produto) — sobrevive durante a vida do server
const imageCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

function getCacheKey(color: string, style: string, imageUrl?: string): string {
  // Se tem imageUrl, usa hash parcial dela + cor + estilo
  if (imageUrl) {
    const imgHash = imageUrl.split('/').pop()?.substring(0, 20) || 'noimg';
    return `img2img-${color}-${style}-${imgHash}`;
  }
  return `txt2img-${color}-${style}`;
}

function buildPrompt(colorName: string, style: string): string {
  const stylePrompts: Record<string, string> = {
    sacola: `professional product photography of a single clean empty tote bag, flat woven fabric shopping bag, rectangular shape, sturdy handles, clean front face, no text no logos no writing, solid ${colorName} color, studio lighting, white background, centered, high quality, commercial product photo, 4k, sharp focus, professional lighting`,
    camiseta: `professional product photography of a single plain t-shirt, no text no logos no print, solid ${colorName} color, neatly folded, studio lighting, white background, centered, high quality, commercial product photo, 4k, sharp focus`,
    caneca: `professional product photography of a single plain ceramic mug, no text no logos no print, solid ${colorName} color, studio lighting, white background, centered, high quality, commercial product photo, 4k, sharp focus`,
  };
  return stylePrompts[style] || stylePrompts.sacola;
}

function buildImg2ImgPrompt(colorName: string, style: string): string {
  // Prompt mais descritivo para img2img — foca em mudar cor mantendo o produto
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

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);

    const body = await request.json();
    const { color = '#2563eb', style = 'sacola', imageUrl } = body;

    console.log(`[product-image] Request: color=${color}, style=${style}, imageUrl=${imageUrl ? 'yes' : 'no'}`);

    const cacheKey = getCacheKey(color, style, imageUrl);

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
      console.log('[product-image] NO TOKEN — returning fallback=true');
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
    let response: Response | null = null;
    let imageSource = 'generated';

    // Se tem imageUrl, tenta img2img com a foto real como referência
    if (imageUrl) {
      console.log(`[product-image] Trying img2img with product photo...`);
      const imgBase64 = await fetchImageAsBase64(imageUrl);

      if (imgBase64) {
        const img2ImgPrompt = buildImg2ImgPrompt(colorName, style);
        console.log(`[product-image] img2img prompt: ${img2ImgPrompt.substring(0, 80)}...`);

        // Tenta img2img com stabilityai/stable-diffusion
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
                strength: 0.35, // Baixo — preserva a forma/textura do produto, muda só a cor
                guidance_scale: 7.5,
                num_inference_steps: 25,
              },
            }),
          },
        );

        console.log(`[product-image] img2img response: ${response.status} ${response.statusText}`);

        // Se img2img não funcionou (modelo não suporta ou erro), cai para text-to-image
        if (!response.ok) {
          const errText = await response.text();
          console.log(`[product-image] img2img failed (${response.status}): ${errText.substring(0, 200)}`);
          console.log(`[product-image] Falling back to text-to-image...`);
          response = null; // Marca para usar text-to-image
        } else {
          imageSource = 'img2img';
        }
      } else {
        console.log(`[product-image] Failed to fetch product image, using text-to-image`);
        response = null;
      }
    }

    // Fallback: text-to-image com FLUX
    if (!response || !imageUrl) {
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

    console.log(`[product-image] Final response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errText = await response.text();
      console.log(`[product-image] Error: ${errText}`);

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

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[product-image] Image generated: ${buffer.length} bytes, source: ${imageSource}`);

    // Salva no cache
    imageCache.set(cacheKey, { buffer, timestamp: Date.now() });

    return new NextResponse(buffer, {
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
