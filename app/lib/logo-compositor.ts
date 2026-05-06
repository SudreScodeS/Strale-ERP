// app/lib/logo-compositor.ts
// Professional logo compositing engine — SERVER-SIDE (sharp)
// Makes logos look PRINTED on products, not pasted
//
// PIPELINE:
// 1. Detect product bounds in the image (adaptive, not fixed percentages)
// 2. Multi-region background removal with adaptive threshold
// 3. Auto-crop to content bounds (zero padding)
// 4. Surface-aware perspective warp (flat / cylindrical)
// 5. Directional shadow for depth
// 6. Dynamic blend mode (light→multiply / dark→overlay)
// 7. Fabric texture overlay + surface lighting match
// 8. Edge feathering for seamless integration

import sharp from 'sharp';

// ==========================================
// Types
// ==========================================

export interface CompositorOptions {
  blendMode?: 'multiply' | 'overlay' | 'soft-light' | 'hard-light';
  opacity?: number;
  featherRadius?: number;
  fabricTexture?: boolean;
  textureIntensity?: number;
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowAngle?: number;
  shadowDistance?: number;
  bgThreshold?: number;
  curvature?: number;
  matchLighting?: boolean;
  lightingIntensity?: number;
  printIntegration?: boolean;
  printEdgeDarken?: number;
  printHighlight?: number;
}

const DEFAULT_OPTIONS: Required<CompositorOptions> = {
  blendMode: undefined as any,
  opacity: 0.92,
  featherRadius: 2.5,
  fabricTexture: true,
  textureIntensity: 0.06,
  shadowBlur: 6,
  shadowOpacity: 0.15,
  shadowAngle: 135,
  shadowDistance: 3,
  bgThreshold: 240,
  curvature: 0,
  matchLighting: true,
  lightingIntensity: 0.14,
  printIntegration: true,
  printEdgeDarken: 0.10,
  printHighlight: 0.05,
};

// ==========================================
// Product Bounds Detection
// ==========================================

/**
 * Detect where the product actually is in the image.
 * Analyzes pixel data to find the non-white region.
 * Returns the bounding box of the product.
 */
export async function detectProductBounds(
  imageBuffer: Buffer,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const { data, info } = await sharp(imageBuffer)
    .resize(256, 256, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;

  // Background detection: sample corners
  const cornerSamples: { r: number; g: number; b: number }[] = [];
  const cornerSize = Math.max(2, Math.floor(Math.min(w, h) * 0.04));

  for (const [cx, cy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    for (let dy = 0; dy < cornerSize; dy++) {
      for (let dx = 0; dx < cornerSize; dx++) {
        const x = Math.min(w - 1, cx + (cx === 0 ? dx : -dx));
        const y = Math.min(h - 1, cy + (cy === 0 ? dy : -dy));
        const idx = (y * w + x) * channels;
        cornerSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
      }
    }
  }

  // Average background color from corners
  let bgR = 0, bgG = 0, bgB = 0;
  for (const s of cornerSamples) { bgR += s.r; bgG += s.g; bgB += s.b; }
  bgR = Math.round(bgR / cornerSamples.length);
  bgG = Math.round(bgG / cornerSamples.length);
  bgB = Math.round(bgB / cornerSamples.length);

  // Find bounding box of non-background pixels
  const BG_DIST = 45; // Color distance threshold
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let foundProduct = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

      if (dist > BG_DIST) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        foundProduct = true;
      }
    }
  }

  if (!foundProduct) {
    // Fallback: use center 60% of image
    return {
      x: Math.round(w * 0.2),
      y: Math.round(h * 0.15),
      width: Math.round(w * 0.6),
      height: Math.round(h * 0.65),
    };
  }

  // Add 5% padding around detected bounds
  const padX = Math.round((maxX - minX) * 0.05);
  const padY = Math.round((maxY - minY) * 0.05);
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w - 1, maxX + padX);
  maxY = Math.min(h - 1, maxY + padY);

  // Scale back to original image dimensions
  const meta = await sharp(imageBuffer).metadata();
  const origW = meta.width || 512;
  const origH = meta.height || 640;
  const scaleX = origW / w;
  const scaleY = origH / h;

  return {
    x: Math.round(minX * scaleX),
    y: Math.round(minY * scaleY),
    width: Math.round((maxX - minX) * scaleX),
    height: Math.round((maxY - minY) * scaleY),
  };
}

