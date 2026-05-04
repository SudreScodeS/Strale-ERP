// app/lib/color-analyzer.ts
// Análise local de cores dominantes usando sharp — zero dependência de API externa
// Algoritmo: amostragem de pixels → filtragem de fundo → quantização por bucketing → contagem de cores significativas
// CORRIGIDO: ignora fundo branco, quase-branco, transparente e muito claro

import sharp from 'sharp';

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
}

// Limiar para considerar uma cor "significativa"
const SIGNIFICANT_COLOR_THRESHOLD = 0.03; // 3% dos pixels
// Número de buckets por canal (quantização)
const BUCKET_BITS = 4; // 16 buckets por canal = 4096 cores possíveis
const BUCKET_SIZE = 256 >> BUCKET_BITS; // 16

// Limites para detecção de fundo
const BG_BRIGHTNESS_THRESHOLD = 235; // pixels com brilho >= 235 são considerados fundo claro
const BG_SATURATION_THRESHOLD = 0.08; // pixels com saturação < 8% e brilho alto são fundo
const TRANSPARENT_ALPHA_THRESHOLD = 10; // pixels com alpha < 10 são transparentes

/**
 * Verifica se um pixel deve ser ignorado por ser "fundo".
 * Critérios:
 * - Transparente (alpha muito baixo)
 * - Branco ou quase-branco (brilho >= 235 e baixa saturação)
 * - Cinza claro (baixa saturação + brilho alto)
 */
function isBackgroundPixel(r: number, g: number, b: number, a?: number): boolean {
  // Transparente
  if (a !== undefined && a < TRANSPARENT_ALPHA_THRESHOLD) return true;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = (r * 0.299 + g * 0.587 + b * 0.114); // luminância perceptual
  const saturation = max > 0 ? (max - min) / max : 0;

  // Branco ou quase-branco
  if (brightness >= BG_BRIGHTNESS_THRESHOLD && saturation < BG_SATURATION_THRESHOLD) return true;

  // Muito claro e dessaturado (cinza claro, creme, etc)
  if (brightness >= 240) return true;

  return false;
}

export async function analyzeColorsLocally(imageBuffer: Buffer): Promise<LocalAnalysisResult> {
  // Extrai dados RGBA brutos (com alpha para detectar transparência)
  const { data, info } = await sharp(imageBuffer)
    .resize(200, 200, { fit: 'inside' })
    .ensureAlpha() // Garante canal alpha
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  const channels = info.channels; // 4 para RGBA

  // Conta cores por bucket (quantização), IGNORANDO fundo
  const bucketMap = new Map<string, { r: number; g: number; b: number; count: number }>();
  let backgroundPixels = 0;
  let foregroundPixels = 0;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = channels === 4 ? data[i + 3] : 255;

    // Ignora pixels de fundo
    if (isBackgroundPixel(r, g, b, a)) {
      backgroundPixels++;
      continue;
    }

    foregroundPixels++;

    // Quantiza para reduzir ruído
    const qr = (r >> BUCKET_BITS) * BUCKET_SIZE + (BUCKET_SIZE >> 1);
    const qg = (g >> BUCKET_BITS) * BUCKET_SIZE + (BUCKET_SIZE >> 1);
    const qb = (b >> BUCKET_BITS) * BUCKET_SIZE + (BUCKET_SIZE >> 1);

    const key = `${qr},${qg},${qb}`;
    const existing = bucketMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      bucketMap.set(key, { r: qr, g: qg, b: qb, count: 1 });
    }
  }

  // Se não encontrou pixels de foreground, retorna vazio (imagem toda em branco)
  if (foregroundPixels === 0) {
    return {
      colors: [],
      significantColorCount: 0,
      complexity: 'simple',
      description: 'Logo não possui cores visíveis (fundo transparente ou imagem em branco).',
    };
  }

  // Ordena por frequência e pega as top cores
  const sorted = [...bucketMap.values()].sort((a, b) => b.count - a.count);

  // Calcula fração de pixels RELATIVA AO FOREGROUND (não ao total)
  const colors: LocalColorInfo[] = sorted.slice(0, 16).map((entry) => ({
    hex: `#${entry.r.toString(16).padStart(2, '0')}${entry.g.toString(16).padStart(2, '0')}${entry.b.toString(16).padStart(2, '0')}`,
    rgb: { r: entry.r, g: entry.g, b: entry.b },
    pixelFraction: entry.count / foregroundPixels, // Fração sobre foreground, não total
  }));

  // Conta cores significativas (acima do threshold)
  const significantColors = colors.filter((c) => c.pixelFraction >= SIGNIFICANT_COLOR_THRESHOLD);
  const significantColorCount = Math.max(1, significantColors.length);

  // Determina complexidade
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (significantColorCount >= 5) complexity = 'complex';
  else if (significantColorCount >= 3) complexity = 'moderate';

  // Descrição baseada nas cores encontradas
  const topColorNames = significantColors.slice(0, 3).map((c) => getColorName(c.rgb));
  const description = topColorNames.length > 0
    ? `Logo com ${significantColorCount} ${significantColorCount === 1 ? 'cor dominante' : 'cores dominantes'}: ${topColorNames.join(', ')}`
    : 'Logo analisado — cores da marca identificadas';

  return {
    colors,
    significantColorCount,
    complexity,
    description,
  };
}

// Mapeamento simples de RGB para nome de cor em português
function getColorName(rgb: { r: number; g: number; b: number }): string {
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max > 0 ? (max - min) / max : 0;

  // Preto, cinza
  if (max < 40) return 'preto';
  if (sat < 0.1 && max > 40 && min < 220) return 'cinza';

  // Cores
  if (r > g && r > b) {
    if (g > b + 50) return 'laranja';
    if (b > g) return 'rosa';
    return 'vermelho';
  }
  if (g > r && g > b) {
    if (r > b + 30) return 'amarelo-esverdeado';
    if (b > r) return 'ciano';
    return 'verde';
  }
  if (b > r && b > g) {
    if (r > g + 30) return 'roxo';
    if (g > r) return 'azul-esverdeado';
    return 'azul';
  }
  if (r > 200 && g > 180 && b < 100) return 'amarelo';
  return 'misto';
}
