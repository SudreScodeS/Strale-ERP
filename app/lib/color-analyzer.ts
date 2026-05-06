// app/lib/color-analyzer.ts
// Accurate logo color analysis with K-means clustering in LAB color space
//
// PIPELINE:
// 1. Background removal (alpha + white/near-white detection)
// 2. K-means clustering (adaptive K: 2–8) in CIELAB space
// 3. Noise filter: remove clusters with < 2% of foreground pixels
// 4. Merge perceptually similar colors (ΔE < 12 in LAB)
// 5. Return sorted distinct colors with names

import sharp from 'sharp';

// ==========================================
// Types
// ==========================================

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  lab: LabColor;
  pixelFraction: number;
  pixelCount: number;
  name: string;
}

export interface AnalysisResult {
  totalColors: number;
  colors: ColorInfo[];
  backgroundRemoved: boolean;
  method: 'kmeans-lab' | 'fallback';
}

/** Internal pixel representation with both RGB and LAB */
interface Pixel {
  r: number;
  g: number;
  b: number;
  lab: LabColor;
}

// ==========================================
// RGB ↔ CIELAB conversion
// ==========================================

function rgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToLab(r: number, g: number, b: number): LabColor {
  const rl = rgbToLinear(r);
  const gl = rgbToLinear(g);
  const bl = rgbToLinear(b);

  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.00000;
  let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
  x = f(x); y = f(y); z = f(z);

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

/** CIE76 ΔE — perceptual color distance */
function deltaE(c1: LabColor, c2: LabColor): number {
  return Math.sqrt(
    (c1.L - c2.L) ** 2 +
    (c1.a - c2.a) ** 2 +
    (c1.b - c2.b) ** 2,
  );
}

// ==========================================
// Background detection
// ==========================================

function isBackgroundPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 15) return true;
  if (r > 245 && g > 245 && b > 245) return true;

  const brightness = r * 0.299 + g * 0.587 + b * 0.114;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max > 0 ? (max - min) / max : 0;

  if (brightness > 235 && saturation < 0.1) return true;
  return false;
}

// ==========================================
// K-means in LAB space
// ==========================================

function makePixel(r: number, g: number, b: number): Pixel {
  return { r, g, b, lab: rgbToLab(r, g, b) };
}

/**
 * K-means++ initialization — picks diverse starting centers
 */
function kmeansPlusPlusInit(pixels: Pixel[], k: number): Pixel[] {
  const centers: Pixel[] = [];
  const midIdx = Math.floor(pixels.length / 2);
  centers.push(pixels[midIdx]);

  for (let c = 1; c < k; c++) {
    let maxDist = -1;
    let bestIdx = 0;
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      for (const center of centers) {
        const d = deltaE(pixels[i].lab, center.lab);
        if (d < minDist) minDist = d;
      }
      if (minDist > maxDist) {
        maxDist = minDist;
        bestIdx = i;
      }
    }
    centers.push(pixels[bestIdx]);
  }
  return centers;
}

/**
 * K-means clustering in CIELAB space
 */
function kmeansCluster(
  pixels: Pixel[],
  k: number,
  maxIterations: number = 20,
): { centers: Pixel[]; assignments: number[] } {
  if (pixels.length === 0) return { centers: [], assignments: [] };
  if (pixels.length <= k) {
    return { centers: pixels.slice(), assignments: pixels.map((_, i) => i) };
  }

  const centers = kmeansPlusPlusInit(pixels, k);
  const assignments = new Array<number>(pixels.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // Assignment step
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < centers.length; c++) {
        const d = deltaE(pixels[i].lab, centers[c].lab);
        if (d < minDist) { minDist = d; bestCluster = c; }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed) break;

    // Update step — recompute centers as mean of assigned pixels
    const sums = Array.from({ length: k }, () => ({
      r: 0, g: 0, b: 0, labL: 0, labA: 0, labB: 0, count: 0,
    }));

    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i];
      sums[c].r += pixels[i].r;
      sums[c].g += pixels[i].g;
      sums[c].b += pixels[i].b;
      sums[c].labL += pixels[i].lab.L;
      sums[c].labA += pixels[i].lab.a;
      sums[c].labB += pixels[i].lab.b;
      sums[c].count++;
    }

    for (let c = 0; c < k; c++) {
      if (sums[c].count === 0) continue;
      const n = sums[c].count;
      centers[c] = {
        r: Math.round(sums[c].r / n),
        g: Math.round(sums[c].g / n),
        b: Math.round(sums[c].b / n),
        lab: {
          L: sums[c].labL / n,
          a: sums[c].labA / n,
          b: sums[c].labB / n,
        },
      };
    }
  }

  return { centers, assignments };
}

/**
 * Find optimal K using elbow method
 */
