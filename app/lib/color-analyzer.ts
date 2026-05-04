// app/lib/color-analyzer.ts
// Análise INTELIGENTE de imagem: separa PRODUTO (ex: sacola) de LOGO (ex: texto/elementos)
// Usa análise espacial — pixels grandes e uniformes = produto, pixels pequenos/dispersos = logo
// Retorna cores do produto e cores da logo SEPARADAMENTE

import sharp from 'sharp';

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  pixelFraction: number;
}

export interface SpatialColorCluster {
  hex: string;
  rgb: { r: number; g: number; b: number };
  pixelCount: number;
  pixelFraction: number;
  avgX: number; // Posição média X normalizada (0-1)
  avgY: number; // Posição média Y normalizada (0-1)
  spread: number; // Quão disperso está (0=concentrado, 1=muito espalhado)
}

export interface ImageAnalysisResult {
  // Cores da LOGO (elementos menores, texto, ícones)
  logoColors: ColorInfo[];
  logoColorCount: number;

  // Cor principal do PRODUTO (sacola, camiseta, etc)
  productColor: ColorInfo | null;
  productColorHex: string | null;

  // Todos os clusters encontrados (para debug/exibição)
  allClusters: SpatialColorCluster[];

  // Metadados
  complexity: 'simple' | 'moderate' | 'complex';
  description: string;
}

// Configurações de análise
const BUCKET_BITS = 4;
const BUCKET_SIZE = 256 >> BUCKET_BITS;
const MIN_CLUSTER_FRACTION = 0.01; // Mínimo 1% dos pixels foreground
const LOGO_MAX_FRACTION = 0.45; // Logo não pode ter mais que 45% do foreground
const PRODUCT_MIN_FRACTION = 0.25; // Produto precisa ter pelo menos 25% do foreground
const BG_BRIGHTNESS_THRESHOLD = 235;
const TRANSPARENT_ALPHA_THRESHOLD = 10;

/**
 * Verifica se um pixel é fundo (branco, transparente, cinza claro)
 */
function isBackgroundPixel(r: number, g: number, b: number, a?: number): boolean {
  if (a !== undefined && a < TRANSPARENT_ALPHA_THRESHOLD) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = r * 0.299 + g * 0.587 + b * 0.114;
  const saturation = max > 0 ? (max - min) / max : 0;
  if (brightness >= BG_BRIGHTNESS_THRESHOLD && saturation < 0.08) return true;
  if (brightness >= 240) return true;
  return false;
}

/**
 * Distância euclidiana entre duas cores RGB
 */
function colorDistance(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number {
  return Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);
}

/**
 * Agrupa buckets de cores similares (merge clusters próximos)
 */
function mergeSimilarClusters(
  clusters: SpatialColorCluster[],
  threshold: number = 45,
): SpatialColorCluster[] {
  const merged: SpatialColorCluster[] = [];
  const used = new Set<number>();

  for (let i = 0; i < clusters.length; i++) {
    if (used.has(i)) continue;

    let current = { ...clusters[i] };
    used.add(i);

    for (let j = i + 1; j < clusters.length; j++) {
      if (used.has(j)) continue;
      if (colorDistance(current.rgb, clusters[j].rgb) < threshold) {
        // Merge: pondera pela contagem de pixels
        const totalCount = current.pixelCount + clusters[j].pixelCount;
        current = {
          ...current,
          rgb: {
            r: Math.round((current.rgb.r * current.pixelCount + clusters[j].rgb.r * clusters[j].pixelCount) / totalCount),
            g: Math.round((current.rgb.g * current.pixelCount + clusters[j].rgb.g * clusters[j].pixelCount) / totalCount),
            b: Math.round((current.rgb.b * current.pixelCount + clusters[j].rgb.b * clusters[j].pixelCount) / totalCount),
          },
          pixelCount: totalCount,
          avgX: (current.avgX * current.pixelCount + clusters[j].avgX * clusters[j].pixelCount) / totalCount,
          avgY: (current.avgY * current.pixelCount + clusters[j].avgY * clusters[j].pixelCount) / totalCount,
          pixelFraction: 0, // Recalculado depois
          spread: Math.max(current.spread, clusters[j].spread),
        };
        used.add(j);
      }
    }

    merged.push(current);
  }

  return merged;
}

/**
 * Calcula o "spread" (dispersão espacial) de um cluster.
 * Se os pixels estão todos juntos → spread baixo (logo/texto).
 * Se estão espalhados pela imagem → spread alto (produto/fundo).
 */
