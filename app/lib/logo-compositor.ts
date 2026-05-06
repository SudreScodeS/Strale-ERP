// app/lib/logo-compositor.ts
// Professional logo compositing engine — SERVER-SIDE (sharp)
// Handles: background removal, edge feathering, blend modes, fabric texture,
// lighting integration, and surface conformity
// Makes logos look PRINTED on products, not pasted

import sharp from 'sharp';

export interface CompositorOptions {
  /** Blend mode for logo integration */
  blendMode?: 'multiply' | 'overlay' | 'soft-light' | 'dest-over';
  /** Logo opacity (0–1) */
  opacity?: number;
  /** Edge feather radius in px (softens hard edges) */
  featherRadius?: number;
  /** Enable fabric texture simulation */
  fabricTexture?: boolean;
  /** Fabric texture intensity (0–1) */
  textureIntensity?: number;
  /** Shadow under logo for depth */
  shadowBlur?: number;
  shadowOpacity?: number;
  /** Background removal threshold (0–255) */
  bgThreshold?: number;
  /** Lighting: match product surface lighting */
  matchLighting?: boolean;
  /** Lighting intensity (0–1) */
  lightingIntensity?: number;
}

const DEFAULT_OPTIONS: Required<CompositorOptions> = {
  blendMode: 'multiply',
  opacity: 0.92,
  featherRadius: 1.5,
  fabricTexture: true,
  textureIntensity: 0.06,
  shadowBlur: 4,
  shadowOpacity: 0.15,
  bgThreshold: 240,
  matchLighting: true,
  lightingIntensity: 0.15,
};

// ==========================================
// Background removal (sharp-based)
// ==========================================

/**
 * Remove background from a logo image using edge pixel sampling.
 * Returns RGBA PNG with transparent background.
 */
async function removeLogoBackground(
  logoBuffer: Buffer,
  threshold: number = 240,
): Promise<Buffer> {
  const meta = await sharp(logoBuffer).metadata();

  // Already has alpha channel
  if (meta.channels === 4) {
    // Check if it's already mostly transparent (pre-processed)
    const stats = await sharp(logoBuffer).stats();
    if (stats.channels[3] && stats.channels[3].mean < 200) {
      return sharp(logoBuffer).ensureAlpha().png().toBuffer();
    }
  }

  const { data, info } = await sharp(logoBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;
  const outputBuffer = Buffer.alloc(w * h * 4);

  // Sample edge pixels for background detection
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

  if (edgePixels.length === 0) {
    return sharp(logoBuffer).ensureAlpha().png().toBuffer();
  }

  // Cluster edge pixels to find dominant background color
  const bgR = Math.round(edgePixels.reduce((s, p) => s + p.r, 0) / edgePixels.length);
  const bgG = Math.round(edgePixels.reduce((s, p) => s + p.g, 0) / edgePixels.length);
  const bgB = Math.round(edgePixels.reduce((s, p) => s + p.b, 0) / edgePixels.length);
  const avgBrightness = bgR * 0.299 + bgG * 0.587 + bgB * 0.114;

  const isDarkBg = avgBrightness < 80;
  const colorThreshold = isDarkBg ? 100 : 80;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * channels;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2];

      const colorDist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

      let alpha: number;
      if (colorDist < colorThreshold * 0.35) {
        alpha = 0; // Definitely background
      } else if (colorDist < colorThreshold) {
        // Edge zone → smoothstep feathering
        const t = (colorDist - colorThreshold * 0.35) / (colorThreshold * 0.65);
        const smooth = t * t * (3 - 2 * t);
        alpha = Math.round(smooth * 255);
      } else {
        alpha = 255; // Foreground
      }

      outputBuffer[dstIdx] = r;
      outputBuffer[dstIdx + 1] = g;
      outputBuffer[dstIdx + 2] = b;
      outputBuffer[dstIdx + 3] = alpha;
    }
  }

  const result = await sharp(outputBuffer, { raw: { width: w, height: h, channels: 4 } })
    .ensureAlpha()
    .png()
    .toBuffer();

  // Trim transparent padding
  try {
    const trimmed = await sharp(result).trim({ threshold: 10 }).png().toBuffer();
    return trimmed;
  } catch {
    return result;
  }
}

/**
 * Apply Gaussian blur to alpha channel edges for smooth blending
 */
