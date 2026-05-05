// app/lib/logo-compositor.ts
// Professional logo compositing engine
// Handles: background removal, edge feathering, blend modes, fabric texture simulation,
// perspective distortion, lighting integration, and surface conformity
// Makes logos look PRINTED on products, not pasted

export interface CompositorOptions {
  /** Blend mode for logo integration */
  blendMode?: 'multiply' | 'overlay' | 'soft-light' | 'source-over';
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
  /** Background color to remove (null = auto-detect) */
  bgColor?: { r: number; g: number; b: number } | null;
  /** Perspective: horizontal skew angle in degrees (-15 to 15) */
  perspectiveSkew?: number;
  /** Perspective: vertical tilt in degrees (-10 to 10) */
  perspectiveTilt?: number;
  /** Lighting: match product surface lighting */
  matchLighting?: boolean;
  /** Lighting intensity (0–1) */
  lightingIntensity?: number;
  /** Surface curvature simulation (0–1, for cylindrical products) */
  curvature?: number;
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
  bgColor: null,
  perspectiveSkew: 0,
  perspectiveTilt: 0,
  matchLighting: true,
  lightingIntensity: 0.15,
  curvature: 0,
};

// ==========================================
// Deterministic pseudo-random (seeded)
// ==========================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ==========================================
// Background removal
// ==========================================

/**
 * Remove background from a logo image.
 * Uses multi-sampling for robust background detection.
 * Returns a new canvas with transparent background.
 */
function removeBackground(
  source: HTMLImageElement | HTMLCanvasElement,
  threshold: number,
  explicitBg: { r: number; g: number; b: number } | null,
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Auto-detect background color from corners if not specified
  let bgColor = explicitBg;
  if (!bgColor) {
    bgColor = detectBackgroundColor(data, w, h);
  }

  // Adaptive threshold: increase for near-white/near-black backgrounds
  const bgBrightness = bgColor.r * 0.299 + bgColor.g * 0.587 + bgColor.b * 0.114;
  let effectiveThreshold = threshold;
  if (bgBrightness > 230 || bgBrightness < 25) {
    effectiveThreshold = Math.min(threshold * 1.3, 255);
  }

  // Remove background pixels with alpha feathering at edges
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = colorDistance(r, g, b, bgColor.r, bgColor.g, bgColor.b);

    if (dist < effectiveThreshold * 0.35) {
      // Definitely background → fully transparent
      data[i + 3] = 0;
    } else if (dist < effectiveThreshold) {
      // Edge zone → smooth feathered alpha transition
      const t = (dist - effectiveThreshold * 0.35) / (effectiveThreshold * 0.65);
      // Use smoothstep for natural-looking edges
      const smoothT = t * t * (3 - 2 * t);
      data[i + 3] = Math.round(smoothT * 255);
    }
    // else: foreground pixel, keep as-is
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Auto-detect background color by sampling corners, edges, and center regions
 */
function detectBackgroundColor(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): { r: number; g: number; b: number } {
  const samples: { r: number; g: number; b: number }[] = [];
  const margin = Math.max(2, Math.floor(Math.min(w, h) * 0.03));

  // Sample corners (larger area for robustness)
  for (let dy = 0; dy < margin; dy++) {
    for (let dx = 0; dx < margin; dx++) {
      const positions = [
        [dx, dy], [w - 1 - dx, dy], [dx, h - 1 - dy], [w - 1 - dx, h - 1 - dy],
      ];
      for (const [x, y] of positions) {
        const idx = (y * w + x) * 4;
        samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
      }
    }
  }

  // Cluster samples by color distance
  const clusters: { r: number; g: number; b: number; count: number }[] = [];
  for (const s of samples) {
    let found = false;
    for (const c of clusters) {
      if (colorDistance(s.r, s.g, s.b, c.r, c.g, c.b) < 35) {
        c.r = Math.round((c.r * c.count + s.r) / (c.count + 1));
        c.g = Math.round((c.g * c.count + s.g) / (c.count + 1));
        c.b = Math.round((c.b * c.count + s.b) / (c.count + 1));
        c.count++;
        found = true;
        break;
      }
    }
    if (!found) clusters.push({ ...s, count: 1 });
  }

  clusters.sort((a, b) => b.count - a.count);
  return clusters[0] || { r: 255, g: 255, b: 255 };
}

/**
 * Feather edges of a canvas for smooth blending
 */
function featherEdges(canvas: HTMLCanvasElement, radius: number): void {
  if (radius <= 0) return;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);
  const r = Math.ceil(radius);

  // Pass 1: identify edge pixels
  const isEdge = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (copy[idx + 3] === 0) continue;

      let nearTransparent = false;
      for (let dy = -r; dy <= r && !nearTransparent; dy++) {
        for (let dx = -r; dx <= r && !nearTransparent; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            if (copy[(ny * w + nx) * 4 + 3] < 64) nearTransparent = true;
          }
        }
      }
      if (nearTransparent) isEdge[y * w + x] = 1;
    }
  }

  // Pass 2: blur alpha on edge pixels (Gaussian-like)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (!isEdge[y * w + x]) continue;

      let totalAlpha = 0;
      let totalWeight = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            const weight = Math.max(0, 1 - dist / (r + 1));
            totalAlpha += copy[(ny * w + nx) * 4 + 3] * weight;
            totalWeight += weight;
          }
        }
      }
      data[idx + 3] = Math.round(totalAlpha / totalWeight);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ==========================================
