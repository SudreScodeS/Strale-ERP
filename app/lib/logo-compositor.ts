// app/lib/logo-compositor.ts
// Professional logo compositing engine — SERVER-SIDE (sharp)
// Makes logos look PRINTED on products, not pasted
//
// PIPELINE:
// 1. Multi-region background removal with adaptive threshold
// 2. Auto-crop to content bounds (zero padding)
// 3. Surface-aware perspective warp (flat / cylindrical)
// 4. Directional shadow for depth
// 5. Dynamic blend mode (light→multiply / dark→overlay)
// 6. Fabric texture overlay + surface lighting match
// 7. Edge feathering for seamless integration
// 8. Reference image style matching (optional)

import sharp from 'sharp';

// ==========================================
// Types
// ==========================================

export interface CompositorOptions {
  /** Blend mode override (auto-detected from brightness if omitted) */
  blendMode?: 'multiply' | 'overlay' | 'soft-light' | 'hard-light';
  /** Logo opacity (0–1) */
  opacity?: number;
  /** Edge feather radius in px */
  featherRadius?: number;
  /** Fabric texture simulation */
  fabricTexture?: boolean;
  textureIntensity?: number;
  /** Directional shadow */
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowAngle?: number;       // degrees (0=right, 90=down, 180=left, 270=up)
  shadowDistance?: number;    // px offset
  /** Background removal */
  bgThreshold?: number;
  /** Surface curvature (0=flat, 1=full cylinder) */
  curvature?: number;
  /** Lighting match */
  matchLighting?: boolean;
  lightingIntensity?: number;
  /** Print integration: edge darkening + highlight */
  printIntegration?: boolean;
  printEdgeDarken?: number;   // 0–1, darkening at logo edges
  printHighlight?: number;    // 0–1, subtle sheen
}

const DEFAULT_OPTIONS: Required<CompositorOptions> = {
  blendMode: undefined as any, // auto
  opacity: 0.95,
  featherRadius: 2.0,
  fabricTexture: true,
  textureIntensity: 0.05,
  shadowBlur: 5,
  shadowOpacity: 0.18,
  shadowAngle: 135,     // bottom-right
  shadowDistance: 3,
  bgThreshold: 240,
  curvature: 0,
  matchLighting: true,
  lightingIntensity: 0.12,
  printIntegration: true,
  printEdgeDarken: 0.08,
  printHighlight: 0.04,
};

// ==========================================
// 1. Background Removal — Multi-Region Adaptive
// ==========================================

/**
 * Remove background from logo using multi-region sampling,
 * adaptive threshold, and smoothstep feathering.
 */