function findOptimalK(pixels: Pixel[], maxK: number = 8): number {
  if (pixels.length < 20) return Math.min(2, pixels.length);
  if (pixels.length < 50) return Math.min(3, maxK);

  const inertias: number[] = [];
  const testRange = Math.min(maxK, Math.ceil(pixels.length / 10));

  for (let k = 2; k <= testRange; k++) {
    const { centers, assignments } = kmeansCluster(pixels, k, 15);
    let inertia = 0;
    for (let i = 0; i < pixels.length; i++) {
      inertia += deltaE(pixels[i].lab, centers[assignments[i]].lab) ** 2;
    }
    inertias.push(inertia / pixels.length);
  }

  let bestK = 2;
  let maxImprovement = 0;
  for (let i = 1; i < inertias.length - 1; i++) {
    const improvement = inertias[i - 1] - inertias[i];
    const nextImprovement = i + 1 < inertias.length ? inertias[i] - inertias[i + 1] : 0;
    const relativeGain = nextImprovement > 0 ? improvement / nextImprovement : improvement;
    if (relativeGain > maxImprovement) {
      maxImprovement = relativeGain;
      bestK = i + 2;
    }
  }

  return Math.min(bestK, 8);
}

// ==========================================
// Merge similar colors (ΔE < 12)
// ==========================================

function mergeSimilarColors(colors: ColorInfo[], threshold: number = 12): ColorInfo[] {
  const merged: ColorInfo[] = [];
  const used = new Set<number>();
  const sorted = [...colors].sort((a, b) => b.pixelCount - a.pixelCount);

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    let current = { ...sorted[i] };
    used.add(i);

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;
      if (deltaE(current.lab, sorted[j].lab) < threshold) {
        const totalCount = current.pixelCount + sorted[j].pixelCount;
        const t = sorted[j].pixelCount / totalCount;
        current = {
          ...current,
          rgb: {
            r: Math.round(current.rgb.r * (1 - t) + sorted[j].rgb.r * t),
            g: Math.round(current.rgb.g * (1 - t) + sorted[j].rgb.g * t),
            b: Math.round(current.rgb.b * (1 - t) + sorted[j].rgb.b * t),
          },
          lab: {
            L: current.lab.L * (1 - t) + sorted[j].lab.L * t,
            a: current.lab.a * (1 - t) + sorted[j].lab.a * t,
            b: current.lab.b * (1 - t) + sorted[j].lab.b * t,
          },
          pixelCount: totalCount,
          pixelFraction: 0,
        };
        used.add(j);
      }
    }
    merged.push(current);
  }
  return merged;
}

// ==========================================
// Color naming
// ==========================================

function getColorName(rgb: { r: number; g: number; b: number }): string {
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = r * 0.299 + g * 0.587 + b * 0.114;
  const saturation = max > 0 ? (max - min) / max : 0;

  if (brightness < 30) return 'preto';
  if (brightness > 240 && saturation < 0.08) return 'branco';
  if (saturation < 0.12) {
    if (brightness < 80) return 'cinza escuro';
    if (brightness < 160) return 'cinza';
    return 'cinza claro';
  }

  const hsl = rgbToHsl(r, g, b);
  const h = hsl[0], l = hsl[2];

  if (h < 12 || h >= 348) return l > 60 ? 'vermelho claro' : 'vermelho';
  if (h < 35) return l > 60 ? 'laranja claro' : 'laranja';
  if (h < 65) return l > 60 ? 'amarelo claro' : 'amarelo';
  if (h < 80) return 'amarelo-esverdeado';
  if (h < 160) return l > 60 ? 'verde claro' : 'verde';
  if (h < 190) return 'ciano';
  if (h < 260) return l > 60 ? 'azul claro' : 'azul';
  if (h < 290) return l > 60 ? 'roxo claro' : 'roxo';
  if (h < 330) return l > 60 ? 'rosa claro' : 'rosa';
  return 'magenta';
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

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.min(255, Math.max(0, Math.round(c))).toString(16).padStart(2, '0')).join('');
}

// ==========================================
// Main analysis function
// ==========================================

/**
 * Analyze logo image and return distinct colors.
 *
 * Pipeline:
 * 1. Resize for performance (200px max dimension)
 * 2. Remove background pixels (white, transparent, near-white)
 * 3. Convert foreground pixels to CIELAB
 * 4. K-means clustering (adaptive K: 2–8)
 * 5. Merge clusters with ΔE < 12
 * 6. Filter noise: remove clusters with < 2% of foreground
 * 7. Sort by prominence
 */
