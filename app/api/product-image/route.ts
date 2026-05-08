// app/api/product-image/route.ts
// Image generation pipeline — LOCAL Logo Replacer Pro
//
// STRATEGY:
// 1. Use real product photo as base (if provided) or generate SVG fallback
// 2. Recolor via luminance-preserving algorithm (from replacer.py)
// 3. Composite logo with professional effects (shadow, specular, lighting)
// 4. All processing is 100% local — no external APIs needed
//
// Ported from: https://github.com/SudreScodeS/ia (Logo Replacer Pro)

import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';
import sharp from 'sharp';
import { replaceLogo, recolor } from '../../lib/logo-replacer';

// ==========================================
// Cache
// ==========================================

const imageCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60;

function getCacheKey(color: string, style: string, variables: string[], logoHash?: string): string {
  const parts = [color, style, ...variables];
  if (logoHash) parts.push(logoHash);
  return parts.join('|');
}

// ==========================================
// SVG fallback product illustrations
// ==========================================

function createFallbackSvg(style: string): Buffer {
  const sizes: Record<string, { w: number; h: number }> = {
    sacola: { w: 512, h: 640 },
    camiseta: { w: 512, h: 640 },
    caneca: { w: 512, h: 512 },
  };
  const { w, h } = sizes[style] || sizes.sacola;

  const svgs: Record<string, string> = {
    sacola: `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bagBody" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#a8a8a8"/>
      <stop offset="15%" stop-color="#b8b8b8"/>
      <stop offset="40%" stop-color="#b0b0b0"/>
      <stop offset="70%" stop-color="#9a9a9a"/>
      <stop offset="100%" stop-color="#858585"/>
    </linearGradient>
    <linearGradient id="bagShade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0.08"/>
      <stop offset="40%" stop-color="white" stop-opacity="0"/>
      <stop offset="85%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.15"/>
    </linearGradient>
    <linearGradient id="topFold" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#888"/>
      <stop offset="50%" stop-color="#999"/>
      <stop offset="100%" stop-color="#aaa"/>
    </linearGradient>
    <linearGradient id="handleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#777"/>
      <stop offset="30%" stop-color="#999"/>
      <stop offset="50%" stop-color="#aaa"/>
      <stop offset="70%" stop-color="#999"/>
      <stop offset="100%" stop-color="#777"/>
    </linearGradient>
    <pattern id="fabric" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="transparent"/>
      <line x1="0" y1="0" x2="4" y2="0" stroke="rgba(0,0,0,0.04)" stroke-width="0.5"/>
      <line x1="0" y1="2" x2="4" y2="2" stroke="rgba(255,255,255,0.03)" stroke-width="0.5"/>
      <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(0,0,0,0.03)" stroke-width="0.5"/>
      <line x1="2" y1="0" x2="2" y2="4" stroke="rgba(255,255,255,0.02)" stroke-width="0.5"/>
    </pattern>
    <radialGradient id="groundShadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="black" stop-opacity="0.18"/>
      <stop offset="70%" stop-color="black" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="creaseHL" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.04)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.06)"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="white"/>
  <ellipse cx="${w*0.5}" cy="${h*0.87}" rx="${w*0.32}" ry="${h*0.025}" fill="url(#groundShadow)"/>
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.7}" height="${h*0.65}" rx="3" fill="url(#bagBody)"/>
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.7}" height="${h*0.65}" rx="3" fill="url(#bagShade)"/>
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.7}" height="${h*0.65}" rx="3" fill="url(#fabric)"/>
  <polygon points="${w*0.85},${h*0.18} ${w*0.90},${h*0.15} ${w*0.90},${h*0.80} ${w*0.85},${h*0.83}" fill="#7a7a7a" opacity="0.6"/>
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.7}" height="${h*0.035}" rx="2" fill="url(#topFold)" opacity="0.7"/>
  <line x1="${w*0.17}" y1="${h*0.215}" x2="${w*0.83}" y2="${h*0.215}" stroke="rgba(0,0,0,0.12)" stroke-width="0.8"/>
  <line x1="${w*0.18}" y1="${h*0.225}" x2="${w*0.82}" y2="${h*0.225}" stroke="rgba(255,255,255,0.15)" stroke-width="0.6" stroke-dasharray="3,3"/>
  <line x1="${w*0.30}" y1="${h*0.22}" x2="${w*0.28}" y2="${h*0.82}" stroke="url(#creaseHL)" stroke-width="1.5"/>
  <line x1="${w*0.70}" y1="${h*0.22}" x2="${w*0.72}" y2="${h*0.82}" stroke="url(#creaseHL)" stroke-width="1.2"/>
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.15}" height="${h*0.65}" rx="3" fill="rgba(255,255,255,0.08)"/>
  <rect x="${w*0.15}" y="${h*0.78}" width="${w*0.7}" height="${h*0.05}" rx="2" fill="rgba(0,0,0,0.08)"/>
  <path d="M${w*0.30},${h*0.18} Q${w*0.30},${h*0.04} ${w*0.40},${h*0.04}" fill="none" stroke="url(#handleGrad)" stroke-width="5" stroke-linecap="round"/>
  <path d="M${w*0.30},${h*0.18} Q${w*0.30},${h*0.04} ${w*0.40},${h*0.04}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round"/>
  <path d="M${w*0.60},${h*0.04} Q${w*0.70},${h*0.04} ${w*0.70},${h*0.18}" fill="none" stroke="url(#handleGrad)" stroke-width="5" stroke-linecap="round"/>
  <path d="M${w*0.60},${h*0.04} Q${w*0.70},${h*0.04} ${w*0.70},${h*0.18}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round"/>
  <circle cx="${w*0.30}" cy="${h*0.18}" r="3" fill="#888" stroke="#777" stroke-width="0.5"/>
  <circle cx="${w*0.70}" cy="${h*0.18}" r="3" fill="#888" stroke="#777" stroke-width="0.5"/>
  <circle cx="${w*0.30}" cy="${h*0.18}" r="1.5" fill="#aaa"/>
  <circle cx="${w*0.70}" cy="${h*0.18}" r="1.5" fill="#aaa"/>
</svg>`,

    camiseta: `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shirtBody" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#a8a8a8"/>
      <stop offset="20%" stop-color="#b8b8b8"/>
      <stop offset="50%" stop-color="#b0b0b0"/>
      <stop offset="80%" stop-color="#9a9a9a"/>
      <stop offset="100%" stop-color="#888"/>
    </linearGradient>
    <linearGradient id="shirtShade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0.06"/>
      <stop offset="50%" stop-color="white" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.12"/>
    </linearGradient>
    <pattern id="knit" width="3" height="3" patternUnits="userSpaceOnUse">
      <rect width="3" height="3" fill="transparent"/>
      <circle cx="1.5" cy="1.5" r="0.5" fill="rgba(0,0,0,0.03)"/>
    </pattern>
    <radialGradient id="groundShirt" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="black" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="white"/>
  <ellipse cx="${w*0.5}" cy="${h*0.88}" rx="${w*0.25}" ry="${h*0.02}" fill="url(#groundShirt)"/>
  <path d="M${w*0.32},${h*0.08} L${w*0.15},${h*0.18} L${w*0.10},${h*0.28} L${w*0.22},${h*0.30} L${w*0.22},${h*0.82} L${w*0.78},${h*0.82} L${w*0.78},${h*0.30} L${w*0.90},${h*0.28} L${w*0.85},${h*0.18} L${w*0.68},${h*0.08} Q${w*0.58},${h*0.14} ${w*0.50},${h*0.14} Q${w*0.42},${h*0.14} ${w*0.32},${h*0.08} Z" fill="url(#shirtBody)"/>
  <path d="M${w*0.32},${h*0.08} L${w*0.15},${h*0.18} L${w*0.10},${h*0.28} L${w*0.22},${h*0.30} L${w*0.22},${h*0.82} L${w*0.78},${h*0.82} L${w*0.78},${h*0.30} L${w*0.90},${h*0.28} L${w*0.85},${h*0.18} L${w*0.68},${h*0.08} Q${w*0.58},${h*0.14} ${w*0.50},${h*0.14} Q${w*0.42},${h*0.14} ${w*0.32},${h*0.08} Z" fill="url(#shirtShade)"/>
  <path d="M${w*0.32},${h*0.08} L${w*0.15},${h*0.18} L${w*0.10},${h*0.28} L${w*0.22},${h*0.30} L${w*0.22},${h*0.82} L${w*0.78},${h*0.82} L${w*0.78},${h*0.30} L${w*0.90},${h*0.28} L${w*0.85},${h*0.18} L${w*0.68},${h*0.08} Q${w*0.58},${h*0.14} ${w*0.50},${h*0.14} Q${w*0.42},${h*0.14} ${w*0.32},${h*0.08} Z" fill="url(#knit)"/>
  <ellipse cx="${w*0.50}" cy="${h*0.08}" rx="${w*0.10}" ry="${h*0.04}" fill="white" stroke="#999" stroke-width="1"/>
  <line x1="${w*0.22}" y1="${h*0.30}" x2="${w*0.22}" y2="${h*0.82}" stroke="rgba(0,0,0,0.06)" stroke-width="0.8"/>
  <line x1="${w*0.78}" y1="${h*0.30}" x2="${w*0.78}" y2="${h*0.82}" stroke="rgba(0,0,0,0.06)" stroke-width="0.8"/>
  <path d="M${w*0.22},${h*0.30} L${w*0.22},${h*0.82} L${w*0.35},${h*0.82} L${w*0.35},${h*0.30} Z" fill="rgba(255,255,255,0.06)"/>
</svg>`,

    caneca: `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mugBody" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#aaa"/>
      <stop offset="15%" stop-color="#ccc"/>
      <stop offset="35%" stop-color="#ddd"/>
      <stop offset="55%" stop-color="#ccc"/>
      <stop offset="75%" stop-color="#aaa"/>
      <stop offset="100%" stop-color="#999"/>
    </linearGradient>
    <linearGradient id="mugShade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0.1"/>
      <stop offset="50%" stop-color="white" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="handleGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#bbb"/>
      <stop offset="50%" stop-color="#ddd"/>
      <stop offset="100%" stop-color="#bbb"/>
    </linearGradient>
    <radialGradient id="groundMug" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="black" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="specular" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="30%" stop-color="rgba(255,255,255,0.2)"/>
      <stop offset="40%" stop-color="rgba(255,255,255,0.35)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.2)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="white"/>
  <ellipse cx="${w*0.42}" cy="${h*0.88}" rx="${w*0.22}" ry="${h*0.02}" fill="url(#groundMug)"/>
  <rect x="${w*0.18}" y="${h*0.15}" width="${w*0.48}" height="${h*0.68}" rx="4" fill="url(#mugBody)"/>
  <rect x="${w*0.18}" y="${h*0.15}" width="${w*0.48}" height="${h*0.68}" rx="4" fill="url(#mugShade)"/>
  <rect x="${w*0.18}" y="${h*0.15}" width="${w*0.48}" height="${h*0.68}" rx="4" fill="url(#specular)"/>
  <ellipse cx="${w*0.42}" cy="${h*0.15}" rx="${w*0.24}" ry="${h*0.035}" fill="#ddd" stroke="#bbb" stroke-width="1"/>
  <ellipse cx="${w*0.42}" cy="${h*0.15}" rx="${w*0.22}" ry="${h*0.028}" fill="#eee"/>
  <ellipse cx="${w*0.42}" cy="${h*0.83}" rx="${w*0.24}" ry="${h*0.025}" fill="#999" stroke="#888" stroke-width="0.5"/>
  <path d="M${w*0.66},${h*0.28} Q${w*0.80},${h*0.28} ${w*0.80},${h*0.48} Q${w*0.80},${h*0.68} ${w*0.66},${h*0.68}" fill="none" stroke="url(#handleGrad2)" stroke-width="6" stroke-linecap="round"/>
  <path d="M${w*0.66},${h*0.28} Q${w*0.78},${h*0.30} ${w*0.78},${h*0.48} Q${w*0.78},${h*0.66} ${w*0.66},${h*0.68}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" stroke-linecap="round"/>
</svg>`,
  };

  return Buffer.from(svgs[style] || svgs.sacola);
}

