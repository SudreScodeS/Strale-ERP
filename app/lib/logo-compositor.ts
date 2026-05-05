// app/lib/logo-compositor.ts
// Professional logo compositing engine
// Handles: background removal, edge feathering, blend modes, fabric texture simulation
// Makes logos look PRINTED on products, not pasted

export interface CompositorOptions {
  /** Blend mode for logo integration */
  blendMode?: 'multiply' | 'overlay' | 'soft-light' | 'normal';
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
};

/**
 * Remove background from a logo image.
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

  // Remove background pixels with alpha feathering at edges
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = colorDistance(r, g, b, bgColor.r, bgColor.g, bgColor.b);

    if (dist < threshold * 0.4) {
      // Definitely background → fully transparent
      data[i + 3] = 0;
    } else if (dist < threshold) {
      // Edge zone → feather alpha for smooth transition
      const alpha = Math.round(((dist - threshold * 0.4) / (threshold * 0.6)) * 255);
      data[i + 3] = Math.min(data[i + 3], alpha);
    }
    // else: foreground pixel, keep as-is
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Auto-detect background color by sampling corners and edges
 */
function detectBackgroundColor(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): { r: number; g: number; b: number } {
  const samples: { r: number; g: number; b: number }[] = [];
  const positions = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], // corners
    [Math.floor(w / 2), 0], [Math.floor(w / 2), h - 1], // top/bottom center
    [0, Math.floor(h / 2)], [w - 1, Math.floor(h / 2)], // left/right center
  ];

  for (const [x, y] of positions) {
    const idx = (y * w + x) * 4;
    samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
  }

  // Find most common color cluster among samples
  const clusters: { r: number; g: number; b: number; count: number }[] = [];
  for (const s of samples) {
    let found = false;
    for (const c of clusters) {
      if (colorDistance(s.r, s.g, s.b, c.r, c.g, c.b) < 40) {
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

  // Simple box blur on alpha channel only
  const r = Math.ceil(radius);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (copy[idx + 3] === 0) continue; // Skip fully transparent

      // Check if this pixel is near a transparent pixel (edge)
      let nearEdge = false;
      for (let dy = -r; dy <= r && !nearEdge; dy++) {
        for (let dx = -r; dx <= r && !nearEdge; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nIdx = (ny * w + nx) * 4;
            if (copy[nIdx + 3] < 128) nearEdge = true;
          }
        }
      }

      if (nearEdge) {
        let totalAlpha = 0;
        let count = 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nIdx = (ny * w + nx) * 4;
              totalAlpha += copy[nIdx + 3];
              count++;
            }
          }
        }
        data[idx + 3] = Math.round(totalAlpha / count);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Generate a subtle fabric/canvas texture pattern
 */
function createFabricTexture(width: number, height: number, intensity: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Create woven fabric pattern
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Woven pattern: alternating horizontal and vertical fibers
      const hFiber = (y % 3 < 1) ? 1 : 0;
      const vFiber = (x % 3 < 1) ? 1 : 0;
      const weave = (hFiber + vFiber) % 2;

      // Add noise for natural feel
      const noise = (Math.random() - 0.5) * 0.5;
      const value = Math.round(128 + (weave - 0.5) * 40 + noise * 20);

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
 * Create a displacement map from the product image for surface conformity
 */
function createSurfaceMap(
  productCanvas: HTMLCanvasElement | HTMLImageElement,
  targetW: number,
  targetH: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  // Draw product in grayscale to capture surface lighting
  ctx.filter = 'grayscale(100%) contrast(150%)';
  ctx.drawImage(productCanvas, 0, 0, targetW, targetH);
  ctx.filter = 'none';

  return canvas;
}

/**
 * Apply the logo onto a product canvas with realistic compositing.
 *
 * @param productCanvas - The product image (canvas or image element)
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

  // 3. Calculate logo dimensions within print area (max 65% of area)
  const maxLogoW = printArea.width * 0.65;
  const maxLogoH = printArea.height * 0.65;
  const logoRatio = processedLogo.width / processedLogo.height;
  let logoW: number, logoH: number;

  if (logoRatio > maxLogoW / maxLogoH) {
    logoW = maxLogoW;
    logoH = logoW / logoRatio;
  } else {
    logoH = maxLogoH;
    logoW = logoH * logoRatio;
  }

  // Center in print area
  const logoX = printArea.x + (printArea.width - logoW) / 2;
  const logoY = printArea.y + (printArea.height - logoH) / 2;

  // 4. Apply fabric texture under logo area (subtle surface variation)
  if (opts.fabricTexture && opts.textureIntensity > 0) {
    const texture = createFabricTexture(Math.ceil(logoW), Math.ceil(logoH), opts.textureIntensity);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(texture, logoX, logoY, logoW, logoH);
    ctx.restore();
  }

  // 5. Apply surface-conforming shadow for depth
  if (opts.shadowBlur > 0 && opts.shadowOpacity > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${opts.shadowOpacity})`;
    ctx.shadowBlur = opts.shadowBlur;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    // Draw a dark silhouette of the logo slightly offset
    ctx.globalAlpha = opts.shadowOpacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(processedLogo, logoX + 1, logoY + 2, logoW, logoH);
    ctx.restore();
  }

  // 6. Draw the logo with blend mode for realistic integration
  ctx.save();
  ctx.globalAlpha = opts.opacity;
  ctx.globalCompositeOperation = opts.blendMode;
  ctx.drawImage(processedLogo, logoX, logoY, logoW, logoH);
  ctx.restore();

  // 7. Add subtle highlight overlay for print-like sheen
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.globalCompositeOperation = 'overlay';
  const highlight = ctx.createLinearGradient(logoX, logoY, logoX + logoW, logoY + logoH);
  highlight.addColorStop(0, 'rgba(255,255,255,0.8)');
  highlight.addColorStop(0.5, 'rgba(255,255,255,0)');
  highlight.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = highlight;
  ctx.fillRect(logoX, logoY, logoW, logoH);
  ctx.restore();

  return out;
}

/**
 * Get optimal print area for a product image.
 * Uses heuristics based on product type and image analysis.
 */
export function getPrintArea(
  imageWidth: number,
  imageHeight: number,
  productType: 'sacola' | 'camiseta' | 'caneca' | 'default' = 'default',
): { x: number; y: number; width: number; height: number } {
  const areas: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }> = {
    sacola: { xPct: 0.2, yPct: 0.25, wPct: 0.6, hPct: 0.45 },
    camiseta: { xPct: 0.25, yPct: 0.2, wPct: 0.5, hPct: 0.35 },
    caneca: { xPct: 0.25, yPct: 0.25, wPct: 0.5, hPct: 0.5 },
    default: { xPct: 0.2, yPct: 0.25, wPct: 0.6, hPct: 0.45 },
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
 * Convenience: composite logo onto product with auto-detected print area.
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

// Utility
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
