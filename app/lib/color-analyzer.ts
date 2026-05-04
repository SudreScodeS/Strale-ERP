// app/lib/color-analyzer.ts
// Análise local de cores dominantes usando sharp — zero dependência de API externa
// Algoritmo: amostragem de pixels → quantização por bucketing → contagem de cores significativas
// Usado como fallback quando Google Cloud Vision não está configurado

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

export async function analyzeColorsLocally(imageBuffer: Buffer): Promise<LocalAnalysisResult> {
  // Redimensiona para acelerar análise (max 200px no lado maior)
  // e extrai dados RGB brutos
  const { data, info } = await sharp(imageBuffer)
    .resize(200, 200, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;

  // Conta cores por bucket (quantização)
  const bucketMap = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

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

  // Ordena por frequência e pega as top cores
  const sorted = [...bucketMap.values()].sort((a, b) => b.count - a.count);

  // Calcula fração de pixels
  const colors: LocalColorInfo[] = sorted.slice(0, 16).map((entry) => ({
    hex: `#${entry.r.toString(16).padStart(2, '0')}${entry.g.toString(16).padStart(2, '0')}${entry.b.toString(16).padStart(2, '0')}`,
    rgb: { r: entry.r, g: entry.g, b: entry.b },
    pixelFraction: entry.count / pixelCount,
  }));

  // Conta cores significativas
  const significantColorCount = Math.max(
    1,
    colors.filter((c) => c.pixelFraction >= SIGNIFICANT_COLOR_THRESHOLD).length,
  );

  // Determina complexidade
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (significantColorCount >= 5) complexity = 'complex';
  else if (significantColorCount >= 3) complexity = 'moderate';

  // Descrição baseada nas cores encontradas
  const topColorNames = colors.slice(0, 3).map((c) => getColorName(c.rgb));
  const description = `Logo com ${significantColorCount} ${significantColorCount === 1 ? 'cor dominante' : 'cores dominantes'}: ${topColorNames.join(', ')}`;

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

  // Preto, branco, cinza
  if (max < 40) return 'preto';
  if (min > 220) return 'branco';
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