// Texture & Surface
// ==========================================

/**
 * Generate a deterministic fabric/canvas texture pattern
 */
function createFabricTexture(width: number, height: number, intensity: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const rand = seededRandom(width * 31 + height * 17);

  // Create woven fabric pattern with deterministic noise
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Woven pattern: alternating horizontal and vertical fibers
      const hFiber = (y % 4 < 1) ? 1 : 0;
      const vFiber = (x % 4 < 1) ? 1 : 0;
      const weave = (hFiber + vFiber) % 2;

      // Deterministic noise for natural feel
      const noise = (rand() - 0.5) * 0.6;
      const value = Math.round(128 + (weave - 0.5) * 50 + noise * 25);

      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = Math.round(intensity * 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Create a lighting map from the product surface
 * Captures highlights and shadows to make the logo follow the surface lighting
 */
function createLightingMap(
  productCanvas: HTMLCanvasElement | HTMLImageElement,
  targetW: number,
  targetH: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  // Draw product in grayscale to capture surface luminance
  ctx.filter = 'grayscale(100%) contrast(180%) brightness(110%)';
  ctx.drawImage(productCanvas, 0, 0, targetW, targetH);
  ctx.filter = 'none';

  return canvas;
}

/**
 * Apply perspective distortion to a canvas using affine transform
 * Simulates logo wrapping on curved/tilted surfaces
 */
function applyPerspective(
  source: HTMLCanvasElement,
  skewDeg: number,
  tiltDeg: number,
  curvature: number,
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;

  // If no distortion needed, return as-is
  if (Math.abs(skewDeg) < 0.5 && Math.abs(tiltDeg) < 0.5 && curvature < 0.01) {
    return source;
  }

  // Create output canvas with padding for distortion
  const padX = Math.ceil(w * 0.15);
  const padY = Math.ceil(h * 0.15);
  const outW = w + padX * 2;
  const outH = h + padY * 2;

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d')!;

  ctx.save();
  ctx.translate(padX + w / 2, padY + h / 2);

  // Apply skew via shear transform
  const skewRad = (skewDeg * Math.PI) / 180;
  const tiltRad = (tiltDeg * Math.PI) / 180;
  ctx.transform(
    1,
    Math.tan(tiltRad),
    Math.tan(skewRad),
    1,
    0,
    0,
  );

  // Apply curvature simulation via scaling
  if (curvature > 0) {
    // Horizontal compression at edges simulates cylinder wrap
    const scaleX = 1 - curvature * 0.15;
    ctx.scale(scaleX, 1);
  }

  ctx.drawImage(source, -w / 2, -h / 2, w, h);
  ctx.restore();

  // Crop back to original content area (with slight padding)
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = w;
  cropCanvas.height = h;
  const cropCtx = cropCanvas.getContext('2d')!;
  cropCtx.drawImage(out, padX, padY, w, h, 0, 0, w, h);

  return cropCanvas;
}

/**
 * Create a curved highlight overlay for cylindrical products (mugs)
 */
function createCurvatureHighlight(
  width: number,
  height: number,
  curvature: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  if (curvature < 0.01) return canvas;

  // Simulate cylindrical highlight (brighter in center, darker at edges)
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  const darkAlpha = Math.round(curvature * 40);
  grad.addColorStop(0, `rgba(0,0,0,${darkAlpha})`);
  grad.addColorStop(0.3, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, `rgba(255,255,255,${Math.round(curvature * 15)})`);
  grad.addColorStop(0.7, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${darkAlpha})`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  return canvas;
}

// ==========================================
// Main compositing function
// ==========================================

/**
 * Apply the logo onto a product canvas with realistic compositing.
 *
 * Steps:
 * 1. Remove logo background with feathered edges
 * 2. Apply perspective distortion matching product shape
 * 3. Create surface shadow for depth
 * 4. Draw logo with blend mode for material integration
 * 5. Apply fabric texture overlay
 * 6. Match product surface lighting
 * 7. Add subtle highlight for print-like sheen
 *
 * @param productCanvas - The product image
 * @param logoSource - The logo image to composite
 * @param printArea - The bounding box where the logo should be placed
 * @param options - Compositing options
 * @returns The composited canvas (same dimensions as productCanvas)
 */
export function compositeLogo(
  productCanvas: HTMLCanvasElement | HTMLImageElement,
  logoSource: HTMLImageElement | HTMLCanvasElement,
  printArea: { x: number; y: number; width: number; height: number },
  options?: CompositorOptions,
): HTMLCanvasElement {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const pw = productCanvas instanceof HTMLCanvasElement ? productCanvas.width : productCanvas.width;
  const ph = productCanvas instanceof HTMLCanvasElement ? productCanvas.height : productCanvas.height;

  // Output canvas
  const out = document.createElement('canvas');
  out.width = pw;
  out.height = ph;
  const ctx = out.getContext('2d')!;

  // 1. Draw product as base
  ctx.drawImage(productCanvas, 0, 0, pw, ph);

  // 2. Process logo: remove background + feather edges
  let processedLogo = removeBackground(logoSource, opts.bgThreshold, opts.bgColor);
  if (opts.featherRadius > 0) {
    featherEdges(processedLogo, opts.featherRadius);
  }

  // 3. Calculate logo dimensions within print area (max 65% of area with padding)
  const padding = Math.min(printArea.width, printArea.height) * 0.08;
  const availW = printArea.width - padding * 2;
  const availH = printArea.height - padding * 2;
  const maxLogoW = availW * 0.75;
  const maxLogoH = availH * 0.75;
  const logoRatio = processedLogo.width / processedLogo.height;
  let logoW: number, logoH: number;

  if (logoRatio > maxLogoW / maxLogoH) {
    logoW = maxLogoW;
    logoH = logoW / logoRatio;
  } else {
    logoH = maxLogoH;
    logoW = logoH * logoRatio;
  }

  // Ensure minimum size for visibility
  const minSize = Math.min(printArea.width, printArea.height) * 0.15;
  if (logoW < minSize || logoH < minSize) {
    const scale = minSize / Math.min(logoW, logoH);
    logoW *= scale;
    logoH *= scale;
  }

  // Center in print area
  const logoX = printArea.x + (printArea.width - logoW) / 2;
  const logoY = printArea.y + (printArea.height - logoH) / 2;

  // 4. Apply perspective distortion to logo
  const distortedLogo = applyPerspective(
    processedLogo,
    opts.perspectiveSkew,
    opts.perspectiveTilt,
    opts.curvature,
  );

  // 5. Create shadow layer for depth (dark silhouette, not the logo itself)
  if (opts.shadowBlur > 0 && opts.shadowOpacity > 0) {
    // Create a dark silhouette of the logo
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = Math.ceil(logoW);
    shadowCanvas.height = Math.ceil(logoH);
    const sCtx = shadowCanvas.getContext('2d')!;
    sCtx.drawImage(distortedLogo, 0, 0, Math.ceil(logoW), Math.ceil(logoH));

    // Make it dark
    const sData = sCtx.getImageData(0, 0, shadowCanvas.width, shadowCanvas.height);
    for (let i = 0; i < sData.data.length; i += 4) {
      if (sData.data[i + 3] > 0) {
        sData.data[i] = 0;
        sData.data[i + 1] = 0;
        sData.data[i + 2] = 0;
        // Keep original alpha (shape)
      }
    }
    sCtx.putImageData(sData, 0, 0);

    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${opts.shadowOpacity})`;
    ctx.shadowBlur = opts.shadowBlur;
    ctx.shadowOffsetX = Math.max(1, Math.round(logoW * 0.005));
    ctx.shadowOffsetY = Math.max(1, Math.round(logoH * 0.01));
    ctx.globalAlpha = opts.shadowOpacity * 1.5;
    ctx.drawImage(shadowCanvas, logoX, logoY, logoW, logoH);
    ctx.restore();
  }

  // 6. Apply fabric texture under logo area (subtle surface variation)
  if (opts.fabricTexture && opts.textureIntensity > 0) {
    const texture = createFabricTexture(Math.ceil(logoW), Math.ceil(logoH), opts.textureIntensity);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(texture, logoX, logoY, logoW, logoH);
    ctx.restore();
  }

  // 7. Draw the logo with blend mode for realistic material integration
  ctx.save();
  ctx.globalAlpha = opts.opacity;
  ctx.globalCompositeOperation = opts.blendMode;
  ctx.drawImage(distortedLogo, logoX, logoY, logoW, logoH);
  ctx.restore();

  // 8. Apply surface lighting match (logo follows product's light/shadow pattern)
  if (opts.matchLighting && opts.lightingIntensity > 0) {
    const lightMap = createLightingMap(productCanvas, Math.ceil(logoW), Math.ceil(logoH));
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = opts.lightingIntensity;
    ctx.drawImage(lightMap, logoX, logoY, logoW, logoH);
    ctx.restore();
  }

  // 9. Apply curvature highlight for cylindrical products
  if (opts.curvature > 0.01) {
    const highlight = createCurvatureHighlight(Math.ceil(logoW), Math.ceil(logoH), opts.curvature);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.3;
    ctx.drawImage(highlight, logoX, logoY, logoW, logoH);
    ctx.restore();
  }

  // 10. Add subtle highlight overlay for print-like sheen
  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.globalCompositeOperation = 'overlay';
  const sheen = ctx.createLinearGradient(logoX, logoY, logoX + logoW, logoY + logoH);
  sheen.addColorStop(0, 'rgba(255,255,255,0.9)');
  sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.6, 'rgba(0,0,0,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = sheen;
  ctx.fillRect(logoX, logoY, logoW, logoH);
  ctx.restore();

  return out;
}

// ==========================================
// Print area detection
// ==========================================

/**
 * Get optimal print area for a product image.
 * Uses heuristics based on product type.
 */
export function getPrintArea(
  imageWidth: number,
  imageHeight: number,
  productType: 'sacola' | 'camiseta' | 'caneca' | 'default' = 'default',
): { x: number; y: number; width: number; height: number } {
  const areas: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }> = {
    sacola: { xPct: 0.18, yPct: 0.22, wPct: 0.64, hPct: 0.48 },
    camiseta: { xPct: 0.25, yPct: 0.18, wPct: 0.5, hPct: 0.38 },
    caneca: { xPct: 0.22, yPct: 0.2, wPct: 0.56, hPct: 0.55 },
    default: { xPct: 0.18, yPct: 0.22, wPct: 0.64, hPct: 0.48 },
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

  // Choose blend mode based on product brightness
  let blendMode: 'multiply' | 'overlay' | 'soft-light' = 'multiply';
  if (brightness < 80) blendMode = 'overlay';
  else if (brightness < 160) blendMode = 'soft-light';

  const base: CompositorOptions = {
    blendMode,
    opacity: brightness < 80 ? 0.85 : 0.92,
    featherRadius: 2,
    fabricTexture: true,
    textureIntensity: 0.06,
    shadowBlur: 4,
    shadowOpacity: brightness < 80 ? 0.08 : 0.15,
    bgThreshold: 235,
    matchLighting: true,
    lightingIntensity: 0.12,
    curvature: 0,
    perspectiveSkew: 0,
    perspectiveTilt: 0,
  };

  switch (productType) {
    case 'camiseta':
      base.textureIntensity = 0.09;
      base.featherRadius = 2.5;
      base.perspectiveSkew = -2; // Slight fabric drape
      base.shadowBlur = 3;
      base.curvature = 0;
      break;

    case 'caneca':
      base.fabricTexture = false;
      base.textureIntensity = 0;
      base.shadowBlur = 6;
      base.shadowOpacity = 0.22;
      base.featherRadius = 1;
      base.curvature = 0.6; // Cylindrical wrap
      base.perspectiveSkew = 3; // Slight angle
      base.lightingIntensity = 0.18;
      break;

    case 'sacola':
      base.textureIntensity = 0.07;
      base.featherRadius = 2;
      base.perspectiveSkew = -1;
      base.shadowBlur = 4;
      break;
  }

  return base;
}

/**
 * Convenience: composite logo onto product with auto-detected print area
 * and product-type-optimized compositing options.
 */
export function autoCompositeLogo(
  productCanvas: HTMLCanvasElement | HTMLImageElement,
  logoSource: HTMLImageElement | HTMLCanvasElement,
  productType?: 'sacola' | 'camiseta' | 'caneca' | 'default',
  options?: CompositorOptions,
): HTMLCanvasElement {
  const pw = productCanvas instanceof HTMLCanvasElement ? productCanvas.width : productCanvas.width;
  const ph = productCanvas instanceof HTMLCanvasElement ? productCanvas.height : productCanvas.height;
  const printArea = getPrintArea(pw, ph, productType);
  return compositeLogo(productCanvas, logoSource, printArea, options);
}

// ==========================================
// Utilities
// ==========================================

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
