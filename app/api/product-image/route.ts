// app/api/product-image/route.ts
// Image generation pipeline — AI-FIRST logo integration
//
// STRATEGY:
// 1. Generate neutral product (AI via Krea/Flux) — plain gray, no logo
// 2. Recolor via LAB color space — product material ONLY
//    - Preserves luminance (shadows, highlights, texture)
//    - Changes only chrominance (a*, b*) → color applied to material
//    - Adaptive background detection with smooth feathering
// 3. Composite logo with minimal effects (position + multiply blend)
// 4. AI refinement (Krea/Flux Kontext) — the AI renders the logo naturally
//    onto the product surface with proper lighting, shadows, texture
//
// KEY INSIGHT: Don't try to make the logo look "printed" with sharp effects.
// Instead, give the AI a rough composite and let IT make it look printed.
// The AI understands surface physics, lighting, and material properties.
//
// Migrated from Hugging Face to Krea AI (async job-based API).

import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';
import sharp from 'sharp';
import { generateImage, refineImageWithAI } from '../../lib/krea-client';
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

  // PROMPT MESTRE compositing: prepare a realistic base for AI refinement.
  // The goal is NOT to make it look perfect — the AI will do that.
  // The goal is to give the AI a ROUGH but correctly positioned composite
  // so it can re-render with proper perspective, texture, and lighting.
  const balancedOpts = {
    blendMode: 'multiply' as const,
    opacity: 0.75,              // Lower opacity — AI will reinforce
    featherRadius: 3.0,         // More feathering for softer edges
    fabricTexture: true,        // Fabric texture bleed-through
    textureIntensity: 0.08,     // More texture showing through
    shadowBlur: 6,              // Softer shadow
    shadowOpacity: 0.15,        // Slightly stronger shadow for depth
    shadowAngle: 135,
    shadowDistance: 3,
    bgThreshold: 220,
    curvature: 0,
    matchLighting: true,        // Match product surface lighting
    lightingIntensity: 0.12,    // More lighting integration
    printIntegration: true,     // Edge darkening + highlight sheen
    printEdgeDarken: 0.08,      // Stronger edge darkening (ink absorption)
    printHighlight: 0.04,       // Subtle highlight on print
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
  color?: string,
): Promise<Buffer> {
  // Product type mapping
  const productNames: Record<string, string> = {
    sacola: 'cotton tote bag',
    camiseta: 'cotton t-shirt',
    caneca: 'ceramic coffee mug',
  };
  const materialNames: Record<string, string> = {
    sacola: 'cotton canvas',
    camiseta: 'cotton jersey knit',
    caneca: 'glossy ceramic glaze',
  };

  const product = productNames[style] || productNames.sacola;
  const material = materialNames[style] || materialNames.sacola;

  // PROMPT MESTRE: Ultra-realistic e-commerce mockup
  // Covers: perspective, displacement mapping, fabric texture, silk-screen print,
  // no borders/boxes, lighting coherence, professional studio quality.
  const withLogoPrompt = `Professional 8k e-commerce photo of a ${product}. Change the material color strictly to ${color || 'the selected color'}, maintaining all original studio lighting, deep shadows, and realistic highlights. The uploaded logo must be integrated using displacement mapping: it must follow the fabric folds, texture, and perspective perfectly. Eliminate any background boxes or black borders from the logo; it should appear as a high-quality silk-screen print absorbed into the ${material} fibers. The background of the image must remain neutral and professional. Sharp focus, cinematic studio quality, photorealistic.`;

  const noLogoPrompt = `Professional 8k e-commerce photo of a plain blank ${product}. Clean ${material} texture with natural drape and folds. Soft directional studio lighting with natural shadows on a neutral professional background. Sharp focus, cinematic studio quality, photorealistic.`;

  const prompt = hasLogo ? withLogoPrompt : noLogoPrompt;

  // Strength 0.50: enough freedom for AI to apply displacement mapping,
  // perspective deformation, and fabric texture integration
  const strength = hasLogo ? 0.50 : 0.25;
  const steps = hasLogo ? 28 : 8;

  console.log(`[product-image] AI refinement: strength=${strength}, steps=${steps}, hasLogo=${hasLogo}`);
  console.log(`[product-image] Prompt: ${prompt.substring(0, 120)}...`);

  return refineImageWithAI(imageBuffer, prompt, {
    strength,
    steps,
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
      productImageBase64,  // Optional: real product photo to use as base
      variables = [],
    } = body;

    const hasLogo = Boolean(logoDataUrl);
    const hasProductImage = Boolean(productImageBase64);
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
    // STEP 1: Get base image
    //   Priority: real product photo > AI generation > SVG fallback
    // =============================================
    let finalBuffer: Buffer;
    let imageSource: string;

    if (hasProductImage) {
      // USE THE REAL PRODUCT PHOTO as base — no need to generate or recolor
      console.log(`[product-image] Using provided product image as base`);
      const imgBase64 = productImageBase64.replace(/^data:image\/\w+;base64,/, '');
      finalBuffer = Buffer.from(imgBase64, 'base64');
      imageSource = 'product-photo';
    } else {
      // Generate base: AI → fallback SVG
      let neutralBase = await getOrCreateNeutralBase(style, variables);
      let usedFallback = false;
      if (!neutralBase) {
        console.log('[product-image] AI unavailable, creating local fallback');
        neutralBase = await createLocalFallbackBase(style);
        if (!neutralBase) return NextResponse.json({ error: 'Erro ao gerar imagem base.' }, { status: 502 });
        usedFallback = true;
      }

      // Recolor via LAB
      console.log(`[product-image] Recoloring to ${color}...`);
      finalBuffer = await recolorProduct(neutralBase, color);
      imageSource = usedFallback ? 'fallback-local' : 'recolor-lab';
    }

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
    const enableRefinement = process.env.KREA_API_KEY;
    if (enableRefinement) {
      try {
        const refined = await refineWithAI(finalBuffer, style, hasLogo, color);
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
    sacola: `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 3D bag body gradient: light left (highlight) → dark right (shadow) -->
    <linearGradient id="bagBody" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#a8a8a8"/>
      <stop offset="15%" stop-color="#b8b8b8"/>
      <stop offset="40%" stop-color="#b0b0b0"/>
      <stop offset="70%" stop-color="#9a9a9a"/>
      <stop offset="100%" stop-color="#858585"/>
    </linearGradient>
    <!-- Vertical gradient: top lighter, bottom darker (ground shadow) -->
    <linearGradient id="bagShade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0.08"/>
      <stop offset="40%" stop-color="white" stop-opacity="0"/>
      <stop offset="85%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.15"/>
    </linearGradient>
    <!-- Top fold gradient -->
    <linearGradient id="topFold" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#888"/>
      <stop offset="50%" stop-color="#999"/>
      <stop offset="100%" stop-color="#aaa"/>
    </linearGradient>
    <!-- Handle gradient for 3D rope look -->
    <linearGradient id="handleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#777"/>
      <stop offset="30%" stop-color="#999"/>
      <stop offset="50%" stop-color="#aaa"/>
      <stop offset="70%" stop-color="#999"/>
      <stop offset="100%" stop-color="#777"/>
    </linearGradient>
    <!-- Side panel shadow -->
    <linearGradient id="sideShadow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8a8a8a"/>
      <stop offset="100%" stop-color="#7a7a7a"/>
    </linearGradient>
    <!-- Fabric texture pattern -->
    <pattern id="fabric" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="transparent"/>
      <line x1="0" y1="0" x2="4" y2="0" stroke="rgba(0,0,0,0.04)" stroke-width="0.5"/>
      <line x1="0" y1="2" x2="4" y2="2" stroke="rgba(255,255,255,0.03)" stroke-width="0.5"/>
      <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(0,0,0,0.03)" stroke-width="0.5"/>
      <line x1="2" y1="0" x2="2" y2="4" stroke="rgba(255,255,255,0.02)" stroke-width="0.5"/>
    </pattern>
    <!-- Ground shadow -->
    <radialGradient id="groundShadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="black" stop-opacity="0.18"/>
      <stop offset="70%" stop-color="black" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </radialGradient>
    <!-- Side crease highlight -->
    <linearGradient id="creaseHL" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.04)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.06)"/>
    </linearGradient>
  </defs>

  <rect width="${w}" height="${h}" fill="white"/>

  <!-- Ground shadow (ellipse under bag) -->
  <ellipse cx="${w*0.5}" cy="${h*0.87}" rx="${w*0.32}" ry="${h*0.025}" fill="url(#groundShadow)"/>

  <!-- ===== BAG BODY ===== -->
  <!-- Main front face -->
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.7}" height="${h*0.65}" rx="3" fill="url(#bagBody)"/>
  <!-- Vertical shading overlay -->
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.7}" height="${h*0.65}" rx="3" fill="url(#bagShade)"/>
  <!-- Fabric texture overlay -->
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.7}" height="${h*0.65}" rx="3" fill="url(#fabric)"/>

  <!-- ===== SIDE PANEL (3D depth) ===== -->
  <polygon points="${w*0.85},${h*0.18} ${w*0.90},${h*0.15} ${w*0.90},${h*0.80} ${w*0.85},${h*0.83}" fill="url(#sideShadow)" opacity="0.6"/>

  <!-- ===== TOP FOLD ===== -->
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.7}" height="${h*0.035}" rx="2" fill="url(#topFold)" opacity="0.7"/>
  <!-- Fold crease line -->
  <line x1="${w*0.17}" y1="${h*0.215}" x2="${w*0.83}" y2="${h*0.215}" stroke="rgba(0,0,0,0.12)" stroke-width="0.8"/>
  <!-- Stitching line below fold -->
  <line x1="${w*0.18}" y1="${h*0.225}" x2="${w*0.82}" y2="${h*0.225}" stroke="rgba(255,255,255,0.15)" stroke-width="0.6" stroke-dasharray="3,3"/>

  <!-- ===== SIDE CREASES (fabric folds) ===== -->
  <line x1="${w*0.30}" y1="${h*0.22}" x2="${w*0.28}" y2="${h*0.82}" stroke="url(#creaseHL)" stroke-width="1.5"/>
  <line x1="${w*0.70}" y1="${h*0.22}" x2="${w*0.72}" y2="${h*0.82}" stroke="url(#creaseHL)" stroke-width="1.2"/>

  <!-- ===== LEFT HIGHLIGHT (simulates directional light) ===== -->
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.15}" height="${h*0.65}" rx="3" fill="rgba(255,255,255,0.08)"/>

  <!-- ===== BOTTOM EDGE SHADOW ===== -->
  <rect x="${w*0.15}" y="${h*0.78}" width="${w*0.7}" height="${h*0.05}" rx="2" fill="rgba(0,0,0,0.08)"/>

  <!-- ===== HANDLES ===== -->
  <!-- Left handle -->
  <path d="M${w*0.30},${h*0.18} Q${w*0.30},${h*0.04} ${w*0.40},${h*0.04}" fill="none" stroke="url(#handleGrad)" stroke-width="5" stroke-linecap="round"/>
  <path d="M${w*0.30},${h*0.18} Q${w*0.30},${h*0.04} ${w*0.40},${h*0.04}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round"/>
  <!-- Right handle -->
  <path d="M${w*0.60},${h*0.04} Q${w*0.70},${h*0.04} ${w*0.70},${h*0.18}" fill="none" stroke="url(#handleGrad)" stroke-width="5" stroke-linecap="round"/>
  <path d="M${w*0.60},${h*0.04} Q${w*0.70},${h*0.04} ${w*0.70},${h*0.18}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round"/>
  <!-- Handle attachment points (grommets) -->
  <circle cx="${w*0.30}" cy="${h*0.18}" r="3" fill="#888" stroke="#777" stroke-width="0.5"/>
  <circle cx="${w*0.70}" cy="${h*0.18}" r="3" fill="#888" stroke="#777" stroke-width="0.5"/>
  <circle cx="${w*0.30}" cy="${h*0.18}" r="1.5" fill="#aaa"/>
  <circle cx="${w*0.70}" cy="${h*0.18}" r="1.5" fill="#aaa"/>
</svg>`,

    camiseta: `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shirtBody" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#a8a8a8"/>
      <stop offset="20%" stop-color="#b8b8b8"/>
      <stop offset="50%" stop-color="#b0b0b0"/>
      <stop offset="80%" stop-color="#9a9a9a"/>
      <stop offset="100%" stop-color="#888"/>
    </linearGradient>
    <linearGradient id="shirtShade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0.06"/>
      <stop offset="50%" stop-color="white" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.12"/>
    </linearGradient>
    <pattern id="knit" width="3" height="3" patternUnits="userSpaceOnUse">
      <rect width="3" height="3" fill="transparent"/>
      <circle cx="1.5" cy="1.5" r="0.5" fill="rgba(0,0,0,0.03)"/>
    </pattern>
    <radialGradient id="groundShirt" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="black" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="white"/>
  <ellipse cx="${w*0.5}" cy="${h*0.88}" rx="${w*0.25}" ry="${h*0.02}" fill="url(#groundShirt)"/>
  <!-- Shirt body -->
  <path d="M${w*0.32},${h*0.08} L${w*0.15},${h*0.18} L${w*0.10},${h*0.28} L${w*0.22},${h*0.30} L${w*0.22},${h*0.82} L${w*0.78},${h*0.82} L${w*0.78},${h*0.30} L${w*0.90},${h*0.28} L${w*0.85},${h*0.18} L${w*0.68},${h*0.08} Q${w*0.58},${h*0.14} ${w*0.50},${h*0.14} Q${w*0.42},${h*0.14} ${w*0.32},${h*0.08} Z" fill="url(#shirtBody)"/>
  <path d="M${w*0.32},${h*0.08} L${w*0.15},${h*0.18} L${w*0.10},${h*0.28} L${w*0.22},${h*0.30} L${w*0.22},${h*0.82} L${w*0.78},${h*0.82} L${w*0.78},${h*0.30} L${w*0.90},${h*0.28} L${w*0.85},${h*0.18} L${w*0.68},${h*0.08} Q${w*0.58},${h*0.14} ${w*0.50},${h*0.14} Q${w*0.42},${h*0.14} ${w*0.32},${h*0.08} Z" fill="url(#shirtShade)"/>
  <path d="M${w*0.32},${h*0.08} L${w*0.15},${h*0.18} L${w*0.10},${h*0.28} L${w*0.22},${h*0.30} L${w*0.22},${h*0.82} L${w*0.78},${h*0.82} L${w*0.78},${h*0.30} L${w*0.90},${h*0.28} L${w*0.85},${h*0.18} L${w*0.68},${h*0.08} Q${w*0.58},${h*0.14} ${w*0.50},${h*0.14} Q${w*0.42},${h*0.14} ${w*0.32},${h*0.08} Z" fill="url(#knit)"/>
  <!-- Collar -->
  <ellipse cx="${w*0.50}" cy="${h*0.08}" rx="${w*0.10}" ry="${h*0.04}" fill="white" stroke="#999" stroke-width="1"/>
  <!-- Side seam lines -->
  <line x1="${w*0.22}" y1="${h*0.30}" x2="${w*0.22}" y2="${h*0.82}" stroke="rgba(0,0,0,0.06)" stroke-width="0.8"/>
  <line x1="${w*0.78}" y1="${h*0.30}" x2="${w*0.78}" y2="${h*0.82}" stroke="rgba(0,0,0,0.06)" stroke-width="0.8"/>
  <!-- Left highlight -->
  <path d="M${w*0.22},${h*0.30} L${w*0.22},${h*0.82} L${w*0.35},${h*0.82} L${w*0.35},${h*0.30} Z" fill="rgba(255,255,255,0.06)"/>
</svg>`,

    caneca: `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mugBody" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#aaa"/>
      <stop offset="15%" stop-color="#ccc"/>
      <stop offset="35%" stop-color="#ddd"/>
      <stop offset="55%" stop-color="#ccc"/>
      <stop offset="75%" stop-color="#aaa"/>
      <stop offset="100%" stop-color="#999"/>
    </linearGradient>
    <linearGradient id="mugShade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0.1"/>
      <stop offset="50%" stop-color="white" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="handleGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#bbb"/>
      <stop offset="50%" stop-color="#ddd"/>
      <stop offset="100%" stop-color="#bbb"/>
    </linearGradient>
    <radialGradient id="groundMug" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="black" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </radialGradient>
    <!-- Specular highlight -->
    <linearGradient id="specular" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="30%" stop-color="rgba(255,255,255,0.2)"/>
      <stop offset="40%" stop-color="rgba(255,255,255,0.35)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.2)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="white"/>
  <ellipse cx="${w*0.42}" cy="${h*0.88}" rx="${w*0.22}" ry="${h*0.02}" fill="url(#groundMug)"/>
  <!-- Mug body -->
  <rect x="${w*0.18}" y="${h*0.15}" width="${w*0.48}" height="${h*0.68}" rx="4" fill="url(#mugBody)"/>
  <rect x="${w*0.18}" y="${h*0.15}" width="${w*0.48}" height="${h*0.68}" rx="4" fill="url(#mugShade)"/>
  <!-- Specular highlight strip -->
  <rect x="${w*0.18}" y="${h*0.15}" width="${w*0.48}" height="${h*0.68}" rx="4" fill="url(#specular)"/>
  <!-- Top rim (ellipse) -->
  <ellipse cx="${w*0.42}" cy="${h*0.15}" rx="${w*0.24}" ry="${h*0.035}" fill="#ddd" stroke="#bbb" stroke-width="1"/>
  <ellipse cx="${w*0.42}" cy="${h*0.15}" rx="${w*0.22}" ry="${h*0.028}" fill="#eee"/>
  <!-- Bottom rim -->
  <ellipse cx="${w*0.42}" cy="${h*0.83}" rx="${w*0.24}" ry="${h*0.025}" fill="#999" stroke="#888" stroke-width="0.5"/>
  <!-- Handle -->
  <path d="M${w*0.66},${h*0.28} Q${w*0.80},${h*0.28} ${w*0.80},${h*0.48} Q${w*0.80},${h*0.68} ${w*0.66},${h*0.68}" fill="none" stroke="url(#handleGrad2)" stroke-width="6" stroke-linecap="round"/>
  <path d="M${w*0.66},${h*0.28} Q${w*0.78},${h*0.30} ${w*0.78},${h*0.48} Q${w*0.78},${h*0.66} ${w*0.66},${h*0.68}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" stroke-linecap="round"/>
</svg>`,
  };

  const svg = svgShapes[style] || svgShapes.sacola;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