/**
 * Get optimal print area WITHIN detected product bounds.
 * Position: centered horizontally, 35-45% from top of product.
 */
export function getPrintArea(
  imageWidth: number,
  imageHeight: number,
  productType: 'sacola' | 'camiseta' | 'caneca' | 'default' = 'default',
  productBounds?: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  // If we have detected product bounds, use them
  if (productBounds) {
    const b = productBounds;
    // Print area: centered in product, occupying 65-80% of product area
    const printW = Math.round(b.width * 0.75);
    const printH = Math.round(b.height * 0.55);
    const printX = b.x + Math.round((b.width - printW) / 2);
    // Position: 30-40% from top of product
    const printY = b.y + Math.round(b.height * 0.30);

    return { x: printX, y: printY, width: printW, height: printH };
  }

  // Fallback: fixed percentages (original behavior)
  const areas: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }> = {
    sacola:   { xPct: 0.12, yPct: 0.20, wPct: 0.76, hPct: 0.50 },
    camiseta: { xPct: 0.22, yPct: 0.18, wPct: 0.56, hPct: 0.38 },
    caneca:   { xPct: 0.18, yPct: 0.15, wPct: 0.64, hPct: 0.60 },
    default:  { xPct: 0.12, yPct: 0.20, wPct: 0.76, hPct: 0.50 },
  };

  const area = areas[productType] || areas.default;
  return {
    x: Math.round(imageWidth * area.xPct),
    y: Math.round(imageHeight * area.yPct),
    width: Math.round(imageWidth * area.wPct),
    height: Math.round(imageHeight * area.hPct),
  };
}

// ==========================================
// Background Removal — Multi-Region Adaptive
// ==========================================

