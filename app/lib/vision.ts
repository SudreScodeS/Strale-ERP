// app/lib/vision.ts
// Serviço de análise de imagem com separação PRODUTO vs LOGO
// Google Cloud Vision (se configurado) → análise local com sharp (fallback automático)
// CORRIGIDO: agora retorna cores do produto E cores da logo separadamente

import { analyzeColorsLocally, analyzeImageComposition, LocalColorInfo } from './color-analyzer';

export interface VisionColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  score: number;
  pixelFraction: number;
}

export interface VisionAnalysisResult {
  // Cores da LOGO (elementos gráficos, texto)
  colors: VisionColorInfo[];
  significantColorCount: number;

  // Cor do PRODUTO (sacola, camiseta, etc)
  productColorHex: string | null;
  productColorRgb: { r: number; g: number; b: number } | null;

  complexity: 'simple' | 'moderate' | 'complex';
  description: string;
  safeSearch: {
    safe: boolean;
    issues: string[];
  };
  source: 'google-vision' | 'local';
}

// Limites de validação de imagem
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'];

const SIGNIFICANT_COLOR_THRESHOLD = 0.03;

export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Formato não suportado: ${file.type}. Use PNG, JPEG, WebP, GIF, BMP ou TIFF.` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 10MB.` };
  }
  return { valid: true };
}

async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================================
// Google Cloud Vision (método API Key)
// ============================================================
async function analyzeWithApiKey(base64Image: string, apiKey: string): Promise<VisionAnalysisResult> {
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const requestBody = {
    requests: [
      {
        image: { content: base64Image },
        features: [
          { type: 'IMAGE_PROPERTIES', maxResults: 1 },
          { type: 'LABEL_DETECTION', maxResults: 5 },
          { type: 'SAFE_SEARCH_DETECTION' },
        ],
      },
    ],
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) throw new Error(`Vision API erro (${response.status}): ${await response.text()}`);
  return parseVisionResponse(await response.json());
}

// ============================================================
// Google Cloud Vision (método Service Account)
// ============================================================
async function getServiceAccountAccessToken(): Promise<string> {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS não configurado.');

  const fs = await import('fs');
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
  const now = Math.floor(Date.now() / 1000);

  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-vision',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${encodedHeader}.${encodedPayload}`);
  sign.end();
  const signature = sign.sign(credentials.private_key, 'base64url');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodedHeader}.${encodedPayload}.${signature}`,
  });

  if (!tokenResponse.ok) throw new Error(`Falha ao obter access token: ${await tokenResponse.text()}`);
  return (await tokenResponse.json()).access_token;
}

async function analyzeWithServiceAccount(base64Image: string): Promise<VisionAnalysisResult> {
  const accessToken = await getServiceAccountAccessToken();
  const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      requests: [{ image: { content: base64Image }, features: [{ type: 'IMAGE_PROPERTIES', maxResults: 1 }, { type: 'LABEL_DETECTION', maxResults: 5 }, { type: 'SAFE_SEARCH_DETECTION' }] }],
    }),
  });

  if (!response.ok) throw new Error(`Vision API erro (${response.status}): ${await response.text()}`);
  return parseVisionResponse(await response.json());
}

function parseVisionResponse(data: Record<string, unknown>): VisionAnalysisResult {
  const responses = (data.responses || []) as Record<string, unknown>[];
  if (responses.length === 0) throw new Error('Vision API retornou resposta vazia.');
  const response = responses[0];

  const imageProps = response.imagePropertiesAnnotation as Record<string, unknown> | undefined;
  const dominantColors = (imageProps?.dominantColors as Record<string, unknown>)?.colors as Array<{ color: { red: number; green: number; blue: number }; score: number; pixelFraction: number }> | undefined;

  const colors: VisionColorInfo[] = (dominantColors || []).map((entry) => {
    const r = Math.round(entry.color.red || 0);
    const g = Math.round(entry.color.green || 0);
    const b = Math.round(entry.color.blue || 0);
    return {
      hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
      rgb: { r, g, b },
      score: entry.score || 0,
      pixelFraction: entry.pixelFraction || 0,
    };
  });

  const significantColorCount = Math.max(1, colors.filter((c) => c.pixelFraction >= SIGNIFICANT_COLOR_THRESHOLD).length);

  const labelAnnotations = response.labelAnnotations as Array<{ description: string; score: number }> | undefined;
  const topLabels = (labelAnnotations || []).slice(0, 3).map((l) => l.description);
  const description = topLabels.length > 0 ? `Imagem contendo: ${topLabels.join(', ')}` : 'Logo analisado com sucesso';

  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (significantColorCount >= 5) complexity = 'complex';
  else if (significantColorCount >= 3) complexity = 'moderate';

  const safeSearch = response.safeSearchAnnotation as Record<string, string> | undefined;
  const issues: string[] = [];
  const dangerLevels = ['LIKELY', 'VERY_LIKELY'];
  if (dangerLevels.includes(safeSearch?.adult || '')) issues.push('conteúdo adulto');
  if (dangerLevels.includes(safeSearch?.violence || '')) issues.push('violência');
  if (dangerLevels.includes(safeSearch?.racy || '')) issues.push('conteúdo sugestivo');

  return {
    colors,
    significantColorCount,
    productColorHex: null, // Google Vision não separa produto/Logo
    productColorRgb: null,
    complexity,
    description,
    safeSearch: { safe: issues.length === 0, issues },
    source: 'google-vision',
  };
}

// ============================================================
// Análise LOCAL (sharp) — K-means em espaço LAB
// ============================================================
async function analyzeLocally(file: File): Promise<VisionAnalysisResult> {
  const buffer = await fileToBuffer(file);

  // Usa o novo analisador K-means em LAB
  const composition = await analyzeImageComposition(buffer);

  const colors: VisionColorInfo[] = composition.logoColors.map((c) => ({
    hex: c.hex,
    rgb: c.rgb,
    score: c.pixelFraction,
    pixelFraction: c.pixelFraction,
  }));

  // Se não encontrou cores, tenta analyzeColorsLocally como fallback
  const effectiveColors = colors.length > 0 ? colors : await (async () => {
    const fallback = await analyzeColorsLocally(buffer);
    return fallback.colors.map(c => ({
      hex: c.hex,
      rgb: c.rgb,
      score: c.pixelFraction,
      pixelFraction: c.pixelFraction,
    }));
  })();

  return {
    colors: effectiveColors,
    significantColorCount: composition.logoColorCount || effectiveColors.length,
    productColorHex: composition.productColorHex,
    productColorRgb: composition.productColor?.rgb || null,
    complexity: composition.complexity,
    description: composition.description,
    safeSearch: { safe: true, issues: [] },
    source: 'local',
  };
}

// ============================================================
// Função principal pública
// ============================================================
export async function analyzeLogoImage(file: File): Promise<VisionAnalysisResult> {
  const validation = validateImage(file);
  if (!validation.valid) throw new Error(validation.error);

  const base64Image = await fileToBase64(file);
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  const hasServiceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (apiKey) {
    try { return await analyzeWithApiKey(base64Image, apiKey); } catch (e) {
      console.warn('[Vision API] Falha com API Key, usando análise local:', e);
      return analyzeLocally(file);
    }
  }

  if (hasServiceAccount) {
    try { return await analyzeWithServiceAccount(base64Image); } catch (e) {
      console.warn('[Vision API] Falha com Service Account, usando análise local:', e);
      return analyzeLocally(file);
    }
  }

  return analyzeLocally(file);
}