function calculateSpread(
  data: Buffer,
  channels: number,
  width: number,
  height: number,
  targetRgb: { r: number; g: number; b: number },
  tolerance: number = 40,
): { spread: number; avgX: number; avgY: number; count: number } {
  let sumX = 0, sumY = 0, count = 0;
  const positions: { x: number; y: number }[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (colorDistance({ r, g, b }, targetRgb) < tolerance) {
        sumX += x;
        sumY += y;
        positions.push({ x, y });
        count++;
      }
    }
  }

  if (count === 0) return { spread: 0, avgX: 0.5, avgY: 0.5, count: 0 };

  const avgX = sumX / count / width;
  const avgY = sumY / count / height;

  // Calcula desvio padrão normalizado
  let sumDistSq = 0;
  for (const pos of positions) {
    const dx = pos.x / width - avgX;
    const dy = pos.y / height - avgY;
    sumDistSq += dx * dx + dy * dy;
  }
  const stdDev = Math.sqrt(sumDistSq / count);
  const spread = Math.min(1, stdDev * 3); // Normaliza 0-1

  return { spread, avgX, avgY, count };
}

/**
 * Análise principal: separa PRODUTO de LOGO na imagem
 *
 * Lógica:
 * 1. Remove fundo (branco/transparente)
 * 2. Quantiza cores em buckets
 * 3. Merge clusters similares
 * 4. Classifica:
 *    - Maior cluster uniforme = PRODUTO (ex: cor da sacola)
 *    - Clusters menores e concentrados = LOGO (ex: texto colorido)
 *    - Clusters muito espalhados podem ser produto alternativo
 */