// ==========================================
// API ROUTE
// ==========================================

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);

    const body = await request.json();
    const {
      color = '#2563eb',
      style = 'sacola',
      logoDataUrl,
      productImageBase64,
      variables = [],
    } = body;

    const hasLogo = Boolean(logoDataUrl);
    const hasProductImage = Boolean(productImageBase64);
    console.log(`[product-image] color=${color}, style=${style}, vars=[${variables.join(', ')}], logo=${hasLogo}, source=local-replacer`);

    const logoHash = hasLogo ? logoDataUrl.substring(logoDataUrl.length - 30) : undefined;
    const cacheKey = getCacheKey(color, style, variables, logoHash);

    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[product-image] Cache hit`);
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Image-Source': 'cache' },
      });
    }

    // =============================================
    // STEP 1: Get base image
    // =============================================
    let finalBuffer: Buffer;
    let imageSource: string;

    if (hasProductImage) {
      console.log(`[product-image] Using provided product image as base`);
      const imgBase64 = productImageBase64.replace(/^data:image\/\w+;base64,/, '');
      finalBuffer = Buffer.from(imgBase64, 'base64');
      imageSource = 'product-photo';
    } else {
      // Generate SVG fallback (no external API needed)
      console.log(`[product-image] Creating local SVG base for ${style}`);
      const svgBuffer = createFallbackSvg(style);
      finalBuffer = await sharp(svgBuffer).png().toBuffer();
      imageSource = 'svg-fallback';

      // Recolor the SVG base
      console.log(`[product-image] Recoloring to ${color}...`);
      const rgb = color.startsWith('#')
        ? (() => { const m = color.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] as [number, number, number] : null; })()
        : null;
      if (rgb) {
        finalBuffer = await recolor(finalBuffer, rgb, 0.85);
      }
      imageSource = 'local-recolor';
    }

    // =============================================
    // STEP 2: Logo compositing with Logo Replacer Pro
    // =============================================
    if (hasLogo && logoDataUrl) {
      try {
        console.log(`[product-image] Compositing logo with Logo Replacer Pro...`);
        const logoBase64 = logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const logoBuffer = Buffer.from(logoBase64, 'base64');

        // Use the full replaceLogo pipeline from the ported Python engine
        finalBuffer = await replaceLogo(finalBuffer, logoBuffer, {
          size: 'medium',
          removeBackground: true,
          addShadow: true,
          addHighlight: true,
        });
        imageSource = 'logo-replacer';
        console.log(`[product-image] Logo composited with Logo Replacer Pro`);
      } catch (err) {
        console.error(`[product-image] Logo composition error:`, err);
      }
    }

    // =============================================
    // Convert to WebP
    // =============================================
    const webpBuffer = await sharp(finalBuffer).webp({ quality: 90 }).toBuffer();
    console.log(`[product-image] Final: ${webpBuffer.length} bytes, source: ${imageSource}`);

    imageCache.set(cacheKey, { buffer: webpBuffer, timestamp: Date.now() });

    return new NextResponse(new Uint8Array(webpBuffer), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Image-Source': imageSource },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno na geração de imagem.';
    console.error(`[product-image] ERROR: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