async function removeBackgroundAdaptive(
  logoBuffer: Buffer,
  threshold: number = 240,
): Promise<Buffer> {
  const meta = await sharp(logoBuffer).metadata();

  // If already has meaningful alpha (pre-processed PNG with transparency), use it
  if (meta.channels === 4) {
    const stats = await sharp(logoBuffer).stats();
    const alphaChannel = stats.channels[3];
    if (alphaChannel && alphaChannel.mean < 128) {
      // Already has good transparency — just clean it up
      return sharp(logoBuffer).ensureAlpha().png().toBuffer();
    }
  }

  const { data, info } = await sharp(logoBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;
  const outputBuffer = Buffer.alloc(w * h * 4);

  // =============================================
  // STEP 1: Detect background from ALL edges (10% depth)
  // =============================================
  const edgeDepth = Math.max(3, Math.floor(Math.min(w, h) * 0.10));
  const edgeSamples: { r: number; g: number; b: number }[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const isEdge = y < edgeDepth || y >= h - edgeDepth ||
                     x < edgeDepth || x >= w - edgeDepth;
      if (!isEdge) continue;
      const idx = (y * w + x) * channels;
      edgeSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }

  // Cluster edge samples to find dominant background color
  interface Cluster { r: number; g: number; b: number; count: number; brightness: number }
  const clusters: Cluster[] = [];

  for (const s of edgeSamples) {
    const brightness = s.r * 0.299 + s.g * 0.587 + s.b * 0.114;
    let merged = false;
    for (const c of clusters) {
      if (Math.sqrt((s.r - c.r) ** 2 + (s.g - c.g) ** 2 + (s.b - c.b) ** 2) < 50) {
        c.r = Math.round((c.r * c.count + s.r) / (c.count + 1));
        c.g = Math.round((c.g * c.count + s.g) / (c.count + 1));
        c.b = Math.round((c.b * c.count + s.b) / (c.count + 1));
        c.brightness = (c.brightness * c.count + brightness) / (c.count + 1);
        c.count++;
        merged = true;
        break;
      }
    }
    if (!merged) clusters.push({ r: s.r, g: s.g, b: s.b, count: 1, brightness });
  }

  clusters.sort((a, b) => b.count - a.count);
  const bg = clusters[0] || { r: 255, g: 255, b: 255, brightness: 255 };

  console.log(`[logo-compositor] Background: rgb(${bg.r},${bg.g},${bg.b}) brightness=${bg.brightness.toFixed(0)}`);

  // =============================================
  // STEP 2: Adaptive threshold based on background type
  // =============================================
  const isDarkBg = bg.brightness < 60;
  const isNearWhite = bg.brightness > 200;
  const isLightBg = bg.brightness > 160;

  // For light/white backgrounds: use tight threshold to catch off-white, cream, light gray
  // For dark backgrounds: use looser threshold
  let fadeStart: number;
  let fadeEnd: number;

  if (isNearWhite) {
    // White/near-white bg: very aggressive removal
    // Colors within 60 units of bg = background, fade from 60-90
    fadeStart = 60;
    fadeEnd = 90;
  } else if (isLightBg) {
    // Light gray/cream bg
    fadeStart = 50;
    fadeEnd = 80;
  } else if (isDarkBg) {
    // Dark bg: more lenient
    fadeStart = 30;
    fadeEnd = 60;
  } else {
    // Mid-tone bg
    fadeStart = 40;
    fadeEnd = 70;
  }

  // =============================================
  // STEP 3: Classify pixels with smoothstep feathering
  // =============================================
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * channels;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2];

      const colorDist = Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);

      let alpha: number;

      if (colorDist <= fadeStart) {
        alpha = 0; // Definitely background
      } else if (colorDist < fadeEnd) {
        // Smoothstep transition zone
        const t = (colorDist - fadeStart) / (fadeEnd - fadeStart);
        const smooth = t * t * (3 - 2 * t);
        alpha = Math.round(smooth * 255);
      } else {
        alpha = 255; // Definitely foreground
      }

      outputBuffer[dstIdx] = r;
      outputBuffer[dstIdx + 1] = g;
      outputBuffer[dstIdx + 2] = b;
      outputBuffer[dstIdx + 3] = alpha;
    }
  }

  // =============================================
  // STEP 4: Clean up — remove isolated transparent pixels (noise)
  // and fill isolated opaque pixels inside logo
  // =============================================
  const cleaned = Buffer.from(outputBuffer);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4 + 3;
      const alpha = outputBuffer[idx];

      // Count opaque neighbors
      let opaqueNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (outputBuffer[((y + dy) * w + (x + dx)) * 4 + 3] > 128) opaqueNeighbors++;
        }
      }

      // If pixel is transparent but surrounded by opaque → make opaque (fill holes)
      if (alpha < 64 && opaqueNeighbors >= 6) {
        cleaned[idx] = 200;
      }
      // If pixel is opaque but surrounded by transparent → make transparent (remove noise)
      else if (alpha > 128 && opaqueNeighbors <= 1) {
        cleaned[idx] = 0;
      }
    }
  }

  return sharp(cleaned, { raw: { width: w, height: h, channels: 4 } })
    .ensureAlpha().png().toBuffer();
}

async function autoCropToContent(buffer: Buffer): Promise<Buffer> {
  try { return await sharp(buffer).trim({ threshold: 10 }).png().toBuffer(); }
  catch { return buffer; }
}

// ==========================================
// Surface Warp
// ==========================================