export async function analyzeImageComposition(imageBuffer: Buffer): Promise<ImageAnalysisResult> {
  const SIZE = 250;
  const { data, info } = await sharp(imageBuffer)
    .resize(SIZE, SIZE, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixelCount = width * height;

  // === FASE 1: Coleta pixels de foreground ===
  const bucketMap = new Map<string, { r: number; g: number; b: number; count: number; sumX: number; sumY: number }>();
  let fgCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = channels === 4 ? data[idx + 3] : 255;

      if (isBackgroundPixel(r, g, b, a)) continue;
      fgCount++;

      const qr = (r >> BUCKET_BITS) * BUCKET_SIZE + (BUCKET_SIZE >> 1);
      const qg = (g >> BUCKET_BITS) * BUCKET_SIZE + (BUCKET_SIZE >> 1);
      const qb = (b >> BUCKET_BITS) * BUCKET_SIZE + (BUCKET_SIZE >> 1);
      const key = `${qr},${qg},${qb}`;

      const existing = bucketMap.get(key);
      if (existing) {
        existing.count++;
        existing.sumX += x;
        existing.sumY += y;
      } else {
        bucketMap.set(key, { r: qr, g: qg, b: qb, count: 1, sumX: x, sumY: y });
      }
    }
  }

  if (fgCount === 0) {
    return {
      logoColors: [],
      logoColorCount: 0,
      productColor: null,
      productColorHex: null,
      allClusters: [],
      complexity: 'simple',
      description: 'Imagem sem conteúdo visível (fundo transparente ou em branco).',
    };
  }

  // === FASE 2: Cria clusters iniciais ===
  let clusters: SpatialColorCluster[] = [...bucketMap.values()].map((entry) => ({
    hex: `#${entry.r.toString(16).padStart(2, '0')}${entry.g.toString(16).padStart(2, '0')}${entry.b.toString(16).padStart(2, '0')}`,
    rgb: { r: entry.r, g: entry.g, b: entry.b },
    pixelCount: entry.count,
    pixelFraction: entry.count / fgCount,
    avgX: entry.sumX / entry.count / width,
    avgY: entry.sumY / entry.count / height,
    spread: 0, // Calculado depois
  }));

  // === FASE 3: Merge clusters com cores similares ===
  clusters = mergeSimilarClusters(clusters, 50);

  // Recalcula fractions após merge
  const totalMerged = clusters.reduce((sum, c) => sum + c.pixelCount, 0);
  clusters.forEach((c) => (c.pixelFraction = c.pixelCount / totalMerged));

  // === FASE 4: Calcula spread (dispersão espacial) para cada cluster ===
  for (const cluster of clusters) {
    const spreadResult = calculateSpread(data, channels, width, height, cluster.rgb, 50);
    cluster.spread = spreadResult.spread;
    if (spreadResult.count > 0) {
      cluster.avgX = spreadResult.avgX;
      cluster.avgY = spreadResult.avgY;
    }
  }

  // Ordena por tamanho (maior primeiro)
  clusters.sort((a, b) => b.pixelCount - a.pixelCount);

  // === FASE 5: Classifica PRODUTO vs LOGO ===
  // Produto = maior cluster com alta fração de pixels (cor dominante da sacola/camiseta)
  // Logo = clusters menores e mais concentrados (texto, elementos gráficos)

  let productColor: SpatialColorCluster | null = null;
  const logoColorClusters: SpatialColorCluster[] = [];

  for (const cluster of clusters) {
    if (cluster.pixelFraction < MIN_CLUSTER_FRACTION) continue; // Muito pequeno, ignora

    if (!productColor && cluster.pixelFraction >= PRODUCT_MIN_FRACTION) {
      // Primeiro cluster grande o suficiente → é o produto
      productColor = cluster;
    } else if (productColor && cluster.pixelFraction >= PRODUCT_MIN_FRACTION) {
      // Outro cluster grande → pode ser parte do produto ou segundo produto
      // Se a cor é muito diferente e tem fração significativa, pode ser um segundo elemento
      if (cluster.pixelFraction > 0.15 && colorDistance(cluster.rgb, productColor.rgb) > 60) {
        logoColorClusters.push(cluster);
      }
      // Senão, provavelmente é variação do mesmo produto (sombra, textura)
    } else if (cluster.pixelFraction >= MIN_CLUSTER_FRACTION && cluster.pixelFraction < LOGO_MAX_FRACTION) {
      // Cluster médio/pequeno → provavelmente é logo
      logoColorClusters.push(cluster);
    }
  }

  // Se não encontrou produto, o maior cluster é o produto
  if (!productColor && clusters.length > 0) {
    productColor = clusters[0];
    // Os demais são logo
    for (let i = 1; i < clusters.length; i++) {
      if (clusters[i].pixelFraction >= MIN_CLUSTER_FRACTION) {
        logoColorClusters.push(clusters[i]);
      }
    }
  }

  // === FASE 6: Monta resultado ===
  const logoColors: ColorInfo[] = logoColorClusters
    .sort((a, b) => b.pixelCount - a.pixelCount)
    .slice(0, 6)
    .map((c) => ({
      hex: c.hex,
      rgb: c.rgb,
      pixelFraction: c.pixelFraction,
    }));

  const productColorInfo: ColorInfo | null = productColor
    ? { hex: productColor.hex, rgb: productColor.rgb, pixelFraction: productColor.pixelFraction }
    : null;

  // Se não encontrou cores de logo mas encontrou produto, tenta extrair cores
  // que são visualmente diferentes do produto (pode ser logo sobre fundo colorido)
  if (logoColors.length === 0 && productColor) {
    for (const cluster of clusters) {
      if (cluster === productColor) continue;
      if (cluster.pixelFraction < MIN_CLUSTER_FRACTION) continue;
      if (colorDistance(cluster.rgb, productColor.rgb) > 50) {
        logoColors.push({ hex: cluster.hex, rgb: cluster.rgb, pixelFraction: cluster.pixelFraction });
      }
    }
  }

  const logoColorCount = logoColors.length;
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (logoColorCount >= 4) complexity = 'complex';
  else if (logoColorCount >= 2) complexity = 'moderate';

  const logoColorNames = logoColors.slice(0, 3).map((c) => getColorName(c.rgb));
  const productName = productColor ? getColorName(productColor.rgb) : '';

  const description =
    logoColorCount > 0
      ? `Produto: ${productName} | Logo: ${logoColorCount} ${logoColorCount === 1 ? 'cor' : 'cores'} (${logoColorNames.join(', ')})`
      : productColor
        ? `Produto com cor ${productName} detectada`
        : 'Análise concluída';

  return {
    logoColors,
    logoColorCount,
    productColor: productColorInfo,
    productColorHex: productColorInfo?.hex || null,
    allClusters: clusters.slice(0, 10),
    complexity,
    description,
  };
}

// ============================================================
// COMPATIBILIDADE: Interface antiga (para API route existente)
// ============================================================

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

/**
 * Função legada — agora usa analyzeImageComposition internamente
 * e retorna apenas as cores da logo (não do produto)
 */
export async function analyzeColorsLocally(imageBuffer: Buffer): Promise<LocalAnalysisResult> {
  const result = await analyzeImageComposition(imageBuffer);

  // Retorna as cores da LOGO (não do produto)
  const colors = result.logoColors.length > 0 ? result.logoColors : result.allClusters
    .filter((c) => c.pixelFraction >= 0.03)
    .slice(0, 8)
    .map((c) => ({ hex: c.hex, rgb: c.rgb, pixelFraction: c.pixelFraction }));

  return {
    colors,
    significantColorCount: result.logoColorCount || colors.length,
    complexity: result.complexity,
    description: result.description,
  };
}

// Mapeamento RGB → nome de cor em português
function getColorName(rgb: { r: number; g: number; b: number }): string {
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max > 0 ? (max - min) / max : 0;

  if (max < 40) return 'preto';
  if (sat < 0.1 && max > 40 && min < 220) return 'cinza';

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
