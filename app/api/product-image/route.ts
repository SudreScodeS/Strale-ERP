// app/api/product-image/route.ts
// Image generation pipeline — AI-FIRST logo integration
//
// STRATEGY:
// 1. Generate neutral product (AI)
// 2. Recolor via HSL
// 3. Composite logo LOCALLY with minimal effects (just position + blend)
// 4. AI refinement with HIGHER strength — the AI renders the logo naturally
//    onto the product surface with proper lighting, shadows, texture
//
// KEY INSIGHT: Don't try to make the logo look "printed" with sharp effects.
// Instead, give the AI a rough composite and let IT make it look printed.
// The AI understands surface physics, lighting, and material properties.

import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';
import sharp from 'sharp';
import { generateImage, refineImageWithAI } from '../../lib/huggingface-client';
import {
  compositeLogo,
  getPrintArea,
  getProductCompositorOptions,
  detectProductBounds,
} from '../../lib/logo-compositor';

// ==========================================
// Cache
// ==========================================

const imageCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const neutralBaseCache = new Map<string, Buffer>();
const CACHE_TTL_MS = 1000 * 60 * 60;

function getCacheKey(color: string, style: string, variables: string[], logoHash?: string): string {
  const parts = [color, style, ...variables];
  if (logoHash) parts.push(logoHash);
  return parts.join('|');
}

// ==========================================
// Prompt construction
// ==========================================

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

  const base = 'professional product photography, studio lighting, white seamless background, centered, commercial e-commerce photo, 4k, ultra sharp focus, Canon EOS R5, 100mm macro lens, high detail, realistic material texture, NO TEXT, NO LOGO, NO DESIGN, plain blank surface';

  const stylePrompts: Record<string, string> = {
    sacola: `a single ${sizeDesc} tote bag made of ${materialDesc}, rectangular shape, flat bottom, two sturdy rope handles attached at the top, clean front panel, solid medium gray color, visible fabric weave texture, natural fabric drape, ${base}`,
    camiseta: `a single ${sizeDesc} crew-neck t-shirt made of ${materialDesc}, short sleeves, displayed on invisible mannequin showing natural drape, solid medium gray color, visible knit texture, neat collar, ${base}`,
    caneca: `a single ${sizeDesc} ceramic coffee mug with C-shaped handle, cylindrical body, smooth glossy glaze finish, solid medium gray color, subtle highlight reflection on surface, ${base}`,
  };

  return stylePrompts[style] || stylePrompts.sacola;
}

// ==========================================
// Color utilities
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

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// ==========================================
// STEP 1: Generate neutral base
// ==========================================

async function getOrCreateNeutralBase(style: string, variables: string[]): Promise<Buffer | null> {
  const cacheKey = `neutral-${style}-${variables.join(',')}`;
  const cached = neutralBaseCache.get(cacheKey);
  if (cached) { console.log(`[product-image] Using cached neutral base for ${style}`); return cached; }

  const prompt = buildNeutralBasePrompt(style, variables);
  console.log(`[product-image] Generating neutral base for ${style}...`);

  const buffer = await generateImage(prompt, { width: 512, height: 640, steps: 6 });

  if (buffer) { neutralBaseCache.set(cacheKey, buffer); console.log(`[product-image] Neutral base cached: ${buffer.length} bytes`); }
  return buffer;
}

// ==========================================
// STEP 2: HSL Recolor
// ==========================================

async function recolorProduct(baseBuffer: Buffer, hexColor: string): Promise<Buffer> {
  const targetRgb = hexToRgb(hexColor);
  if (!targetRgb) return baseBuffer;

  const [targetH, targetS] = rgbToHsl(targetRgb.r, targetRgb.g, targetRgb.b);

  const { data: rawData, info } = await sharp(baseBuffer)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;
  const outputBuffer = Buffer.alloc(w * h * 4);
  const BG_THRESHOLD = 230;

  for (let i = 0; i < w * h; i++) {
    const idx = i * channels;
    const r = rawData[idx], g = rawData[idx + 1], b = rawData[idx + 2];

    if (r > BG_THRESHOLD && g > BG_THRESHOLD && b > BG_THRESHOLD) {
      const dstIdx = i * 4;
      outputBuffer[dstIdx] = 255; outputBuffer[dstIdx + 1] = 255;
      outputBuffer[dstIdx + 2] = 255; outputBuffer[dstIdx + 3] = 255;
      continue;
    }

    const [, , l] = rgbToHsl(r, g, b);
    const [newR, newG, newB] = hslToRgb(targetH, targetS, l);
    const dstIdx = i * 4;
    outputBuffer[dstIdx] = newR; outputBuffer[dstIdx + 1] = newG;
    outputBuffer[dstIdx + 2] = newB; outputBuffer[dstIdx + 3] = 255;
  }

  const result = await sharp(outputBuffer, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

  const blurred = await sharp(result).blur(0.5).png().toBuffer();
  const whiteBg = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();

  const maskBuffer = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * channels;
    maskBuffer[i] = (rawData[idx] > BG_THRESHOLD && rawData[idx + 1] > BG_THRESHOLD && rawData[idx + 2] > BG_THRESHOLD) ? 0 : 255;
  }

  const maskPng = await sharp(maskBuffer, { raw: { width: w, height: h, channels: 1 } })
    .blur(1.5).png().toBuffer();

  const masked = await sharp(blurred)
    .composite([{ input: await sharp(maskPng).ensureAlpha().png().toBuffer(), blend: 'dest-in' }])
    .png().toBuffer();

  return sharp(whiteBg).composite([{ input: masked, blend: 'over' }]).png().toBuffer();
}