async function applyCylindricalWarp(logoBuffer: Buffer, curvature: number): Promise<Buffer> {
  if (curvature < 0.01) return logoBuffer;

  const { data, info } = await sharp(logoBuffer)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const output = Buffer.alloc(info.width * info.height * 4);
  const iw = info.width, ih = info.height;
  const centerX = iw / 2;
  const edgeBlur = Math.round(curvature * 2);

  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const idx = (y * iw + x) * info.channels;
      const dstIdx = (y * iw + x) * 4;
      const dx = Math.abs(x - centerX) / (iw / 2);
      const edgeFactor = 1 - dx * dx * curvature * 0.3;

      output[dstIdx] = Math.round(data[idx] * edgeFactor);
      output[dstIdx + 1] = Math.round(data[idx + 1] * edgeFactor);
      output[dstIdx + 2] = Math.round(data[idx + 2] * edgeFactor);
      output[dstIdx + 3] = data[idx + 3];
    }
  }

  return sharp(output, { raw: { width: iw, height: ih, channels: 4 } })
    .blur(edgeBlur).png().toBuffer();
}

// ==========================================
// Shadow
// ==========================================

async function createDirectionalShadow(
  logoBuffer: Buffer, width: number, height: number,
  angle: number, distance: number, blur: number, opacity: number,
): Promise<Buffer> {
  const { data, info } = await sharp(logoBuffer)
    .resize(width, height, { fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const shadowBuf = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const srcIdx = i * info.channels;
    const dstIdx = i * 4;
    shadowBuf[dstIdx] = 0; shadowBuf[dstIdx + 1] = 0; shadowBuf[dstIdx + 2] = 0;
    shadowBuf[dstIdx + 3] = Math.round(data[srcIdx + 3] * opacity);
  }

  return sharp(shadowBuf, { raw: { width: info.width, height: info.height, channels: 4 } })
    .blur(blur).png().toBuffer();
}

function getShadowOffset(angle: number, distance: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.round(Math.cos(rad) * distance), y: Math.round(Math.sin(rad) * distance) };
}

// ==========================================
// Texture & Surface Integration
// ==========================================

async function createFabricTexture(width: number, height: number, intensity: number): Promise<Buffer> {
  const buf = Buffer.alloc(width * height * 4);
  let seed = width * 31 + height * 17;
  const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const hFiber = (y % 3 < 1) ? 1 : 0;
      const vFiber = (x % 3 < 1) ? 1 : 0;
      const weave = (hFiber + vFiber) % 2;
      const noise = (rand() - 0.5) * 0.5;
      const value = Math.round(128 + (weave - 0.5) * 40 + noise * 20);

      buf[idx] = value; buf[idx + 1] = value; buf[idx + 2] = value;
      buf[idx + 3] = Math.round(intensity * 255);
    }
  }

  return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function createSurfaceLightingMap(
  productBuffer: Buffer, targetW: number, targetH: number,
  offsetX: number, offsetY: number,
): Promise<Buffer> {
  const meta = await sharp(productBuffer).metadata();
  const pw = meta.width || targetW;
  const ph = meta.height || targetH;
  const left = Math.max(0, Math.min(offsetX, pw - targetW));
  const top = Math.max(0, Math.min(offsetY, ph - targetH));

  return sharp(productBuffer)
    .extract({ left, top, width: Math.min(targetW, pw - left), height: Math.min(targetH, ph - top) })
    .greyscale().normalize().ensureAlpha()
    .resize(targetW, targetH, { fit: 'fill' }).png().toBuffer();
}