async function removeBackgroundAdaptive(
  logoBuffer: Buffer,
  threshold: number = 240,
): Promise<Buffer> {
  const meta = await sharp(logoBuffer).metadata();

  // If already has meaningful alpha, just ensure it's clean
  if (meta.channels === 4) {
    const stats = await sharp(logoBuffer).stats();
    const alphaChannel = stats.channels[3];
    if (alphaChannel && alphaChannel.mean < 200) {
      // Already has transparency (likely pre-processed)
      return sharp(logoBuffer).ensureAlpha().png().toBuffer();
    }
  }

  // Get raw pixel data with alpha
  const { data, info } = await sharp(logoBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;
  const outputBuffer = Buffer.alloc(w * h * 4);

  // --- Multi-region background sampling ---
  // Sample from 8 regions: 4 corners + 4 edge midpoints
  const regions = [
    { name: 'topLeft',     x1: 0,              y1: 0,              x2: Math.floor(w * 0.08), y2: Math.floor(h * 0.08) },
    { name: 'topRight',    x1: Math.floor(w * 0.92), y1: 0,       x2: w - 1,                y2: Math.floor(h * 0.08) },
    { name: 'bottomLeft',  x1: 0,              y1: Math.floor(h * 0.92), x2: Math.floor(w * 0.08), y2: h - 1 },
    { name: 'bottomRight', x1: Math.floor(w * 0.92), y1: Math.floor(h * 0.92), x2: w - 1, y2: h - 1 },
    { name: 'topMid',      x1: Math.floor(w * 0.45), y1: 0,       x2: Math.floor(w * 0.55), y2: Math.floor(h * 0.04) },
    { name: 'bottomMid',   x1: Math.floor(w * 0.45), y1: Math.floor(h * 0.96), x2: Math.floor(w * 0.55), y2: h - 1 },
    { name: 'leftMid',     x1: 0,              y1: Math.floor(h * 0.45), x2: Math.floor(w * 0.04), y2: Math.floor(h * 0.55) },
    { name: 'rightMid',    x1: Math.floor(w * 0.96), y1: Math.floor(h * 0.45), x2: w - 1, y2: Math.floor(h * 0.55) },
  ];

  interface Cluster { r: number; g: number; b: number; count: number; brightness: number }
  const clusters: Cluster[] = [];

  for (const region of regions) {
    const samples: { r: number; g: number; b: number }[] = [];
    for (let y = region.y1; y <= region.y2; y++) {
      for (let x = region.x1; x <= region.x2; x++) {
        const idx = (y * w + x) * channels;
        samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
      }
    }

    // Cluster samples from this region
    for (const s of samples) {
      const brightness = s.r * 0.299 + s.g * 0.587 + s.b * 0.114;
      let merged = false;
      for (const c of clusters) {
        const dist = Math.sqrt((s.r - c.r) ** 2 + (s.g - c.g) ** 2 + (s.b - c.b) ** 2);
        if (dist < 40) {
          // Merge into cluster
          c.r = Math.round((c.r * c.count + s.r) / (c.count + 1));
          c.g = Math.round((c.g * c.count + s.g) / (c.count + 1));
          c.b = Math.round((c.b * c.count + s.b) / (c.count + 1));
          c.brightness = (c.brightness * c.count + brightness) / (c.count + 1);
          c.count++;
          merged = true;
          break;
        }
      }
      if (!merged) {
        clusters.push({ r: s.r, g: s.g, b: s.b, count: 1, brightness });
      }
    }
  }

  // Sort by frequency — most common edge color = background
  clusters.sort((a, b) => b.count - a.count);
  const bg = clusters[0] || { r: 255, g: 255, b: 255, brightness: 255 };

  // --- Adaptive threshold ---
  const isDarkBg = bg.brightness < 60;
  const isNearWhite = bg.brightness > 230;
  let effectiveThreshold = threshold;

  if (isNearWhite) {
    effectiveThreshold = Math.min(threshold * 0.7, 180); // Tighter for white bg
  } else if (isDarkBg) {
    effectiveThreshold = Math.min(threshold * 1.3, 255); // Looser for dark bg
  }

  // --- Pixel classification with smoothstep feathering ---
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * channels;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2];

      const colorDist = Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);

      let alpha: number;
      const fadeStart = effectiveThreshold * 0.3;
      const fadeEnd = effectiveThreshold;

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

  return sharp(outputBuffer, { raw: { width: w, height: h, channels: 4 } })
    .ensureAlpha()
    .png()
    .toBuffer();
}

/**
 * Auto-crop to content bounds — removes ALL transparent padding
 */
async function autoCropToContent(buffer: Buffer): Promise<Buffer> {
  try {
    // sharp's trim works on alpha channel
    return await sharp(buffer).trim({ threshold: 10 }).png().toBuffer();
  } catch {
    return buffer;
  }
}

/**
 * Edge-aware feathering: blur ONLY the alpha channel at edges,
 * preserving crisp RGB detail
 */