// ==========================================
// STEP 3: Lightweight logo compositing
//   Just position + basic blend — the AI will do the rest
// ==========================================

async function compositeLogoLight(
  productBuffer: Buffer,
  logoBuffer: Buffer,
  printArea: { x: number; y: number; width: number; height: number },
): Promise<Buffer> {
  // Remove logo background
  const { compositeLogo } = await import('../../lib/logo-compositor');

  // Use minimal compositor options — no shadow, no texture, no edge effects
  // Just position the logo with basic multiply blend
  const lightOpts = {
    blendMode: 'multiply' as const,
    opacity: 0.85,
    featherRadius: 1.0,      // Minimal feather
    fabricTexture: false,     // No texture
    textureIntensity: 0,
    shadowBlur: 0,           // No shadow — AI will add
    shadowOpacity: 0,
    shadowAngle: 135,
    shadowDistance: 0,
    bgThreshold: 200,        // Aggressive bg removal
    curvature: 0,
    matchLighting: false,    // No lighting — AI will add
    lightingIntensity: 0,
    printIntegration: false, // No edge effects — AI will add
    printEdgeDarken: 0,
    printHighlight: 0,
  };

  return compositeLogo(productBuffer, logoBuffer, printArea, lightOpts);
}

// ==========================================
// STEP 4: AI refinement — the magic step
//   The AI renders the logo naturally on the product
// ==========================================