async function createEdgeDarkeningMask(
  logoBuffer: Buffer, width: number, height: number, intensity: number,
): Promise<Buffer> {
  const { data, info } = await sharp(logoBuffer)
    .resize(width, height, { fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const edgeBuf = Buffer.alloc(info.width * info.height * 4);
  const ew = info.width, eh = info.height;

  for (let y = 0; y < eh; y++) {
    for (let x = 0; x < ew; x++) {
      const idx = (y * ew + x) * info.channels;
      const alpha = data[idx + 3];
      const dstIdx = (y * ew + x) * 4;

      if (alpha < 10) {
        edgeBuf[dstIdx] = 0; edgeBuf[dstIdx + 1] = 0; edgeBuf[dstIdx + 2] = 0; edgeBuf[dstIdx + 3] = 0;
        continue;
      }

      let isEdge = false;
      for (let dy = -1; dy <= 1 && !isEdge; dy++) {
        for (let dx = -1; dx <= 1 && !isEdge; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < ew && ny >= 0 && ny < eh) {
            if (Math.abs(alpha - data[(ny * ew + nx) * info.channels + 3]) > 50) isEdge = true;
          }
        }
      }

      if (isEdge) {
        edgeBuf[dstIdx] = 0; edgeBuf[dstIdx + 1] = 0; edgeBuf[dstIdx + 2] = 0;
        edgeBuf[dstIdx + 3] = Math.round(intensity * 255);
      } else {
        edgeBuf[dstIdx] = 0; edgeBuf[dstIdx + 1] = 0; edgeBuf[dstIdx + 2] = 0; edgeBuf[dstIdx + 3] = 0;
      }
    }
  }

  return sharp(edgeBuf, { raw: { width: ew, height: eh, channels: 4 } })
    .blur(1.5).png().toBuffer();
}

async function createHighlightSheen(width: number, height: number, intensity: number): Promise<Buffer> {
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const t = (x / width * 0.5 + y / height * 0.5);
      const value = Math.round((1 - t) * 255);
      buf[idx] = value; buf[idx + 1] = value; buf[idx + 2] = value;
      buf[idx + 3] = Math.round(intensity * 255 * (1 - Math.abs(t - 0.5) * 2));
    }
  }

  return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// ==========================================
// Blend Mode Selection
// ==========================================

function selectBlendMode(productColorHex: string): 'multiply' | 'overlay' | 'soft-light' {
  const rgb = hexToRgb(productColorHex);
  if (!rgb) return 'multiply';
  const brightness = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
  if (brightness < 80) return 'overlay';
  if (brightness > 200) return 'multiply';
  return 'soft-light';
}

// ==========================================
// Main Composite Pipeline
// ==========================================

/**
 * Composite a logo onto a product with professional print-quality realism.
 * NOW accepts optional productBounds for adaptive positioning.
 */