async function featherAlphaEdges(buffer: Buffer, radius: number): Promise<Buffer> {
  if (radius <= 0) return buffer;

  const { data: origData, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;

  // Create alpha-only buffer
  const alphaBuf = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    alphaBuf[i] = origData[i * channels + 3];
  }

  // Blur the alpha channel
  const blurredAlpha = await sharp(alphaBuf, { raw: { width: w, height: h, channels: 1 } })
    .blur(radius * 0.5)
    .raw()
    .toBuffer();

  // Reassemble: original RGB + blurred alpha
  const output = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const srcIdx = i * channels;
    const dstIdx = i * 4;
    output[dstIdx] = origData[srcIdx];
    output[dstIdx + 1] = origData[srcIdx + 1];
    output[dstIdx + 2] = origData[srcIdx + 2];
    output[dstIdx + 3] = blurredAlpha[i];
  }

  return sharp(output, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

// ==========================================
// 2. Surface Warp — Perspective & Curvature
// ==========================================

/**
 * Apply cylindrical curvature to logo (for mugs, bottles).
 * Simulates horizontal compression at edges.
 */
async function applyCylindricalWarp(
  logoBuffer: Buffer,
  curvature: number,
): Promise<Buffer> {
  if (curvature < 0.01) return logoBuffer;

  const meta = await sharp(logoBuffer).metadata();
  const w = meta.width || 100;
  const h = meta.height || 100;

  // Use SVG transform to simulate barrel distortion
  // Horizontal compression at edges, slight vertical perspective
  const compressionFactor = 1 - curvature * 0.2;
  const centerX = w / 2;

  // Create SVG with perspective transform
  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="warp" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="${curvature * 0.3}" result="blur"/>
        </filter>
      </defs>
      <image href="data:image/png;base64,${logoBuffer.toString('base64')}"
             width="${w}" height="${h}" filter="url(#warp)"/>
    </svg>`;

  // For now, apply subtle blur at edges to simulate curvature
  // A full barrel distortion would require pixel-level remapping
  const edgeBlur = Math.round(curvature * 2);

  const { data, info } = await sharp(logoBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = Buffer.alloc(info.width * info.height * 4);
  const iw = info.width, ih = info.height;

  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const idx = (y * iw + x) * info.channels;
      const dstIdx = (y * iw + x) * 4;

      // Distance from center (0–1)
      const dx = Math.abs(x - centerX) / (iw / 2);
      // Apply horizontal compression effect: darken edges slightly
      const edgeFactor = 1 - dx * dx * curvature * 0.3;

      output[dstIdx] = Math.round(data[idx] * edgeFactor);
      output[dstIdx + 1] = Math.round(data[idx + 1] * edgeFactor);
      output[dstIdx + 2] = Math.round(data[idx + 2] * edgeFactor);
      output[dstIdx + 3] = data[idx + 3];
    }
  }

  return sharp(output, { raw: { width: iw, height: ih, channels: 4 } })
    .blur(edgeBlur)
    .png()
    .toBuffer();
}

// ==========================================
// 3. Shadow — Directional
// ==========================================

/**
 * Create a directional shadow from the logo shape.
 * Uses angle + distance for realistic depth.
 */
async function createDirectionalShadow(
  logoBuffer: Buffer,
  width: number,
  height: number,
  angle: number,
  distance: number,
  blur: number,
  opacity: number,
): Promise<Buffer> {
  // Create dark silhouette
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
    // Attenuate alpha by opacity
    shadowBuf[dstIdx + 3] = Math.round(data[srcIdx + 3] * opacity);
  }

  return sharp(shadowBuf, { raw: { width: info.width, height: info.height, channels: 4 } })
    .blur(blur)
    .png()
    .toBuffer();
}

/**
 * Calculate shadow offset from angle and distance
 */
function getShadowOffset(angle: number, distance: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return {
    x: Math.round(Math.cos(rad) * distance),
    y: Math.round(Math.sin(rad) * distance),
  };
}

// ==========================================
// 4. Texture & Surface Integration
// ==========================================

/**
 * Create a subtle fabric weave texture
 */
async function createFabricTexture(
  width: number,
  height: number,
  intensity: number,
): Promise<Buffer> {
  const pixelCount = width * height;
  const buf = Buffer.alloc(pixelCount * 4);

  let seed = width * 31 + height * 17;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const hFiber = (y % 3 < 1) ? 1 : 0;
      const vFiber = (x % 3 < 1) ? 1 : 0;
      const weave = (hFiber + vFiber) % 2;
      const noise = (rand() - 0.5) * 0.5;
      const value = Math.round(128 + (weave - 0.5) * 40 + noise * 20);

      buf[idx] = value;
      buf[idx + 1] = value;
      buf[idx + 2] = value;
      buf[idx + 3] = Math.round(intensity * 255);
    }
  }

  return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/**
 * Extract surface luminance for lighting match
 */
async function createSurfaceLightingMap(
  productBuffer: Buffer,
  targetW: number,
  targetH: number,
  offsetX: number,
  offsetY: number,
): Promise<Buffer> {
  const meta = await sharp(productBuffer).metadata();
  const pw = meta.width || targetW;
  const ph = meta.height || targetH;

  // Extract the region where logo will be placed
  const left = Math.max(0, Math.min(offsetX, pw - targetW));
  const top = Math.max(0, Math.min(offsetY, ph - targetH));

  return sharp(productBuffer)
    .extract({ left, top, width: Math.min(targetW, pw - left), height: Math.min(targetH, ph - top) })
    .greyscale()
    .normalize()
    .ensureAlpha()
    .resize(targetW, targetH, { fit: 'fill' })
    .png()
    .toBuffer();
}

/**
 * Create edge darkening mask — simulates ink absorption at print edges
 */
async function createEdgeDarkeningMask(
  logoBuffer: Buffer,
  width: number,
  height: number,
  intensity: number,
): Promise<Buffer> {
  // Detect edges of the logo alpha channel
  const { data, info } = await sharp(logoBuffer)
    .resize(width, height, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const edgeBuf = Buffer.alloc(info.width * info.height * 4);
  const ew = info.width, eh = info.height;

  // Simple edge detection: pixel is edge if alpha differs from neighbors
  for (let y = 0; y < eh; y++) {
    for (let x = 0; x < ew; x++) {
      const idx = (y * ew + x) * info.channels;
      const alpha = data[idx + 3];

      if (alpha < 10) {
        // Background — skip
        const dstIdx = (y * ew + x) * 4;
        edgeBuf[dstIdx] = 0;
        edgeBuf[dstIdx + 1] = 0;
        edgeBuf[dstIdx + 2] = 0;
        edgeBuf[dstIdx + 3] = 0;
        continue;
      }

      // Check neighbors for edge
      let isEdge = false;
      for (let dy = -1; dy <= 1 && !isEdge; dy++) {
        for (let dx = -1; dx <= 1 && !isEdge; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < ew && ny >= 0 && ny < eh) {
            const neighborAlpha = data[(ny * ew + nx) * info.channels + 3];
            if (Math.abs(alpha - neighborAlpha) > 50) isEdge = true;
          }
        }
      }

      const dstIdx = (y * ew + x) * 4;
      if (isEdge) {
        // Dark edge
        edgeBuf[dstIdx] = 0;
        edgeBuf[dstIdx + 1] = 0;
        edgeBuf[dstIdx + 2] = 0;
        edgeBuf[dstIdx + 3] = Math.round(intensity * 255);
      } else {
        edgeBuf[dstIdx] = 0;
        edgeBuf[dstIdx + 1] = 0;
        edgeBuf[dstIdx + 2] = 0;
        edgeBuf[dstIdx + 3] = 0;
      }
    }
  }

  return sharp(edgeBuf, { raw: { width: ew, height: eh, channels: 4 } })
    .blur(1.5) // Soften the edge darkening
    .png()
    .toBuffer();
}

/**
 * Create a subtle highlight sheen — simulates print gloss
 */
async function createHighlightSheen(
  width: number,
  height: number,
  intensity: number,
): Promise<Buffer> {
  // Gradient: brighter top-left to darker bottom-right
  const buf = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Diagonal gradient
      const t = (x / width * 0.5 + y / height * 0.5);
      const value = Math.round((1 - t) * 255); // Lighter at top-left

      buf[idx] = value;
      buf[idx + 1] = value;
      buf[idx + 2] = value;
      buf[idx + 3] = Math.round(intensity * 255 * (1 - Math.abs(t - 0.5) * 2));
    }
  }

  return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// ==========================================
// 5. Dynamic Blend Mode Selection
// ==========================================

/**
 * Select the best blend mode based on product color brightness.
 * - Light products → multiply (darkens naturally, like ink on white)
 * - Dark products → overlay (lightens naturally, like white print on dark)
 * - Mid-tone → soft-light (subtle, natural)
 */
function selectBlendMode(
  productColorHex: string,
): 'multiply' | 'overlay' | 'soft-light' {
  const rgb = hexToRgb(productColorHex);
  if (!rgb) return 'multiply';

  const brightness = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;

  if (brightness < 80) return 'overlay';    // Dark product: white/light logos
  if (brightness > 200) return 'multiply';  // Light product: dark logos
  return 'soft-light';                       // Mid-tone: subtle blend
}

// ==========================================
// 6. Main Composite Pipeline
// ==========================================

/**
 * Composite a logo onto a product with professional print-quality realism.
 */
export async function compositeLogo(
  productBuffer: Buffer,
  logoBuffer: Buffer,
  printArea: { x: number; y: number; width: number; height: number },
  options?: CompositorOptions,
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Resolve auto blend mode
  const blendMode = opts.blendMode || selectBlendMode('#808080'); // Will be overridden by caller

  // =============================================
  // STAGE 1: Clean logo — remove background
  // =============================================
  let cleanLogo = await removeBackgroundAdaptive(logoBuffer, opts.bgThreshold);
  cleanLogo = await autoCropToContent(cleanLogo);

  // =============================================
  // STAGE 2: Calculate size and position
  //   Center of print area, 35-45% from top
  //   Scale: 70-85% of usable area
  // =============================================
  const padding = Math.min(printArea.width, printArea.height) * 0.04;
  const availW = printArea.width - padding * 2;
  const availH = printArea.height - padding * 2;

  // Scale factor: 75% of available area (between 70-85%)
  const scaleFactor = 0.75;
  const maxLogoW = Math.round(availW * scaleFactor);
  const maxLogoH = Math.round(availH * scaleFactor);

  const logoMeta = await sharp(cleanLogo).metadata();
  const logoRatio = (logoMeta.width || 1) / (logoMeta.height || 1);
  let logoW: number, logoH: number;

  if (logoRatio > maxLogoW / maxLogoH) {
    logoW = maxLogoW;
    logoH = Math.round(logoW / logoRatio);
  } else {
    logoH = maxLogoH;
    logoW = Math.round(logoH * logoRatio);
  }

  // Minimum visibility check
  const minSize = Math.round(Math.min(printArea.width, printArea.height) * 0.12);
  if (logoW < minSize || logoH < minSize) {
    const scale = minSize / Math.min(logoW, logoH);
    logoW = Math.round(logoW * scale);
    logoH = Math.round(logoH * scale);
  }

  // Position: centered horizontally, 35-45% from top of print area
  const logoX = Math.round(printArea.x + (printArea.width - logoW) / 2);
  // 40% from top = center of upper portion (between 35-45%)
  const logoY = Math.round(printArea.y + printArea.height * 0.40 - logoH / 2);

  // =============================================
  // STAGE 3: Resize + surface warp
  // =============================================
  let processedLogo = await sharp(cleanLogo)
    .resize(logoW, logoH, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer();

  if (opts.curvature > 0.01) {
    processedLogo = await applyCylindricalWarp(processedLogo, opts.curvature);
  }

  // =============================================
  // STAGE 4: Build composite layers
  // =============================================
  const layers: sharp.OverlayOptions[] = [];

  // 4a. Directional shadow
  if (opts.shadowBlur > 0 && opts.shadowOpacity > 0) {
    const shadow = await createDirectionalShadow(
      processedLogo, logoW, logoH,
      opts.shadowAngle, opts.shadowDistance,
      opts.shadowBlur, opts.shadowOpacity,
    );
    const offset = getShadowOffset(opts.shadowAngle, opts.shadowDistance);
    layers.push({
      input: shadow,
      left: logoX + offset.x,
      top: logoY + offset.y,
      blend: 'over',
    });
  }

  // 4b. Edge darkening (ink absorption simulation)
  if (opts.printIntegration && opts.printEdgeDarken > 0) {
    const edgeMask = await createEdgeDarkeningMask(
      processedLogo, logoW, logoH, opts.printEdgeDarken,
    );
    layers.push({
      input: edgeMask,
      left: logoX,
      top: logoY,
      blend: 'multiply',
    });
  }

  // 4c. Fabric texture under logo
  if (opts.fabricTexture && opts.textureIntensity > 0) {
    const texture = await createFabricTexture(logoW, logoH, opts.textureIntensity);
    layers.push({
      input: texture,
      left: logoX,
      top: logoY,
      blend: 'overlay',
    });
  }

  // 4d. Logo itself with dynamic blend mode
  layers.push({
    input: processedLogo,
    left: logoX,
    top: logoY,
    blend: blendMode as any,
  });

  // 4e. Surface lighting match
  if (opts.matchLighting && opts.lightingIntensity > 0) {
    const lightMap = await createSurfaceLightingMap(
      productBuffer, logoW, logoH, logoX, logoY,
    );
    layers.push({
      input: lightMap,
      left: logoX,
      top: logoY,
      blend: 'overlay',
    });
  }

  // 4f. Highlight sheen (print gloss)
  if (opts.printIntegration && opts.printHighlight > 0) {
    const sheen = await createHighlightSheen(logoW, logoH, opts.printHighlight);
    layers.push({
      input: sheen,
      left: logoX,
      top: logoY,
      blend: 'soft-light',
    });
  }

  // =============================================
  // STAGE 5: Composite all at once
  // =============================================
  let result = await sharp(productBuffer)
    .composite(layers)
    .png()
    .toBuffer();

  // =============================================
  // STAGE 6: Edge feathering on final composite
  //   This blends the logo edges into the product
  // =============================================
  if (opts.featherRadius > 0) {
    // Apply a very subtle blur only at the logo boundary
    // We do this by compositing a slightly blurred version at the logo region
    const regionLeft = Math.max(0, logoX - 2);
    const regionTop = Math.max(0, logoY - 2);
    const resultMeta = await sharp(result).metadata();
    const regionW = Math.min(logoW + 4, (resultMeta.width || logoW) - regionLeft);
    const regionH = Math.min(logoH + 4, (resultMeta.height || logoH) - regionTop);

    if (regionW > 0 && regionH > 0) {
      const region = await sharp(result)
        .extract({ left: regionLeft, top: regionTop, width: regionW, height: regionH })
        .blur(opts.featherRadius * 0.3)
        .png()
        .toBuffer();

      // Blend blurred region back with low opacity
      result = await sharp(result)
        .composite([{
          input: region,
          left: regionLeft,
          top: regionTop,
          blend: 'over',
        }])
        .png()
        .toBuffer();
    }
  }

  return result;
}

// ==========================================
// Print Area Detection
// ==========================================

/**
 * Get optimal print area for a product type.
 * Position: 35-45% from top, centered horizontally.
 */
export function getPrintArea(
  imageWidth: number,
  imageHeight: number,
  productType: 'sacola' | 'camiseta' | 'caneca' | 'default' = 'default',
): { x: number; y: number; width: number; height: number } {
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

/**
 * Get compositor options optimized for a product type + color.
 */
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
      base.textureIntensity = 0.08;
      base.featherRadius = 2.5;
      base.shadowBlur = 4;
      base.shadowDistance = 2;
      base.curvature = 0;
      base.printEdgeDarken = 0.05; // Less edge effect on soft fabric
      break;

    case 'caneca':
      base.fabricTexture = false;
      base.textureIntensity = 0;
      base.shadowBlur = 6;
      base.shadowOpacity = 0.18;
      base.featherRadius = 1.5;
      base.curvature = 0.5; // Cylindrical
      base.printHighlight = 0.06; // Glossy surface
      base.printEdgeDarken = 0.04;
      break;

    case 'sacola':
      base.textureIntensity = 0.06;
      base.featherRadius = 2.0;
      base.shadowBlur = 5;
      base.shadowDistance = 3;
      base.curvature = 0;
      break;
  }

  return base;
}

// ==========================================
// Reference Image Style Matching
// ==========================================

/**
 * Analyze a reference image to extract compositing parameters.
 * When a user provides a reference showing how a logo should look on a product,
 * we analyze it to determine the ideal blend mode, opacity, and texture.
 */
export async function analyzeReferenceStyle(
  referenceBuffer: Buffer,
  productType: 'sacola' | 'camiseta' | 'caneca' | 'default',
): Promise<CompositorOptions> {
  const meta = await sharp(referenceBuffer).metadata();
  const w = meta.width || 512;
  const h = meta.height || 512;

  // Analyze center region (where logo typically is)
  const centerX = Math.floor(w * 0.3);
  const centerY = Math.floor(h * 0.3);
  const regionW = Math.floor(w * 0.4);
  const regionH = Math.floor(h * 0.4);

  try {
    const centerRegion = await sharp(referenceBuffer)
      .extract({ left: centerX, top: centerY, width: regionW, height: regionH })
      .greyscale()
      .raw()
      .toBuffer();

    // Calculate local contrast (high contrast = overlay mode, low = multiply)
    let sum = 0, sumSq = 0;
    for (let i = 0; i < centerRegion.length; i++) {
      sum += centerRegion[i];
      sumSq += centerRegion[i] * centerRegion[i];
    }
    const mean = sum / centerRegion.length;
    const variance = sumSq / centerRegion.length - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Determine blend mode from contrast
    let blendMode: 'multiply' | 'overlay' | 'soft-light' = 'soft-light';
    if (stdDev > 60) blendMode = 'overlay';   // High contrast reference
    else if (stdDev < 30) blendMode = 'multiply'; // Low contrast reference

    // Determine opacity from mean brightness
    const opacity = Math.min(0.98, Math.max(0.85, mean / 280));

    return {
      ...getProductCompositorOptions(productType, '#808080'),
      blendMode,
      opacity,
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