async function refineWithAI(
  imageBuffer: Buffer,
  style: string,
  hasLogo: boolean,
): Promise<Buffer> {
  // When logo is present, use a prompt that tells the AI to render it as printed
  const prompts: Record<string, { withLogo: string; noLogo: string }> = {
    sacola: {
      withLogo: 'professional product photography of a tote bag with a logo printed on the front surface, the logo looks screen-printed with natural ink absorption into fabric, realistic fabric texture visible through the print, natural studio lighting casting soft shadows, white seamless background, commercial e-commerce photo, sharp focus, 4k quality',
      noLogo: 'professional product photography of a plain tote bag, studio lighting, white background, commercial e-commerce photo, sharp focus, realistic fabric texture',
    },
    camiseta: {
      withLogo: 'professional product photography of a t-shirt with a logo printed on the chest, the logo looks screen-printed with natural ink absorption into cotton, realistic knit texture visible through the print, natural studio lighting, white seamless background, commercial e-commerce photo, sharp focus',
      noLogo: 'professional product photography of a plain t-shirt, studio lighting, white background, commercial e-commerce photo, sharp focus, realistic fabric texture',
    },
    caneca: {
      withLogo: 'professional product photography of a ceramic mug with a logo printed on the surface, the logo looks sublimation-printed with smooth integration into the glaze, realistic glossy surface with natural reflections, studio lighting, white background, commercial e-commerce photo, sharp focus',
      noLogo: 'professional product photography of a plain ceramic mug, studio lighting, white background, commercial e-commerce photo, sharp focus, glossy glaze finish',
    },
  };

  const stylePrompts = prompts[style] || prompts.sacola;
  const prompt = hasLogo ? stylePrompts.withLogo : stylePrompts.noLogo;

  // Higher strength when logo is present — AI needs to re-render the logo area
  // to make it look naturally printed (not just refine the product)
  const strength = hasLogo ? 0.40 : 0.25;

  console.log(`[product-image] AI refinement: strength=${strength}, hasLogo=${hasLogo}`);

  return refineImageWithAI(imageBuffer, prompt, {
    strength,
    steps: 6,    // More steps for better quality
    width: 512,
    height: 640,
  });
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
    console.log(`[product-image] color=${color}, style=${style}, vars=[${variables.join(', ')}], logo=${hasLogo}`);

    const logoHash = hasLogo ? logoDataUrl.substring(logoDataUrl.length - 30) : undefined;
    const cacheKey = getCacheKey(color, style, variables, logoHash);

    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[product-image] Cache hit`);
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Image-Source': 'cache' },
      });
    }

    // =============================================
    // STEP 1: Get or generate neutral base
    // =============================================
    const neutralBase = await getOrCreateNeutralBase(style, variables);
    if (!neutralBase) {
      console.log('[product-image] AI unavailable, creating local fallback');
      const fallbackBase = await createLocalFallbackBase(style);
      if (!fallbackBase) return NextResponse.json({ error: 'Erro ao gerar imagem base.' }, { status: 502 });
      const recolored = await recolorProduct(fallbackBase, color);
      imageCache.set(cacheKey, { buffer: recolored, timestamp: Date.now() });
      return new NextResponse(new Uint8Array(recolored), {
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Image-Source': 'fallback-local' },
      });
    }

    // =============================================
    // STEP 2: Recolor via HSL
    // =============================================
    console.log(`[product-image] Recoloring to ${color}...`);
    let finalBuffer = await recolorProduct(neutralBase, color);
    let imageSource = 'recolor-hsl';

    // =============================================
    // STEP 3: Lightweight logo compositing (if logo present)
    //   Just position + basic blend — minimal effects
    // =============================================
    if (hasLogo && logoDataUrl) {
      try {
        console.log(`[product-image] Compositing logo (lightweight)...`);
        const logoBase64 = logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const logoBuffer = Buffer.from(logoBase64, 'base64');

        const baseMeta = await sharp(finalBuffer).metadata();
        const baseW = baseMeta.width || 512;
        const baseH = baseMeta.height || 640;

        // Detect product bounds for positioning
        const productBounds = await detectProductBounds(finalBuffer);
        const printArea = getPrintArea(baseW, baseH, style as any, productBounds);

        finalBuffer = await compositeLogoLight(finalBuffer, logoBuffer, printArea);
        imageSource = 'logo-composited';
        console.log(`[product-image] Logo composited (lightweight)`);
      } catch (err) {
        console.error(`[product-image] Logo composition error:`, err);
      }
    }

    // =============================================
    // STEP 4: AI refinement — renders logo naturally
    //   This is where the magic happens.
    //   The AI re-renders the logo area to look printed on the product.
    // =============================================
    const enableRefinement = process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_TOKEN;
    if (enableRefinement) {
      try {
        const refined = await refineWithAI(finalBuffer, style, hasLogo);
        if (refined && refined.length > 100) {
          finalBuffer = refined;
          imageSource = hasLogo ? 'ai-refined-with-logo' : 'ai-refined';
          console.log(`[product-image] AI refinement complete`);
        }
      } catch (err) {
        console.error(`[product-image] AI refinement failed:`, err);
      }
    }

    // =============================================
    // Convert to WebP
    // =============================================
    const webpBuffer = await sharp(finalBuffer).webp({ quality: 90 }).toBuffer();
    console.log(`[product-image] Final: ${webpBuffer.length} bytes, source: ${imageSource}`);

    imageCache.set(cacheKey, { buffer: webpBuffer, timestamp: Date.now() });

    return new NextResponse(new Uint8Array(webpBuffer), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Image-Source': imageSource },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno na geração de imagem.';
    console.error(`[product-image] ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==========================================
// Local fallback
// ==========================================

async function createLocalFallbackBase(style: string): Promise<Buffer | null> {
  const sizes: Record<string, { w: number; h: number }> = {
    sacola: { w: 512, h: 640 },
    camiseta: { w: 512, h: 640 },
    caneca: { w: 512, h: 512 },
  };
  const { w, h } = sizes[style] || sizes.sacola;

  const svgShapes: Record<string, string> = {
    sacola: `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="white"/><g transform="translate(${w*0.15},${h*0.15})"><rect x="0" y="0" width="${w*0.7}" height="${h*0.65}" rx="4" fill="#b0b0b0" stroke="#999" stroke-width="1"/><path d="M${w*0.25},${h*0.15} Q${w*0.25},${h*0.02} ${w*0.35},${h*0.02}" fill="none" stroke="#888" stroke-width="3" stroke-linecap="round"/><path d="M${w*0.45},${h*0.15} Q${w*0.45},${h*0.02} ${w*0.35},${h*0.02}" fill="none" stroke="#888" stroke-width="3" stroke-linecap="round"/></g></svg>`,
    camiseta: `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="white"/><g transform="translate(${w*0.2},${h*0.1})"><path d="M${w*0.15},0 L0,${h*0.15} L${w*0.1},${h*0.2} L${w*0.15},${h*0.15} L${w*0.15},${h*0.75} L${w*0.45},${h*0.75} L${w*0.45},${h*0.15} L${w*0.5},${h*0.2} L${w*0.6},${h*0.15} L${w*0.45},0 Z" fill="#b0b0b0" stroke="#999" stroke-width="1"/><ellipse cx="${w*0.3}" cy="0" rx="${w*0.08}" ry="${h*0.03}" fill="white" stroke="#999" stroke-width="1"/></g></svg>`,
    caneca: `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="white"/><g transform="translate(${w*0.15},${h*0.1})"><rect x="0" y="0" width="${w*0.5}" height="${h*0.75}" rx="4" fill="#b0b0b0" stroke="#999" stroke-width="1"/><ellipse cx="${w*0.6}" cy="${h*0.3}" rx="${w*0.12}" ry="${h*0.15}" fill="none" stroke="#888" stroke-width="4"/></g></svg>`,
  };

  const svg = svgShapes[style] || svgShapes.sacola;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
