// app/api/logo-analysis/route.ts
// Logo color analysis API — accurate color detection
//
// Pipeline:
// 1. Local analysis (K-means in LAB space) — fast, no API needed
// 2. Fallback: Hugging Face vision model if local fails
// 3. Returns: totalColors, color list with hex/rgb/name

import { NextResponse } from 'next/server';
import { analyzeColorsLocally, LocalAnalysisResult } from '../../lib/color-analyzer';
import { validateImage } from '../../lib/vision';
import { requireRole } from '../../lib/auth';

/**
 * Hugging Face vision fallback — asks a vision model to count colors
 */
async function analyzeWithHF(imageBuffer: Buffer): Promise<LocalAnalysisResult | null> {
  const token = process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_TOKEN;
  if (!token) return null;

  try {
    const base64 = imageBuffer.toString('base64');
    const mimeType = 'image/png'; // Will work for any format

    const model = 'Salesforce/blip-vqa-base';
    const url = `https://router.huggingface.co/hf-inference/models/${model}`;

    console.log('[logo-analysis] Using HF vision fallback...');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          image: `data:${mimeType};base64,${base64}`,
          question: 'How many distinct colors are in this logo? List each color name.',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[logo-analysis] HF error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    const answer = typeof result === 'string' ? result : (result?.answer || result?.generated_text || '');

    console.log(`[logo-analysis] HF response: ${answer}`);

    // Parse the answer to extract color count
    const numberMatch = answer.match(/(\d+)/);
    const colorCount = numberMatch ? Math.min(8, Math.max(1, parseInt(numberMatch[1]))) : 2;

    // Extract color names from answer
    const knownColors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple',
      'pink', 'brown', 'gray', 'grey', 'cyan', 'magenta', 'gold', 'silver',
      'vermelho', 'azul', 'verde', 'amarelo', 'preto', 'branco', 'laranja', 'roxo',
      'rosa', 'marrom', 'cinza', 'ciano', 'dourado', 'prata'];
    const foundColors = knownColors.filter(c => answer.toLowerCase().includes(c));

    // Build synthetic result
    const colors = (foundColors.length > 0 ? foundColors.slice(0, colorCount) : ['unknown'])
      .map((name, i) => ({
        hex: nameToHex(name),
        rgb: hexToRgb(nameToHex(name)) || { r: 128, g: 128, b: 128 },
        pixelFraction: 1 / colorCount,
      }));

    return {
      colors,
      significantColorCount: Math.min(colorCount, colors.length),
      complexity: colorCount >= 5 ? 'complex' : colorCount >= 2 ? 'moderate' : 'simple',
      description: `Análise por IA: ${colorCount} ${colorCount === 1 ? 'cor detectada' : 'cores detectadas'}`,
      productColorHex: null,
      productColorRgb: null,
    };
  } catch (error) {
    console.error('[logo-analysis] HF fallback error:', error instanceof Error ? error.message : error);
    return null;
  }
}

function nameToHex(name: string): string {
  const map: Record<string, string> = {
    red: '#dc2626', vermelho: '#dc2626',
    blue: '#2563eb', azul: '#2563eb',
    green: '#16a34a', verde: '#16a34a',
    yellow: '#eab308', amarelo: '#eab308',
    black: '#1e293b', preto: '#1e293b',
    white: '#f8fafc', branco: '#f8fafc',
    orange: '#ea580c', laranja: '#ea580c',
    purple: '#9333ea', roxo: '#9333ea',
    pink: '#ec4899', rosa: '#ec4899',
    brown: '#92400e', marrom: '#92400e',
    gray: '#64748b', grey: '#64748b', cinza: '#64748b',
    cyan: '#06b6d4', ciano: '#06b6d4',
    magenta: '#d946ef',
    gold: '#ca8a04', dourado: '#ca8a04',
    silver: '#94a3b8', prata: '#94a3b8',
  };
  return map[name.toLowerCase()] || '#64748b';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo de imagem enviado.' }, { status: 400 });
    }

    const validation = validateImage(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // =============================================
    // STAGE 1: Local analysis (K-means in LAB)
    // =============================================
    let analysis: LocalAnalysisResult;
    let source: 'local' | 'huggingface' = 'local';

    try {
      analysis = await analyzeColorsLocally(buffer);
      console.log(`[logo-analysis] Local: ${analysis.significantColorCount} colors, ${analysis.description}`);
    } catch (localErr) {
      console.error('[logo-analysis] Local analysis failed:', localErr);
      analysis = {
        colors: [],
        significantColorCount: 0,
        complexity: 'simple',
        description: 'Análise local falhou',
        productColorHex: null,
        productColorRgb: null,
      };
    }

    // =============================================
    // STAGE 2: HF fallback if local found nothing
    // =============================================
    if (analysis.significantColorCount === 0 || analysis.colors.length === 0) {
      console.log('[logo-analysis] No colors found locally, trying HF fallback...');
      const hfResult = await analyzeWithHF(buffer);
      if (hfResult) {
        analysis = hfResult;
        source = 'huggingface';
      }
    }

    return NextResponse.json({
      totalColors: analysis.significantColorCount,
      colors: analysis.colors.slice(0, 8).map(c => ({
        hex: c.hex,
        rgb: c.rgb,
        name: getColorName(c.rgb),
        pixelFraction: c.pixelFraction,
      })),
      complexity: analysis.complexity,
      description: analysis.description,
      productColor: analysis.productColorHex,
      productColorRgb: analysis.productColorRgb,
      source,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno na análise de logo.';
    console.error(`[logo-analysis] ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