async function featherEdges(buffer: Buffer, radius: number): Promise<Buffer> {
  if (radius <= 0) return buffer;

  const meta = await sharp(buffer).metadata();
  if (meta.channels !== 4) return buffer;

  // Use sharp's blur on the entire image, then re-apply original RGB
  // This softens the alpha edges
  const blurred = await sharp(buffer)
    .blur(radius * 0.6)
    .png()
    .toBuffer();

  // Extract alpha from blurred, RGB from original
  const { data: blurData, info: blurInfo } = await sharp(blurred)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: origData, info: origInfo } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = blurInfo.width;
  const h = blurInfo.height;
  const out = Buffer.alloc(w * h * 4);

  for (let i = 0; i < w * h; i++) {
    const srcIdx = i * origInfo.channels;
    const blurIdx = i * blurInfo.channels;
    const dstIdx = i * 4;

    out[dstIdx] = origData[srcIdx];       // R from original
    out[dstIdx + 1] = origData[srcIdx + 1]; // G from original
    out[dstIdx + 2] = origData[srcIdx + 2]; // B from original
    out[dstIdx + 3] = blurData[blurIdx + 3]; // Alpha from blurred
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

// ==========================================
// Texture & Surface
// ==========================================

/**
 * Create a fabric texture overlay as a sharp-compatible buffer
 */
async function createFabricTexture(
  width: number,
  height: number,
  intensity: number,
): Promise<Buffer> {
  // Create a subtle noise pattern
  const pixelCount = width * height;
  const noiseBuffer = Buffer.alloc(pixelCount * 4);

  // Deterministic pseudo-random using simple hash
  let seed = width * 31 + height * 17;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Woven pattern: alternating horizontal and vertical fibers
      const hFiber = (y % 4 < 1) ? 1 : 0;
      const vFiber = (x % 4 < 1) ? 1 : 0;
      const weave = (hFiber + vFiber) % 2;

      const noise = (rand() - 0.5) * 0.6;
      const value = Math.round(128 + (weave - 0.5) * 50 + noise * 25);

      noiseBuffer[idx] = value;
      noiseBuffer[idx + 1] = value;
      noiseBuffer[idx + 2] = value;
      noiseBuffer[idx + 3] = Math.round(intensity * 255);
    }
  }

  return sharp(noiseBuffer, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/**
 * Create a lighting map from the product surface
 * Captures luminance to make the logo follow surface lighting
 */
async function createLightingMap(
  productBuffer: Buffer,
  targetW: number,
  targetH: number,
): Promise<Buffer> {
  return sharp(productBuffer)
    .resize(targetW, targetH, { fit: 'cover' })
    .greyscale()
    .normalize()
    .ensureAlpha()
    .png()
    .toBuffer();
}

/**
 * Create a shadow layer from the logo shape
 */
async function createShadowLayer(
  logoBuffer: Buffer,
  width: number,
  height: number,
  blur: number,
  opacity: number,
): Promise<Buffer> {
  // Create dark silhouette of logo
  const { data, info } = await sharp(logoBuffer)
    .resize(width, height, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const shadowBuf = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const srcIdx = i * info.channels;
    const dstIdx = i * 4;
    shadowBuf[dstIdx] = 0;
    shadowBuf[dstIdx + 1] = 0;
    shadowBuf[dstIdx + 2] = 0;
    shadowBuf[dstIdx + 3] = data[srcIdx + 3]; // Keep alpha shape
  }

  return sharp(shadowBuf, { raw: { width: info.width, height: info.height, channels: 4 } })
    .blur(blur)
    .ensureAlpha()
    .png()
    .toBuffer();
}

// ==========================================
// Main compositing function
// ==========================================

/**
 * Composite a logo onto a product image with professional quality.
 *
 * Pipeline:
 * 1. Remove logo background with feathered edges
 * 2. Resize logo to fit print area
 * 3. Create shadow for depth
 * 4. Apply fabric texture (optional)
 * 5. Composite logo with blend mode
 * 6. Match surface lighting (optional)
 *
 * @param productBuffer - The product image buffer (PNG/JPEG)
 * @param logoBuffer - The logo image buffer
 * @param printArea - Bounding box where the logo should be placed
 * @param options - Compositing options
 * @returns Final composited image buffer
 */
export async function compositeLogo(
  productBuffer: Buffer,
  logoBuffer: Buffer,
  printArea: { x: number; y: number; width: number; height: number },
  options?: CompositorOptions,
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1. Process logo: remove background + feather edges
  let processedLogo = await removeLogoBackground(logoBuffer, opts.bgThreshold);
  if (opts.featherRadius > 0) {
    processedLogo = await featherEdges(processedLogo, opts.featherRadius);
  }

  // 2. Calculate logo dimensions within print area (85% of available area)
  const padding = Math.min(printArea.width, printArea.height) * 0.05;
  const availW = printArea.width - padding * 2;
  const availH = printArea.height - padding * 2;
  const maxLogoW = Math.round(availW * 0.85);
  const maxLogoH = Math.round(availH * 0.85);

  const logoMeta = await sharp(processedLogo).metadata();
  const logoRatio = (logoMeta.width || 1) / (logoMeta.height || 1);
  let logoW: number, logoH: number;

  if (logoRatio > maxLogoW / maxLogoH) {
    logoW = maxLogoW;
    logoH = Math.round(logoW / logoRatio);
  } else {
    logoH = maxLogoH;
    logoW = Math.round(logoH * logoRatio);
  }

  // Ensure minimum visibility
  const minSize = Math.round(Math.min(printArea.width, printArea.height) * 0.15);
  if (logoW < minSize || logoH < minSize) {
    const scale = minSize / Math.min(logoW, logoH);
    logoW = Math.round(logoW * scale);
    logoH = Math.round(logoH * scale);
  }

  // Center in print area
  const logoX = Math.round(printArea.x + (printArea.width - logoW) / 2);
  const logoY = Math.round(printArea.y + (printArea.height - logoH) / 2);

  // 3. Resize logo to final dimensions
  const resizedLogo = await sharp(processedLogo)
    .resize(logoW, logoH, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer();

  // 4. Build composite layers
  const layers: sharp.OverlayOptions[] = [];

  // Shadow layer (offset slightly for depth)
  if (opts.shadowBlur > 0 && opts.shadowOpacity > 0) {
    const shadow = await createShadowLayer(
      resizedLogo, logoW, logoH,
      opts.shadowBlur, opts.shadowOpacity,
    );
    layers.push({
      input: shadow,
      left: logoX + Math.max(1, Math.round(logoW * 0.005)),
      top: logoY + Math.max(1, Math.round(logoH * 0.01)),
      blend: 'over',
    });
  }

  // Fabric texture overlay
  if (opts.fabricTexture && opts.textureIntensity > 0) {
    const texture = await createFabricTexture(logoW, logoH, opts.textureIntensity);
    layers.push({
      input: texture,
      left: logoX,
      top: logoY,
      blend: 'overlay',
    });
  }

  // Logo itself
  layers.push({
    input: resizedLogo,
    left: logoX,
    top: logoY,
    blend: opts.blendMode as any,
  });

  // 5. Composite all layers
  let result = await sharp(productBuffer)
    .composite(layers)
    .png()
    .toBuffer();

  // 6. Lighting match (apply after logo to simulate surface lighting)
  if (opts.matchLighting && opts.lightingIntensity > 0) {
    const lightMap = await createLightingMap(productBuffer, logoW, logoH);
    result = await sharp(result)
      .composite([{
        input: lightMap,
        left: logoX,
        top: logoY,
        blend: 'overlay',
      }])
      .png()
      .toBuffer();
  }

  return result;
}

// ==========================================
// Print area detection
// ==========================================

/**
 * Get optimal print area for a product image based on product type.
 */
export function getPrintArea(
  imageWidth: number,
  imageHeight: number,
  productType: 'sacola' | 'camiseta' | 'caneca' | 'default' = 'default',
): { x: number; y: number; width: number; height: number } {
  const areas: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }> = {
    sacola: { xPct: 0.12, yPct: 0.18, wPct: 0.76, hPct: 0.55 },
    camiseta: { xPct: 0.2, yPct: 0.15, wPct: 0.6, hPct: 0.42 },
    caneca: { xPct: 0.18, yPct: 0.15, wPct: 0.64, hPct: 0.6 },
    default: { xPct: 0.12, yPct: 0.18, wPct: 0.76, hPct: 0.55 },
  };

  const area = areas[productType] || areas.default;
  return {
    x: Math.round(imageWidth * area.xPct),
    y: Math.round(imageHeight * area.yPct),
    width: Math.round(imageWidth * area.wPct),
    height: Math.round(imageHeight * area.hPct),
  };
}

/**
 * Get compositor options optimized for a specific product type
 */
export function getProductCompositorOptions(
  productType: 'sacola' | 'camiseta' | 'caneca' | 'default',
  productColorHex: string,
): CompositorOptions {
  const rgb = hexToRgb(productColorHex);
  const brightness = rgb ? rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 : 200;

  let blendMode: 'multiply' | 'overlay' | 'soft-light' = 'multiply';
  if (brightness < 80) blendMode = 'overlay';
  else if (brightness < 160) blendMode = 'soft-light';

  const base: CompositorOptions = {
    blendMode,
    opacity: brightness < 80 ? 0.90 : 0.97,
    featherRadius: 2,
    fabricTexture: true,
    textureIntensity: 0.03,
    shadowBlur: 3,
    shadowOpacity: brightness < 80 ? 0.06 : 0.08,
    bgThreshold: 200,
    matchLighting: false,
    lightingIntensity: 0,
  };

  switch (productType) {
    case 'camiseta':
      base.textureIntensity = 0.09;
      base.featherRadius = 2.5;
      base.shadowBlur = 3;
      break;
    case 'caneca':
      base.fabricTexture = false;
      base.textureIntensity = 0;
      base.shadowBlur = 4;
      base.shadowOpacity = 0.12;
      base.featherRadius = 1;
      break;
    case 'sacola':
      base.textureIntensity = 0.07;
      base.featherRadius = 2;
      base.shadowBlur = 4;
      break;
  }

  return base;
}

// ==========================================
// Utilities
// ==========================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
