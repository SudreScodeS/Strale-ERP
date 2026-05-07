// app/api/product-image/route.ts
// Image generation pipeline — AI-FIRST logo integration
//
// STRATEGY:
// 1. Generate neutral product (AI) — plain gray, no logo
// 2. Recolor via LAB color space — product material ONLY
//    - Preserves luminance (shadows, highlights, texture)
//    - Changes only chrominance (a*, b*) → color applied to material
//    - Adaptive background detection with smooth feathering
// 3. Composite logo with minimal effects (position + multiply blend)
// 4. AI refinement — the AI renders the logo naturally
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
  removeBackgroundAdaptive,
  autoCropToContent,
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

// ==========================================
// STEP 1: Generate neutral base
// ==========================================

async function getOrCreateNeutralBase(style: string, variables: string[]): Promise<Buffer | null> {
  const cacheKey = `neutral-${style}-${variables.join(',')}`;
  const cached = neutralBaseCache.get(cacheKey);
  if (cached) { console.log(`[product-image] Using cached neutral base for ${style}`); return cached; }

  const prompt = buildNeutralBasePrompt(style, variables);
  console.log(`[product-image] Generating neutral base for ${style}...`);

  const buffer = await generateImage(prompt, { width: 512, height: 640, steps: 12 });

  if (buffer) { neutralBaseCache.set(cacheKey, buffer); console.log(`[product-image] Neutral base cached: ${buffer.length} bytes`); }
  return buffer;
}

// ==========================================
// STEP 2: LAB-based Intelligent Recolor
//   — Changes ONLY the product material, preserving
//     shadows, highlights, texture, and background
// ==========================================

/**
 * Convert RGB to CIELAB for perceptually accurate color manipulation.
 * LAB separates luminance (L) from chrominance (a, b), allowing us
 * to change hue/saturation while preserving the original lightness.
 */
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB → linear
  let rl = r / 255, gl = g / 255, bl = b / 255;
  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

  // linear RGB → XYZ (D65)
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.00000;
  let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
  x = f(x); y = f(y); z = f(z);

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const y = (L + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;

  const finv = (t: number) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };

  let xr = finv(x), yr = finv(y), zr = finv(z);
  xr *= 0.95047; yr *= 1.00000; zr *= 1.08883;

  let rl = xr * 3.2404542 + yr * -1.5371385 + zr * -0.4985314;
  let gl = xr * -0.9692660 + yr * 1.8760108 + zr * 0.0415560;
  let bl = xr * 0.0556434 + yr * -0.2040259 + zr * 1.0572252;

  const gamma = (v: number) => v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v;
  rl = gamma(rl); gl = gamma(gl); bl = gamma(bl);

  return [
    Math.max(0, Math.min(255, Math.round(rl * 255))),
    Math.max(0, Math.min(255, Math.round(gl * 255))),
    Math.max(0, Math.min(255, Math.round(bl * 255))),
  ];
}

