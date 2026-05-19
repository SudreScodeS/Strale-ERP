// api/v1/logo-analysis/route.ts
// V1 standardized logo analysis endpoint.
// Uses api-response helpers for consistent responses.

import { analyzeColorsLocally, LocalAnalysisResult } from '../../../lib/color-analyzer';
import { validateImage } from '../../../lib/vision';
import { requireRole } from '../../../lib/auth';
import { ok, badRequest, fromError } from '../../../lib/api-response';

interface AIAnalysisResult {
  totalColors: number;
  colors: Array<{
    hex: string;
    rgb: { r: number; g: number; b: number };
    name: string;
    pixelFraction: number;
  }>;
  complexity: 'simple' | 'moderate' | 'complex';
  description: string;
  backgroundDescription: string;
}

const COLOR_HEX_MAP: Record<string, string> = {
  red: '#dc2626', 'dark red': '#991b1b', 'light red': '#fca5a5',
  blue: '#2563eb', 'dark blue': '#1e3a8a', 'light blue': '#93c5fd', navy: '#1e3a5f',
  green: '#16a34a', 'dark green': '#14532d', 'light green': '#86efac',
  yellow: '#eab308', 'light yellow': '#fde68a',
  black: '#111827', white: '#f9fafb',
  orange: '#ea580c', 'dark orange': '#c2410c', 'light orange': '#fdba74',
  purple: '#9333ea', 'dark purple': '#581c87', 'light purple': '#c084fc', violet: '#7c3aed',
  pink: '#ec4899', 'light pink': '#f9a8d4', 'hot pink': '#db2777',
  brown: '#92400e', 'dark brown': '#451a03', 'light brown': '#b45309',
  gray: '#6b7280', grey: '#6b7280', 'dark gray': '#374151', 'light gray': '#d1d5db',
  cyan: '#06b6d4', teal: '#0d9488', turquoise: '#2dd4bf',
  magenta: '#d946ef', gold: '#ca8a04', silver: '#9ca3af',
  beige: '#d4a574', cream: '#fef3c7', maroon: '#7f1d1d', olive: '#65a30d',
  coral: '#f97316', salmon: '#fb7185', burgundy: '#881337',
  indigo: '#4f46e5', lime: '#84cc16', mint: '#34d399',
  vermelho: '#dc2626', 'vermelho escuro': '#991b1b', 'vermelho claro': '#fca5a5',
  azul: '#2563eb', 'azul escuro': '#1e3a8a', 'azul claro': '#93c5fd', 'azul marinho': '#1e3a8a',
  verde: '#16a34a', 'verde escuro': '#14532d', 'verde claro': '#86efac',
  amarelo: '#eab308', 'amarelo claro': '#fde68a',
  preto: '#111827', branco: '#f9fafb',
  laranja: '#ea580c', 'laranja escuro': '#c2410c', 'laranja claro': '#fdba74',
  roxo: '#9333ea', 'roxo escuro': '#581c87', 'roxo claro': '#c084fc', violeta: '#7c3aed',
  rosa: '#ec4899', 'rosa claro': '#f9a8d4', 'rosa choque': '#db2777',
  marrom: '#92400e', 'marrom escuro': '#451a03', 'marrom claro': '#b45309',
  cinza: '#6b7280', 'cinza escuro': '#374151', 'cinza claro': '#d1d5db',
  ciano: '#06b6d4', turquesa: '#2dd4bf',
  dourado: '#ca8a04', prata: '#9ca3af',
  bege: '#d4a574', creme: '#fef3c7', bordô: '#881337', grená: '#881337',
  vinho: '#881337', índigo: '#4f46e5', lima: '#84cc16', menta: '#34d399',
};