export async function analyzeLogoColors(imageBuffer: Buffer): Promise<AnalysisResult> {
  const SIZE = 200;

  const { data, info } = await sharp(imageBuffer)
    .resize(SIZE, SIZE, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // STAGE 1: Extract foreground pixels
  const foregroundPixels: Pixel[] = [];
  let bgCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const a = channels === 4 ? data[idx + 3] : 255;

      if (isBackgroundPixel(r, g, b, a)) { bgCount++; continue; }
      foregroundPixels.push(makePixel(r, g, b));
    }
  }

  const totalPixels = width * height;
  const fgCount = foregroundPixels.length;

  if (fgCount < totalPixels * 0.02) {
    return { totalColors: 0, colors: [], backgroundRemoved: bgCount > 0, method: 'kmeans-lab' };
  }

  // STAGE 2: K-means clustering
  let samplePixels = foregroundPixels;
  const MAX_SAMPLE = 5000;
  if (foregroundPixels.length > MAX_SAMPLE) {
    const step = Math.floor(foregroundPixels.length / MAX_SAMPLE);
    samplePixels = foregroundPixels.filter((_, i) => i % step === 0);
  }

  const optimalK = findOptimalK(samplePixels, 8);
  console.log(`[color-analyzer] K=${optimalK}, samples=${samplePixels.length}, fg=${fgCount}`);

  const { centers, assignments } = kmeansCluster(samplePixels, optimalK, 25);

  // STAGE 3: Build color list from cluster centers
  const clusterCounts = new Array(centers.length).fill(0);
  for (const a of assignments) clusterCounts[a]++;

  let colors: ColorInfo[] = centers
    .map((center, i) => ({
      hex: rgbToHex(center.r, center.g, center.b),
      rgb: { r: center.r, g: center.g, b: center.b },
      lab: center.lab,
      pixelCount: clusterCounts[i],
      pixelFraction: clusterCounts[i] / fgCount,
      name: getColorName({ r: center.r, g: center.g, b: center.b }),
    }))
    .filter(c => c.pixelCount > 0);

  // STAGE 4: Merge perceptually similar colors (ΔE < 12)
  colors = mergeSimilarColors(colors, 12);

  const totalMerged = colors.reduce((sum, c) => sum + c.pixelCount, 0);
  colors.forEach(c => c.pixelFraction = c.pixelCount / totalMerged);

  // STAGE 5: Filter noise (< 2% of foreground)
  colors = colors.filter(c => c.pixelFraction >= 0.02);

  // Re-assign names and hex after merge
  colors = colors.map(c => ({
    ...c,
    name: getColorName(c.rgb),
    hex: rgbToHex(c.rgb.r, c.rgb.g, c.rgb.b),
  }));

  // Sort by prominence, cap at 8
  colors.sort((a, b) => b.pixelCount - a.pixelCount);
  colors = colors.slice(0, 8);

  console.log(`[color-analyzer] Found ${colors.length} colors: ${colors.map(c => c.name).join(', ')}`);

  return { totalColors: colors.length, colors, backgroundRemoved: bgCount > 0, method: 'kmeans-lab' };
}

// ==========================================
// Legacy compatibility wrappers
// ==========================================

export interface LocalColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  pixelFraction: number;
}

export interface LocalAnalysisResult {
  colors: LocalColorInfo[];
  significantColorCount: number;
  complexity: 'simple' | 'moderate' | 'complex';
  description: string;
  productColorHex: string | null;
  productColorRgb: { r: number; g: number; b: number } | null;
}

export async function analyzeColorsLocally(imageBuffer: Buffer): Promise<LocalAnalysisResult> {
  const result = await analyzeLogoColors(imageBuffer);

  const colors: LocalColorInfo[] = result.colors.map(c => ({
    hex: c.hex,
    rgb: c.rgb,
    pixelFraction: c.pixelFraction,
  }));

  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (result.totalColors >= 5) complexity = 'complex';
  else if (result.totalColors >= 2) complexity = 'moderate';

  const colorNames = result.colors.slice(0, 4).map(c => c.name);
  const description = result.totalColors > 0
    ? `${result.totalColors} ${result.totalColors === 1 ? 'cor' : 'cores'} detectada${result.totalColors === 1 ? '' : 's'}: ${colorNames.join(', ')}`
    : 'Nenhuma cor significativa detectada';

  return {
    colors,
    significantColorCount: result.totalColors,
    complexity,
    description,
    productColorHex: null,
    productColorRgb: null,
  };
}

export async function analyzeImageComposition(imageBuffer: Buffer): Promise<{
  logoColors: Array<{ hex: string; rgb: { r: number; g: number; b: number }; pixelFraction: number }>;
  logoColorCount: number;
  productColor: { hex: string; rgb: { r: number; g: number; b: number }; pixelFraction: number } | null;
  productColorHex: string | null;
  allClusters: Array<{
    hex: string; rgb: { r: number; g: number; b: number };
    pixelCount: number; pixelFraction: number; avgX: number; avgY: number; spread: number;
  }>;
  complexity: 'simple' | 'moderate' | 'complex';
  description: string;
}> {
  const result = await analyzeLogoColors(imageBuffer);

  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (result.totalColors >= 5) complexity = 'complex';
  else if (result.totalColors >= 2) complexity = 'moderate';

  const colorNames = result.colors.slice(0, 4).map(c => c.name);
  const description = result.totalColors > 0
    ? `${result.totalColors} ${result.totalColors === 1 ? 'cor' : 'cores'} na logo: ${colorNames.join(', ')}`
    : 'Nenhuma cor detectada';

  return {
    logoColors: result.colors.map(c => ({ hex: c.hex, rgb: c.rgb, pixelFraction: c.pixelFraction })),
    logoColorCount: result.totalColors,
    productColor: null,
    productColorHex: null,
    allClusters: result.colors.map(c => ({
      hex: c.hex, rgb: c.rgb, pixelCount: c.pixelCount,
      pixelFraction: c.pixelFraction, avgX: 0.5, avgY: 0.5, spread: 0.3,
    })),
    complexity,
    description,
  };
}
