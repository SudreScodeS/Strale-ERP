// app/api/product-image/route.ts
// Gera imagem de produto (sacola) usando IA — Hugging Face Inference API (gratuito)
// A imagem gerada é usada como base; logo e cor são compostos em tempo real no client

import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';

// Cache em memória (por cor) — sobrevive durante a vida do server
const imageCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

function getCacheKey(color: string, style: string): string {
  return `${color}-${style}`;
}

/**
 * Gera prompt descritivo para a sacola baseado na cor
 */
function buildPrompt(colorName: string, style: string): string {
  const base = 'professional product photography of a clean empty tote bag';

  const stylePrompts: Record<string, string> = {
    sacola: `${base}, flat woven fabric shopping bag, rectangular shape, sturdy handles, clean front face, no text no logos no writing, solid ${colorName} color, studio lighting, white background, centered, high quality, commercial product photo, 4k`,
    camiseta: `professional product photography of a plain t-shirt, no text no logos no print, solid ${colorName} color, folded neatly, studio lighting, white background, centered, high quality, commercial product photo, 4k`,
    caneca: `professional product photography of a plain ceramic mug, no text no logos no print, solid ${colorName} color, studio lighting, white background, centered, high quality, commercial product photo, 4k`,
  };

  return stylePrompts[style] || stylePrompts.sacola;
}

/**
 * Converte hex para nome de cor em inglês para o prompt
 */
function hexToColorName(hex: string): string {
  const colorNames: Record<string, string> = {
    '#dc2626': 'red', '#ef4444': 'bright red',
    '#2563eb': 'royal blue', '#3b82f6': 'blue', '#1e40af': 'dark blue', '#1e3a8a': 'navy blue',
    '#16a34a': 'green', '#22c55e': 'bright green', '#15803d': 'forest green',
    '#eab308': 'yellow', '#f59e0b': 'amber',
    '#1e293b': 'black', '#0f172a': 'dark black',
    '#f8fafc': 'white', '#ffffff': 'pure white',
    '#ec4899': 'pink', '#f472b6': 'light pink',
    '#9333ea': 'purple', '#a855f7': 'bright purple',
    '#ea580c': 'orange', '#f97316': 'bright orange',
    '#64748b': 'gray', '#94a3b8': 'light gray',
    '#92400e': 'brown', '#b45309': 'warm brown',
    '#ca8a04': 'gold', '#d4a574': 'beige',
    '#7f1d1d': 'dark red wine',
    '#06b6d4': 'cyan', '#22d3ee': 'bright cyan',
    '#d946ef': 'magenta',
  };

  // Busca exata
  if (colorNames[hex]) return colorNames[hex];

  // Busca por proximidade
  const rgb = hexToRgb(hex);
  if (!rgb) return 'blue';

  // Mapeamento por HSL
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const h = hsl[0], s = hsl[1], l = hsl[2];

  if (s < 10) {
    if (l < 20) return 'black';
    if (l > 80) return 'white';
    return 'gray';
  }

  if (h < 15) return l > 60 ? 'light red' : 'red';
  if (h < 45) return l > 60 ? 'light orange' : 'orange';
  if (h < 70) return l > 60 ? 'light yellow' : 'yellow';
  if (h < 160) return l > 60 ? 'light green' : 'green';
  if (h < 200) return l > 60 ? 'light cyan' : 'cyan';
  if (h < 260) return l > 60 ? 'light blue' : 'blue';
  if (h < 300) return l > 60 ? 'light purple' : 'purple';
  return l > 60 ? 'light pink' : 'pink';
}

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);

    const body = await request.json();
    const { color = '#2563eb', style = 'sacola' } = body;

    const cacheKey = getCacheKey(color, style);

    // Verifica cache
    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return new NextResponse(cached.buffer, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=3600',
          'X-Image-Source': 'cache',
        },
      });
    }

    const hfToken = process.env.HUGGINGFACE_API_TOKEN;
    if (!hfToken) {
      return NextResponse.json(
        {
          error: 'HUGGINGFACE_API_TOKEN não configurado.',
          hint: 'Obtenha um token gratuito em https://huggingface.co/settings/tokens e adicione ao .env.local',
          fallback: true,
        },
        { status: 503 },
      );
    }

    const colorName = hexToColorName(color);
    const prompt = buildPrompt(colorName, style);

    // FLUX.1-schnell — rápido (~1-2s), gratuito, qualidade decente
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            width: 512,
            height: 640,
            num_inference_steps: 4, // schnell = 4 steps
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();

      // Modelo carregando — retry após delay
      if (response.status === 503) {
        return NextResponse.json(
          { error: 'Modelo carregando, tente novamente em alguns segundos.', retry: true },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { error: `Erro na API de imagem: ${response.status} — ${errText}` },
        { status: 502 },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Salva no cache
    imageCache.set(cacheKey, { buffer, timestamp: Date.now() });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=3600',
        'X-Image-Source': 'generated',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno na geração de imagem.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==========================================
// Utilitários de cor
// ==========================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
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