async function recolorProduct(baseBuffer: Buffer, hexColor: string): Promise<Buffer> {
  const targetRgb = hexToRgb(hexColor);
  if (!targetRgb) return baseBuffer;

  // Get target color in LAB — we only use its a* and b* (chrominance)
  const [, targetA, targetB] = rgbToLab(targetRgb.r, targetRgb.g, targetRgb.b);

  const { data: rawData, info } = await sharp(baseBuffer)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;

  // ───────────────────────────────────────
  // STEP A: Adaptive background detection
  //   Sample corners to find the actual background color,
  //   then build a product mask with smooth feathering.
  // ───────────────────────────────────────
  const cornerDepth = Math.max(3, Math.floor(Math.min(w, h) * 0.05));
  let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const isCorner = (y < cornerDepth || y >= h - cornerDepth) &&
                       (x < cornerDepth || x >= w - cornerDepth);
      if (!isCorner) continue;
      const idx = (y * w + x) * channels;
      bgR += rawData[idx]; bgG += rawData[idx + 1]; bgB += rawData[idx + 2];
      bgCount++;
    }
  }
  bgR = Math.round(bgR / bgCount);
  bgG = Math.round(bgG / bgCount);
  bgB = Math.round(bgB / bgCount);

  // Build product mask: 0 = background, 255 = product
  // Use LAB ΔE for perceptual accuracy (not just RGB distance)
  const bgLab = rgbToLab(bgR, bgG, bgB);
  const mask = Buffer.alloc(w * h);
  const BG_DELTA_E = 25;    // Below this = definitely background
  const FG_DELTA_E = 50;    // Above this = definitely product
  // Smooth feathering between BG_DELTA_E and FG_DELTA_E

  for (let i = 0; i < w * h; i++) {
    const idx = i * channels;
    const r = rawData[idx], g = rawData[idx + 1], b = rawData[idx + 2];
    const pixelLab = rgbToLab(r, g, b);

    // CIE76 ΔE
    const dE = Math.sqrt(
      (pixelLab[0] - bgLab[0]) ** 2 +
      (pixelLab[1] - bgLab[1]) ** 2 +
      (pixelLab[2] - bgLab[2]) ** 2,
    );

    if (dE <= BG_DELTA_E) {
      mask[i] = 0;
    } else if (dE >= FG_DELTA_E) {
      mask[i] = 255;
    } else {
      // Smoothstep for feathered edges
      const t = (dE - BG_DELTA_E) / (FG_DELTA_E - BG_DELTA_E);
      mask[i] = Math.round((t * t * (3 - 2 * t)) * 255);
    }
  }

  // ───────────────────────────────────────
  // STEP B: LAB-based recolor — product only
  //   Preserve original L (luminance) → shadows/highlights/texture intact
  //   Replace only a* and b* (chrominance) → color changes
  // ───────────────────────────────────────
  const outputBuffer = Buffer.alloc(w * h * 4);

  for (let i = 0; i < w * h; i++) {
    const srcIdx = i * channels;
    const dstIdx = i * 4;
    const r = rawData[srcIdx], g = rawData[srcIdx + 1], b = rawData[srcIdx + 2];
    const productAlpha = mask[i]; // 0-255 how much this pixel is "product"

    if (productAlpha < 2) {
      // Pure background — keep white
      outputBuffer[dstIdx] = 255;
      outputBuffer[dstIdx + 1] = 255;
      outputBuffer[dstIdx + 2] = 255;
      outputBuffer[dstIdx + 3] = 255;
      continue;
    }

    // Get original pixel's luminance AND chrominance in LAB
    const [origL, origA, origB] = rgbToLab(r, g, b);

    // Blend target chrominance with ORIGINAL pixel's chrominance (not zero/gray!)
    // This preserves the natural color transition at edges instead of desaturating
    const blendFactor = productAlpha / 255;
    const blendedA = origA + (targetA - origA) * blendFactor;
    const blendedB = origB + (targetB - origB) * blendFactor;

    // Recompose: same L (preserves shadows/highlights), blended chrominance
    const [newR, newG, newB] = labToRgb(origL, blendedA, blendedB);

    outputBuffer[dstIdx] = newR;
    outputBuffer[dstIdx + 1] = newG;
    outputBuffer[dstIdx + 2] = newB;
    outputBuffer[dstIdx + 3] = 255;
  }

  // ───────────────────────────────────────
  // STEP C: Compose onto white background
  // ───────────────────────────────────────
  const recoloredPng = await sharp(outputBuffer, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

  const blurred = await sharp(recoloredPng).blur(0.3).png().toBuffer();
  const whiteBg = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();

  const maskPng = await sharp(mask, { raw: { width: w, height: h, channels: 1 } })
    .blur(1.0).ensureAlpha().png().toBuffer();

  const masked = await sharp(blurred)
    .composite([{ input: maskPng, blend: 'dest-in' }])
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
  // Use full logo pipeline for proper background removal + auto-crop
  let cleanLogo = await removeBackgroundAdaptive(logoBuffer, 220);
  cleanLogo = await autoCropToContent(cleanLogo);

  // Balanced compositor — enough effects for realism,
  // but not so much that it looks over-processed before AI refinement.
  // The AI refinement step (strength 0.65) will re-render the logo area,
  // so we need a solid base composite for the AI to work with.
  const balancedOpts = {
    blendMode: 'multiply' as const,
    opacity: 0.92,
    featherRadius: 2.0,
    fabricTexture: true,      // Fabric texture bleed-through
    textureIntensity: 0.05,
    shadowBlur: 4,
    shadowOpacity: 0.12,
    shadowAngle: 135,
    shadowDistance: 2,
    bgThreshold: 220,
    curvature: 0,
    matchLighting: true,      // Match product surface lighting
    lightingIntensity: 0.10,
    printIntegration: true,   // Edge darkening + highlight sheen
    printEdgeDarken: 0.06,
    printHighlight: 0.03,
  };

  return compositeLogo(productBuffer, cleanLogo, printArea, balancedOpts);
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
  // When logo is present, the prompt MUST:
  // 1. Describe the logo as ALREADY printed on the product (preserve it!)
  // 2. Focus on improving realism/quality of the WHOLE image
  // 3. NOT describe adding a new logo — the composited one must survive
  //
  // CRITICAL: strength 0.35-0.42 is the sweet spot for img2img with logo.
  // Too high (0.60+) → AI re-renders everything, logo disappears.
  // Too low (0.20) → no quality improvement, still looks like a sticker.
  const prompts: Record<string, { withLogo: string; noLogo: string }> = {
    sacola: {
      withLogo: 'high-end product photography of a cotton tote bag, the existing graphic design is screen-printed onto the fabric with matte ink, the ink absorbs into the cotton fibers giving a soft hand-feel, the print follows the fabric drape naturally, visible fabric weave texture through the print area, professional studio lighting with soft shadows, seamless white background, ultra sharp focus, 4k detail, commercial catalog quality, realistic textile product',
      noLogo: 'high-end product photography of a plain blank cotton tote bag, professional studio lighting, seamless white background, realistic fabric texture and drape, ultra sharp focus, 4k detail, commercial catalog quality',
    },
    camiseta: {
      withLogo: 'high-end product photography of a cotton t-shirt, the existing graphic design is screen-printed on the chest with water-based ink, the print has soft edges where ink meets fabric fibers, visible jersey knit texture through the print, the print follows the natural shirt drape, professional studio lighting with soft shadows, seamless white background, ultra sharp focus, 4k detail, commercial catalog quality',
      noLogo: 'high-end product photography of a plain blank cotton t-shirt, professional studio lighting, seamless white background, realistic jersey texture, natural drape, ultra sharp focus, 4k detail, commercial catalog quality',
    },
    caneca: {
      withLogo: 'high-end product photography of a ceramic mug, the existing graphic design is sublimation-printed fused into the glossy glaze, smooth integration with the ceramic surface, natural reflections following the cylindrical curve, professional studio lighting, seamless white background, ultra sharp focus, 4k detail, commercial catalog quality',
      noLogo: 'high-end product photography of a plain blank ceramic mug, professional studio lighting, seamless white background, glossy glaze, natural reflections, ultra sharp focus, 4k detail, commercial catalog quality',
    },
  };

  const stylePrompts = prompts[style] || prompts.sacola;
  const prompt = hasLogo ? stylePrompts.withLogo : stylePrompts.noLogo;

  // NEGATIVE PROMPT — explicitly tell the AI what NOT to do
  // This prevents the logo from being removed or replaced
  const negativePrompt = hasLogo
    ? 'sticker, decal, rectangular border, white box around logo, floating logo, logo removed, blank product, no design, distorted logo, blurry, low quality, watermark, text overlay'
    : 'logo, text, design, watermark, blurry, low quality';

  // Strength sweet spot for img2img WITH logo:
  // 0.35-0.42 — preserves composited logo while improving quality
  // At 0.38 the AI improves ~38% of pixels → enough for realism,
  // but the composited logo structure survives intact.
  const strength = hasLogo ? 0.38 : 0.25;

  // More steps = better quality
  const steps = hasLogo ? 20 : 8;

  console.log(`[product-image] AI refinement: strength=${strength}, steps=${steps}, hasLogo=${hasLogo}`);

  return refineImageWithAI(imageBuffer, prompt, {
    strength,
    steps,
    width: 512,
    height: 640,
    negativePrompt,
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
    let neutralBase = await getOrCreateNeutralBase(style, variables);
    let usedFallback = false;
    if (!neutralBase) {
      console.log('[product-image] AI unavailable, creating local fallback');
      neutralBase = await createLocalFallbackBase(style);
      if (!neutralBase) return NextResponse.json({ error: 'Erro ao gerar imagem base.' }, { status: 502 });
      usedFallback = true;
    }

    // =============================================
    // STEP 2: Recolor via LAB
    // =============================================
    console.log(`[product-image] Recoloring to ${color}...`);
    let finalBuffer = await recolorProduct(neutralBase, color);
    let imageSource = usedFallback ? 'fallback-local' : 'recolor-lab';

    // =============================================
    // STEP 3: Logo compositing (if logo present)
    //   Works regardless of whether AI API is available.
    //   The logo is composited onto the recolored product.
    // =============================================
    if (hasLogo && logoDataUrl) {
      try {
        console.log(`[product-image] Compositing logo...`);
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
        console.log(`[product-image] Logo composited`);
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