function nameToHex(name: string): string {
  return COLOR_HEX_MAP[name.toLowerCase().trim()] || '#6b7280';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 107, g: 114, b: 128 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

async function analyzeWithAI(imageBuffer: Buffer): Promise<AIAnalysisResult | null> {
  const token = process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_TOKEN;
  if (!token) return null;

  const base64 = imageBuffer.toString('base64');
  const models = ['Salesforce/blip2-opt-2.7b', 'Salesforce/blip-vqa-base'];

  for (const model of models) {
    try {
      const result = await queryHFModel(token, model, base64);
      if (result) return result;
    } catch (err) {
      console.warn(`[logo-analysis] Model ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }

  return null;
}

async function queryHFModel(token: string, model: string, base64: string): Promise<AIAnalysisResult | null> {
  const url = `https://router.huggingface.co/hf-inference/models/${model}`;
  const questions = [
    'Ignore the background completely. How many distinct colors are used ONLY in the logo design itself? List each color name.',
    'What is the background color of this image?',
  ];

  const answers: string[] = [];

  for (const question of questions) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            image: `data:image/png;base64,${base64}`,
            question,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) return null;

      const result = await response.json();
      const answer = typeof result === 'string'
        ? result
        : (result?.answer || result?.generated_text || '');
      answers.push(answer);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  if (answers.length < 2) return null;
  return parseAIResponse(answers[0], answers[1]);
}

function parseAIResponse(logoAnswer: string, backgroundAnswer: string): AIAnalysisResult | null {
  const allColorNames = Object.keys(COLOR_HEX_MAP);

  const bgLower = backgroundAnswer.toLowerCase();
  const bgColors = new Set<string>();
  for (const name of allColorNames) {
    if (bgLower.includes(name.toLowerCase())) {
      bgColors.add(name.toLowerCase());
    }
  }

  const logoLower = logoAnswer.toLowerCase();
  const foundColors: Array<{ name: string; hex: string; rgb: { r: number; g: number; b: number } }> = [];
  const sortedNames = [...allColorNames].sort((a, b) => b.length - a.length);
  const matched = new Set<string>();

  for (const name of sortedNames) {
    const nameLower = name.toLowerCase();
    if (bgColors.has(nameLower)) continue;
    const alreadyCovered = [...matched].some(m => m.includes(nameLower) && m !== nameLower);
    if (alreadyCovered) continue;

    if (logoLower.includes(nameLower)) {
      matched.add(nameLower);
      const hex = nameToHex(name);
      const rgb = hexToRgb(hex);
      if (!foundColors.some(c => c.hex === hex)) {
        foundColors.push({ name, hex, rgb });
      }
    }
  }

  const numberMatch = logoAnswer.match(/(\d+)\s*(?:color|cor|distinct)/i);
  const expectedCount = numberMatch ? parseInt(numberMatch[1]) : foundColors.length;
  const finalColors = expectedCount > 0 && foundColors.length > expectedCount
    ? foundColors.slice(0, expectedCount)
    : foundColors;

  if (finalColors.length === 0) return null;

  const pixelFraction = 1 / finalColors.length;

  return {
    totalColors: finalColors.length,
    colors: finalColors.map(c => ({
      hex: c.hex,
      rgb: c.rgb,
      name: c.name,
      pixelFraction,
    })),
    complexity: finalColors.length >= 5 ? 'complex' : finalColors.length >= 2 ? 'moderate' : 'simple',
    description: `${finalColors.length} ${finalColors.length === 1 ? 'cor na logo' : 'cores na logo'}: ${finalColors.map(c => c.name).join(', ')}`,
    backgroundDescription: backgroundAnswer,
  };
}

function localToFallback(buffer: Buffer): Promise<LocalAnalysisResult> {
  return analyzeColorsLocally(buffer);
}

function getColorName(rgb: { r: number; g: number; b: number }): string {
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = r * 0.299 + g * 0.587 + b * 0.114;
  const saturation = max > 0 ? (max - min) / max : 0;

  if (brightness < 30) return 'preto';
  if (brightness > 240 && saturation < 0.08) return 'branco';
  if (saturation < 0.12) return brightness < 160 ? 'cinza' : 'cinza claro';

  const hsl = rgbToHsl(r, g, b);
  const h = hsl[0], l = hsl[2];

  if (h < 12 || h >= 348) return l > 60 ? 'vermelho claro' : 'vermelho';
  if (h < 35) return 'laranja';
  if (h < 65) return 'amarelo';
  if (h < 160) return 'verde';
  if (h < 190) return 'ciano';
  if (h < 260) return 'azul';
  if (h < 290) return 'roxo';
  if (h < 330) return 'rosa';
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

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return badRequest('Nenhum arquivo de imagem enviado.');
    }

    const validation = validateImage(file);
    if (!validation.valid) {
      return badRequest(validation.error || 'Imagem inválida.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let source: 'ai' | 'local' = 'ai';
    let analysis: AIAnalysisResult | null = null;

    try {
      analysis = await analyzeWithAI(buffer);
    } catch (aiErr) {
      console.error('[logo-analysis] AI analysis failed:', aiErr);
    }

    if (!analysis) {
      source = 'local';

      try {
        const localResult = await localToFallback(buffer);
        analysis = {
          totalColors: localResult.significantColorCount,
          colors: localResult.colors.map(c => ({
            hex: c.hex,
            rgb: c.rgb,
            name: getColorName(c.rgb),
            pixelFraction: c.pixelFraction,
          })),
          complexity: localResult.complexity,
          description: localResult.description,
          backgroundDescription: 'Análise local (sem IA)',
        };
      } catch (localErr) {
        console.error('[logo-analysis] Local analysis also failed:', localErr);
        return ok({
          totalColors: 0,
          colors: [],
          complexity: 'simple',
          description: 'Não foi possível analisar as cores da logo',
          source: 'failed',
        });
      }
    }

    return ok({
      totalColors: analysis.totalColors,
      colors: analysis.colors.slice(0, 8).map(c => ({
        hex: c.hex,
        rgb: c.rgb,
        name: c.name,
        pixelFraction: c.pixelFraction,
      })),
      complexity: analysis.complexity,
      description: analysis.description,
      source,
    });
  } catch (error) {
    return fromError(error);
  }
}