export async function compositeLogo(
  productBuffer: Buffer,
  logoBuffer: Buffer,
  printArea: { x: number; y: number; width: number; height: number },
  options?: CompositorOptions,
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const blendMode = opts.blendMode || selectBlendMode('#808080');

  // STAGE 1: Clean logo
  let cleanLogo = await removeBackgroundAdaptive(logoBuffer, opts.bgThreshold);
  cleanLogo = await autoCropToContent(cleanLogo);

  // STAGE 2: Calculate size and position
  const padding = Math.min(printArea.width, printArea.height) * 0.04;
  const availW = printArea.width - padding * 2;
  const availH = printArea.height - padding * 2;
  const scaleFactor = 0.75;
  const maxLogoW = Math.round(availW * scaleFactor);
  const maxLogoH = Math.round(availH * scaleFactor);

  const logoMeta = await sharp(cleanLogo).metadata();
  const logoRatio = (logoMeta.width || 1) / (logoMeta.height || 1);
  let logoW: number, logoH: number;

  if (logoRatio > maxLogoW / maxLogoH) {
    logoW = maxLogoW; logoH = Math.round(logoW / logoRatio);
  } else {
    logoH = maxLogoH; logoW = Math.round(logoH * logoRatio);
  }

  const minSize = Math.round(Math.min(printArea.width, printArea.height) * 0.12);
  if (logoW < minSize || logoH < minSize) {
    const scale = minSize / Math.min(logoW, logoH);
    logoW = Math.round(logoW * scale); logoH = Math.round(logoH * scale);
  }

  // Position: centered horizontally, 38-42% from top of print area
  const logoX = Math.round(printArea.x + (printArea.width - logoW) / 2);
  const logoY = Math.round(printArea.y + printArea.height * 0.40 - logoH / 2);

  // STAGE 3: Resize + surface warp
  let processedLogo = await sharp(cleanLogo)
    .resize(logoW, logoH, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha().png().toBuffer();

  if (opts.curvature > 0.01) {
    processedLogo = await applyCylindricalWarp(processedLogo, opts.curvature);
  }

  // STAGE 4: Build composite layers
  const layers: sharp.OverlayOptions[] = [];

  // 4a. Directional shadow (depth)
  if (opts.shadowBlur > 0 && opts.shadowOpacity > 0) {
    const shadow = await createDirectionalShadow(
      processedLogo, logoW, logoH, opts.shadowAngle, opts.shadowDistance, opts.shadowBlur, opts.shadowOpacity,
    );
    const offset = getShadowOffset(opts.shadowAngle, opts.shadowDistance);
    layers.push({ input: shadow, left: logoX + offset.x, top: logoY + offset.y, blend: 'over' });
  }

  // 4b. Logo with dynamic blend mode (multiply on light = ink on paper)
  layers.push({ input: processedLogo, left: logoX, top: logoY, blend: blendMode as any });

  // 4c. Edge darkening (ink absorption at print edges)
  if (opts.printIntegration && opts.printEdgeDarken > 0) {
    const edgeMask = await createEdgeDarkeningMask(processedLogo, logoW, logoH, opts.printEdgeDarken);
    layers.push({ input: edgeMask, left: logoX, top: logoY, blend: 'multiply' });
  }

  // 4d. Surface texture bleed-through (fabric weave visible through logo)
  if (opts.fabricTexture && opts.textureIntensity > 0) {
    const texture = await createFabricTexture(logoW, logoH, opts.textureIntensity);
    layers.push({ input: texture, left: logoX, top: logoY, blend: 'overlay' });
  }

  // 4e. Surface lighting match (logo follows product contours)
  if (opts.matchLighting && opts.lightingIntensity > 0) {
    const lightMap = await createSurfaceLightingMap(productBuffer, logoW, logoH, logoX, logoY);
    layers.push({ input: lightMap, left: logoX, top: logoY, blend: 'overlay' });
  }

  // 4f. Highlight sheen (subtle gloss)
  if (opts.printIntegration && opts.printHighlight > 0) {
    const sheen = await createHighlightSheen(logoW, logoH, opts.printHighlight);
    layers.push({ input: sheen, left: logoX, top: logoY, blend: 'soft-light' });
  }

  // 4g. Final opacity pass — ensures logo doesn't look "pasted"
  // Reduce logo alpha slightly so the product surface bleeds through
  const opacityAlpha = Math.round(opts.opacity * 255);
  if (opacityAlpha < 255) {
    const { data: logoData, info: logoInfo } = await sharp(processedLogo)
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const alphaAdjusted = Buffer.from(logoData);
    for (let i = 0; i < logoInfo.width * logoInfo.height; i++) {
      const aIdx = i * logoInfo.channels + 3;
      alphaAdjusted[aIdx] = Math.round(alphaAdjusted[aIdx] * opts.opacity);
    }

    processedLogo = await sharp(alphaAdjusted, {
      raw: { width: logoInfo.width, height: logoInfo.height, channels: logoInfo.channels },
    }).png().toBuffer();

    // Update the logo layer in the layers array
    const logoLayerIdx = layers.findIndex(l => l.blend === (blendMode as any));
    if (logoLayerIdx >= 0) {
      layers[logoLayerIdx] = { ...layers[logoLayerIdx], input: processedLogo };
    }
  }

  // STAGE 5: Composite
  let result = await sharp(productBuffer).composite(layers).png().toBuffer();

  // STAGE 6: Edge feathering
  if (opts.featherRadius > 0) {
    const regionLeft = Math.max(0, logoX - 2);
    const regionTop = Math.max(0, logoY - 2);
    const resultMeta = await sharp(result).metadata();
    const regionW = Math.min(logoW + 4, (resultMeta.width || logoW) - regionLeft);
    const regionH = Math.min(logoH + 4, (resultMeta.height || logoH) - regionTop);

    if (regionW > 0 && regionH > 0) {
      const region = await sharp(result)
        .extract({ left: regionLeft, top: regionTop, width: regionW, height: regionH })
        .blur(opts.featherRadius * 0.3).png().toBuffer();

      result = await sharp(result)
        .composite([{ input: region, left: regionLeft, top: regionTop, blend: 'over' }])
        .png().toBuffer();
    }
  }

  return result;
}

// ==========================================
// Compositor Options
// ==========================================

export function getProductCompositorOptions(
  productType: 'sacola' | 'camiseta' | 'caneca' | 'default',
  productColorHex: string,
): CompositorOptions {
  const rgb = hexToRgb(productColorHex);
  const brightness = rgb ? rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 : 200;

  const base: CompositorOptions = {
    blendMode: selectBlendMode(productColorHex),
    opacity: brightness < 80 ? 0.92 : 0.96,
    featherRadius: 2.0,
    fabricTexture: true,
    textureIntensity: 0.04,
    shadowBlur: 5,
    shadowOpacity: brightness < 80 ? 0.10 : 0.15,
    shadowAngle: 135,
    shadowDistance: 3,
    bgThreshold: 220,
    curvature: 0,
    matchLighting: true,
    lightingIntensity: 0.10,
    printIntegration: true,
    printEdgeDarken: 0.06,
    printHighlight: 0.03,
  };

  switch (productType) {
    case 'camiseta':
      base.textureIntensity = 0.08; base.featherRadius = 2.5;
      base.shadowBlur = 4; base.shadowDistance = 2;
      base.curvature = 0; base.printEdgeDarken = 0.05;
      break;
    case 'caneca':
      base.fabricTexture = false; base.textureIntensity = 0;
      base.shadowBlur = 6; base.shadowOpacity = 0.18;
      base.featherRadius = 1.5; base.curvature = 0.5;
      base.printHighlight = 0.06; base.printEdgeDarken = 0.04;
      break;
    case 'sacola':
      base.textureIntensity = 0.07;
      base.featherRadius = 2.5;
      base.shadowBlur = 6;
      base.shadowDistance = 3;
      base.shadowOpacity = 0.14;
      base.curvature = 0;
      base.printEdgeDarken = 0.10;
      base.printHighlight = 0.04;
      base.lightingIntensity = 0.14;
      break;
  }

  return base;
}

export async function analyzeReferenceStyle(
  referenceBuffer: Buffer,
  productType: 'sacola' | 'camiseta' | 'caneca' | 'default',
): Promise<CompositorOptions> {
  const meta = await sharp(referenceBuffer).metadata();
  const w = meta.width || 512;
  const h = meta.height || 512;
  const centerX = Math.floor(w * 0.3);
  const centerY = Math.floor(h * 0.3);
  const regionW = Math.floor(w * 0.4);
  const regionH = Math.floor(h * 0.4);

  try {
    const centerRegion = await sharp(referenceBuffer)
      .extract({ left: centerX, top: centerY, width: regionW, height: regionH })
      .greyscale().raw().toBuffer();

    let sum = 0, sumSq = 0;
    for (let i = 0; i < centerRegion.length; i++) {
      sum += centerRegion[i]; sumSq += centerRegion[i] * centerRegion[i];
    }
    const mean = sum / centerRegion.length;
    const stdDev = Math.sqrt(Math.max(0, sumSq / centerRegion.length - mean * mean));

    let blendMode: 'multiply' | 'overlay' | 'soft-light' = 'soft-light';
    if (stdDev > 60) blendMode = 'overlay';
    else if (stdDev < 30) blendMode = 'multiply';

    return {
      ...getProductCompositorOptions(productType, '#808080'),
      blendMode,
      opacity: Math.min(0.98, Math.max(0.85, mean / 280)),
      matchLighting: true,
      lightingIntensity: 0.15,
    };
  } catch {
    return getProductCompositorOptions(productType, '#808080');
  }
}

// ==========================================
// Utilities
// ==========================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
