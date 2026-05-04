// app/lib/vision.ts
// Serviço de análise de logo via Google Cloud Vision API
// Usa REST API diretamente — zero dependências extras necessárias
// Suporta dois métodos de autenticação:
//   1. GOOGLE_VISION_API_KEY (mais simples, recomendado para dev)
//   2. GOOGLE_APPLICATION_CREDENTIALS (service account JSON, para produção)

export interface VisionColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  score: number;
  pixelFraction: number;
}

export interface VisionAnalysisResult {
  colors: VisionColorInfo[];
  significantColorCount: number;
  complexity: 'simple' | 'moderate' | 'complex';
  description: string;
  safeSearch: {
    safe: boolean;
    issues: string[];
  };
}

// Limites de validação de imagem
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'];

// Limiar para considerar uma cor "significativa" na contagem
// Cores com pixelFraction >= este valor entram na contagem de cores do logo
const SIGNIFICANT_COLOR_THRESHOLD = 0.03; // 3% dos pixels

export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Formato não suportado: ${file.type}. Use PNG, JPEG, WebP, GIF, BMP ou TIFF.`,
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 10MB.`,
    };
  }
  return { valid: true };
}

// Converte File para base64 puro (sem prefixo data:)
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

// ============================================================
// MÉTODO 1: Autenticação via API Key (mais simples)
// ============================================================
async function analyzeWithApiKey(
  base64Image: string,
  mimeType: string,
  apiKey: string,
): Promise<VisionAnalysisResult> {
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

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vision API erro (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return parseVisionResponse(data);
}

// ============================================================
// MÉTODO 2: Autenticação via Service Account (produção)
// ============================================================
async function getServiceAccountAccessToken(): Promise<string> {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS não configurado.');
  }

  const fs = await import('fs');
  const credentialsRaw = fs.readFileSync(credentialsPath, 'utf-8');
  const credentials = JSON.parse(credentialsRaw);

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  // JWT header
  const header = { alg: 'RS256', typ: 'JWT' };
  // JWT payload
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-vision',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Assinar com a chave privada usando crypto nativo
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();
  const signature = sign.sign(credentials.private_key, 'base64url');

  const jwt = `${signatureInput}.${signature}`;

  // Trocar JWT por access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Falha ao obter access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function analyzeWithServiceAccount(
  base64Image: string,
  mimeType: string,
): Promise<VisionAnalysisResult> {
  const accessToken = await getServiceAccountAccessToken();

  const endpoint = 'https://vision.googleapis.com/v1/images:annotate';

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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vision API erro (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return parseVisionResponse(data);
}

// ============================================================
// Parse da resposta da Vision API
// ============================================================
function parseVisionResponse(data: Record<string, unknown>): VisionAnalysisResult {
  const responses = (data.responses || []) as Record<string, unknown>[];
  if (responses.length === 0) {
    throw new Error('Vision API retornou resposta vazia.');
  }

  const response = responses[0];

  // Extrair cores dominantes
  const imageProps = response.imagePropertiesAnnotation as Record<string, unknown> | undefined;
  const dominantColors = (imageProps?.dominantColors as Record<string, unknown>)?.colors as
    | Array<{
        color: { red: number; green: number; blue: number };
        score: number;
        pixelFraction: number;
      }>
    | undefined;

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

  // Contar cores significativas (pixelFraction >= threshold)
  const significantColorCount = Math.max(
    1,
    colors.filter((c) => c.pixelFraction >= SIGNIFICANT_COLOR_THRESHOLD).length,
  );

  // Extrair labels para descrição
  const labelAnnotations = response.labelAnnotations as Array<{ description: string; score: number }> | undefined;
  const topLabels = (labelAnnotations || []).slice(0, 3).map((l) => l.description);
  const description = topLabels.length > 0 ? `Imagem contendo: ${topLabels.join(', ')}` : 'Logo analisado com sucesso';

  // Determinar complexidade baseada na quantidade de cores significativas
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (significantColorCount >= 5) complexity = 'complex';
  else if (significantColorCount >= 3) complexity = 'moderate';

  // Safe Search
  const safeSearch = response.safeSearchAnnotation as Record<string, string> | undefined;
  const issues: string[] = [];
  const dangerLevels = ['LIKELY', 'VERY_LIKELY'];

  if (dangerLevels.includes(safeSearch?.adult || '')) issues.push('conteúdo adulto');
  if (dangerLevels.includes(safeSearch?.violence || '')) issues.push('violência');
  if (dangerLevels.includes(safeSearch?.racy || '')) issues.push('conteúdo sugestivo');
  if (dangerLevels.includes(safeSearch?.spoof || '')) issues.push('falsificação');
  if (dangerLevels.includes(safeSearch?.medical || '')) issues.push('conteúdo médico');

  return {
    colors,
    significantColorCount,
    complexity,
    description,
    safeSearch: {
      safe: issues.length === 0,
      issues,
    },
  };
}

// ============================================================
// Função principal pública
// ============================================================
export async function analyzeLogoImage(file: File): Promise<VisionAnalysisResult> {
  // Validação
  const validation = validateImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const base64Image = await fileToBase64(file);

  // Tenta API Key primeiro (mais simples), depois Service Account
  const apiKey = process.env.GOOGLE_VISION_API_KEY;

  if (apiKey) {
    return analyzeWithApiKey(base64Image, file.type, apiKey);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return analyzeWithServiceAccount(base64Image, file.type);
  }

  throw new Error(
    'Nenhuma credencial do Google Cloud configurada. Defina GOOGLE_VISION_API_KEY ou GOOGLE_APPLICATION_CREDENTIALS no .env.local',
  );
}
