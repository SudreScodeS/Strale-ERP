// api/v1/product-image/route.ts
// V1 standardized product image endpoint.
// Note: Returns binary image data, not JSON envelope.
// Versioning headers added via middleware.

import { NextResponse } from 'next/server';
import { requireRole } from '../../../../lib/auth';
import { badRequest, fromError } from '../../../../lib/api-response';
import sharp from 'sharp';

const imageCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60;

function getCacheKey(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join('|');
}

function lum(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

const COLOR_MAP: Record<string, [number, number, number]> = {
  red: [200, 30, 30], blue: [20, 50, 200], green: [30, 150, 50],
  black: [20, 20, 20], white: [240, 240, 240], yellow: [230, 200, 30],
  purple: [120, 40, 180], orange: [240, 130, 20], pink: [240, 100, 160],
  cyan: [30, 180, 220], gray: [128, 128, 128], navy: [15, 25, 80],
  vermelho: [200, 30, 30], azul: [20, 50, 200], verde: [30, 150, 50],
  preto: [20, 20, 20], branco: [240, 240, 240], amarelo: [230, 200, 30],
  roxo: [120, 40, 180], laranja: [240, 130, 20], rosa: [240, 100, 160],
  cinza: [128, 128, 128],
};

function resolveColor(color: string): [number, number, number] {
  if (color.startsWith('#')) return hexToRgb(color) || [20, 50, 200];
  return COLOR_MAP[color.toLowerCase()] || [20, 50, 200];
}

function materialPrompt(material?: string): string {
  if (!material) return 'tote bag';
  const m = material.toLowerCase();
  if (m.includes('nylon')) return 'nylon tote bag, smooth fabric with visible stitching';
  if (m.includes('tnt')) return 'non-woven polypropylene tote bag, slightly textured matte fabric';
  if (m.includes('lona')) return 'canvas cotton tote bag, thick woven natural fabric';
  if (m.includes('algodão') || m.includes('algodao')) return 'cotton tote bag, soft natural woven fabric';
  if (m.includes('couro') || m.includes('leather')) return 'faux leather tote bag, smooth matte finish';
  if (m.includes('ecobag')) return 'eco-friendly cotton tote bag, natural fabric';
  return 'tote bag';
}

interface Region { x: number; y: number; width: number; height: number; }

interface ReferenceAnalysis {
  productRegion: Region;
  logoRegion: Region;
  aspectRatio: number;
}

async function analyzeReference(refBuffer: Buffer): Promise<ReferenceAnalysis> {
  const { data, info } = await sharp(refBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;

  let pMinX = w, pMinY = h, pMaxX = 0, pMaxY = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * ch;
      if (lum(data[i], data[i + 1], data[i + 2]) < 235) {
        if (x < pMinX) pMinX = x; if (x > pMaxX) pMaxX = x;
        if (y < pMinY) pMinY = y; if (y > pMaxY) pMaxY = y;
      }
    }
  }
  const pW = pMaxX - pMinX, pH = pMaxY - pMinY;

  const gridSize = 20;
  const grid: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
  const gridCount: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));

  for (let y = pMinY; y < pMaxY; y += 2) {
    for (let x = pMinX; x < pMaxX; x += 2) {
      const i = (y * w + x) * ch;
      const pLum = lum(data[i], data[i + 1], data[i + 2]);
      const gx = Math.min(gridSize - 1, Math.floor(((x - pMinX) / (pW + 1)) * gridSize));
      const gy = Math.min(gridSize - 1, Math.floor(((y - pMinY) / (pH + 1)) * gridSize));
      grid[gy][gx] += pLum;
      gridCount[gy][gx]++;
    }
  }

  let bestRegion = { x: 0, y: 0, w: 0, h: 0, score: 0 };
  for (let winW = 3; winW <= 12; winW++) {
    for (let winH = 2; winH <= 10; winH++) {
      for (let startY = 0; startY <= gridSize - winH; startY++) {
        for (let startX = 0; startX <= gridSize - winW; startX++) {
          let totalLum = 0, totalCnt = 0;
          for (let dy = 0; dy < winH; dy++) {
            for (let dx = 0; dx < winW; dx++) {
              if (gridCount[startY + dy][startX + dx] > 0) {
                totalLum += grid[startY + dy][startX + dx];
                totalCnt += gridCount[startY + dy][startX + dx];
              }
            }
          }
          const avgLum = totalCnt > 0 ? totalLum / totalCnt : 0;
          const score = avgLum * Math.sqrt(winW * winH);
          if (score > bestRegion.score && avgLum > 150) {
            bestRegion = { x: startX, y: startY, w: winW, h: winH, score };
          }
        }
      }
    }
  }

  const logoRegion: Region = {
    x: pMinX + Math.floor((bestRegion.x / gridSize) * pW),
    y: pMinY + Math.floor((bestRegion.y / gridSize) * pH),
    width: Math.floor((bestRegion.w / gridSize) * pW),
    height: Math.floor((bestRegion.h / gridSize) * pH),
  };

  return {
    productRegion: { x: pMinX, y: pMinY, width: pW, height: pH },
    logoRegion,
    aspectRatio: pW / pH,
  };
}

async function generateWithFlux(prompt: string, w: number, h: number, negativePrompt?: string): Promise<Buffer | null> {
  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HUGGINGFACE_API_KEY;
  if (!token) return null;

  const url = 'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120_000);
    const body: Record<string, unknown> = {
      inputs: prompt,
      parameters: { width: w, height: h, num_inference_steps: 12 },
    };
    if (negativePrompt) {
      (body.parameters as Record<string, unknown>).negative_prompt = negativePrompt;
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'image/png' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    return Buffer.from(new Uint8Array(await resp.arrayBuffer()));
  } catch (e) {
    console.error('[product-image] FLUX exception:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function recolor(buf: Buffer, target: [number, number, number], intensity = 0.90): Promise<Buffer> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const out = Buffer.alloc(w * h * 4);
  const [tr, tg, tb] = target;
  const tLum = lum(tr, tg, tb);

  let sum = 0, cnt = 0;
  for (let i = 0; i < w * h; i++) {
    const si = i * ch;
    const p = lum(data[si], data[si + 1], data[si + 2]);
    if (p > 15 && p < 180) { sum += p; cnt++; }
  }
  const avg = cnt > 0 ? sum / cnt : 80;

  for (let i = 0; i < w * h; i++) {
    const si = i * ch, di = i * 4;
    const r = data[si], g = data[si + 1], b = data[si + 2], a = data[si + 3];
    const p = lum(r, g, b);

    if (p > 240) { out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = a; continue; }
    if (p > 180) { out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = a; continue; }

    const lr = Math.max(0.1, Math.min(3.0, avg > 0 ? p / avg : 1));
    out[di] = Math.max(0, Math.min(255, Math.round(r * (1 - intensity) + tLum * lr * (tr / Math.max(tLum, 1)) * intensity)));
    out[di + 1] = Math.max(0, Math.min(255, Math.round(g * (1 - intensity) + tLum * lr * (tg / Math.max(tLum, 1)) * intensity)));
    out[di + 2] = Math.max(0, Math.min(255, Math.round(b * (1 - intensity) + tLum * lr * (tb / Math.max(tLum, 1)) * intensity)));
    out[di + 3] = a;
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).ensureAlpha().png().toBuffer();
}

async function removeLogoBg(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;

  const edgeLums: number[] = [];
  for (let x = 0; x < w; x++) {
    for (const row of [0, 1, 2, h - 1, h - 2, h - 3]) {
      if (row < 0 || row >= h) continue;
      const i = (row * w + x) * ch;
      edgeLums.push(lum(data[i], data[i + 1], data[i + 2]));
    }
  }
  for (let y = 0; y < h; y++) {
    for (const col of [0, 1, 2, w - 1, w - 2, w - 3]) {
      if (col < 0 || col >= w) continue;
      const i = (y * w + col) * ch;
      edgeLums.push(lum(data[i], data[i + 1], data[i + 2]));
    }
  }

  edgeLums.sort((a, b) => a - b);
  const bgLum = edgeLums[Math.floor(edgeLums.length / 2)];
  const isLightBg = bgLum > 180;

  const mean = edgeLums.reduce((a, b) => a + b, 0) / edgeLums.length;
  const std = Math.sqrt(edgeLums.reduce((a, b) => a + (b - mean) ** 2, 0) / edgeLums.length);
  const tolerance = Math.max(15, Math.min(50, std * 1.5));

  const out = Buffer.alloc(w * h * 4);

  for (let i = 0; i < w * h; i++) {
    const si = i * ch, di = i * 4;
    const r = data[si], g = data[si + 1], b = data[si + 2];
    const p = lum(r, g, b);

    if (isLightBg) {
      if (p > bgLum - tolerance) {
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 0;
      } else if (p > bgLum - tolerance * 3) {
        const alpha = Math.round(255 * (bgLum - tolerance * 3 - p) / (tolerance * 2));
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = Math.max(0, Math.min(255, alpha));
      } else {
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 255;
      }
    } else {
      const threshold = Math.min(255, bgLum + tolerance);
      if (p < threshold) {
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 0;
      } else if (p < threshold + tolerance * 2) {
        const alpha = Math.round(255 * (p - threshold) / (tolerance * 2));
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = Math.max(0, Math.min(255, alpha));
      } else {
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 255;
      }
    }
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).ensureAlpha().png().toBuffer();
}

function getLogoPosition(
  bagBounds: Region,
  logoRegion: Region,
  reference: Region,
  printPosition: string,
  printSize: string,
  logoW: number,
  logoH: number,
  imgW: number,
  imgH: number,
): { x: number; y: number } {
  const scaleX = bagBounds.width / reference.width;
  const scaleY = bagBounds.height / reference.height;

  let baseX = bagBounds.x + (logoRegion.x - reference.x) * scaleX;
  let baseY = bagBounds.y + (logoRegion.y - reference.y) * scaleY;
  const regionW = logoRegion.width * scaleX;
  const regionH = logoRegion.height * scaleY;

  const bagCenterX = bagBounds.x + bagBounds.width / 2;
  const bagCenterY = bagBounds.y + bagBounds.height / 2;

  switch (printPosition) {
    case 'back':
      baseX = bagCenterX - regionW / 2 + bagBounds.width * 0.05;
      baseY = bagCenterY - regionH / 2 + bagBounds.height * 0.1;
      break;
    case 'both':
      break;
    case 'front':
    default:
      break;
  }

  let sizeScale = 1.0;
  switch (printSize) {
    case 'small': sizeScale = 0.6; break;
    case 'medium': sizeScale = 1.0; break;
    case 'large': sizeScale = 1.4; break;
  }

  const x = Math.round(baseX + (regionW - logoW) / 2);
  const y = Math.round(baseY + (regionH - logoH) / 2);

  return { x: Math.max(0, Math.min(imgW - logoW, x)), y: Math.max(0, Math.min(imgH - logoH, y)) };
}

function createFallbackSvg(style: string): Buffer {
  const sizes: Record<string, { w: number; h: number }> = {
    sacola: { w: 512, h: 640 }, camiseta: { w: 512, h: 640 }, caneca: { w: 512, h: 512 },
  };
  const { w, h } = sizes[style] || sizes.sacola;
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="white"/>
  <rect x="${w*0.15}" y="${h*0.18}" width="${w*0.7}" height="${h*0.65}" rx="3" fill="#b0b0b0"/>
  <path d="M${w*0.30},${h*0.18} Q${w*0.30},${h*0.04} ${w*0.40},${h*0.04}" fill="none" stroke="#999" stroke-width="5" stroke-linecap="round"/>
  <path d="M${w*0.60},${h*0.04} Q${w*0.70},${h*0.04} ${w*0.70},${h*0.18}" fill="none" stroke="#999" stroke-width="5" stroke-linecap="round"/>
</svg>`;
  return Buffer.from(svg);
}

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
      material,
      printPosition = 'front',
      printSize = 'medium',
    } = body;

    const hasLogo = Boolean(logoDataUrl);
    const hasProductImage = Boolean(productImageBase64);

    const targetRgb = resolveColor(color);
    const cacheKey = getCacheKey(color, style, material, printPosition, printSize, hasLogo ? logoDataUrl?.slice(-30) : undefined);

    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Image-Source': 'cache' },
      });
    }

    let baseBuffer: Buffer;
    let imageSource: string;
    let refAnalysis: ReferenceAnalysis | null = null;

    if (hasProductImage) {
      const imgBase64 = productImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const refBuffer = Buffer.from(imgBase64, 'base64');

      refAnalysis = await analyzeReference(refBuffer);

      const matDesc = materialPrompt(material);
      const fluxPrompt = `single solid ${color} colored ${matDesc}, front view, standing upright, centered on pure white background, even studio lighting, no patterns, no textures, no prints, no text, no logos, no people, clean product photo, commercial catalog, 4k`;
      const fluxNegative = 'checkerboard, grid, pattern, plaid, stripes, multiple bags, stacked, folded, wrinkled, distorted, blurry, low quality, text, watermark, logo, people, hands, shadows, dark, painting, cartoon, illustration, 3d render';

      const fluxResult = await generateWithFlux(fluxPrompt, 1024, 1024, fluxNegative);

      if (fluxResult) {
        baseBuffer = fluxResult;
        imageSource = 'flux';
      } else {
        baseBuffer = await recolor(refBuffer, targetRgb, 0.90);
        imageSource = 'recolored-ref';
      }
    } else {
      const svgBuffer = createFallbackSvg(style);
      baseBuffer = await sharp(svgBuffer).png().toBuffer();
      baseBuffer = await recolor(baseBuffer, targetRgb, 0.85);
      imageSource = 'svg-fallback';
    }

    if (imageSource === 'flux') {
      baseBuffer = await recolor(baseBuffer, targetRgb, 0.60);
      imageSource = 'flux-recolor';
    }

    const baseMeta = await sharp(baseBuffer).metadata();
    const bw = baseMeta.width || 1024, bh = baseMeta.height || 1024;
    const { data: bd, info: bi } = await sharp(baseBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let bMinX = bw, bMinY = bh, bMaxX = 0, bMaxY = 0;
    for (let y = 0; y < bh; y += 4) {
      for (let x = 0; x < bw; x += 4) {
        const i = (y * bw + x) * bi.channels;
        if (lum(bd[i], bd[i + 1], bd[i + 2]) < 230) {
          if (x < bMinX) bMinX = x; if (x > bMaxX) bMaxX = x;
          if (y < bMinY) bMinY = y; if (y > bMaxY) bMaxY = y;
        }
      }
    }
    const bagBounds: Region = { x: bMinX, y: bMinY, width: bMaxX - bMinX, height: bMaxY - bMinY };

    if (hasLogo && logoDataUrl) {
      try {
        const logoBase64 = logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
        let logoBuffer: Buffer = Buffer.from(logoBase64, 'base64');

        logoBuffer = await removeLogoBg(logoBuffer) as Buffer;
        try { logoBuffer = await sharp(logoBuffer).trim({ threshold: 5 }).png().toBuffer() as Buffer; } catch { /* ok */ }

        const logoLum = await sharp(logoBuffer).greyscale().raw().toBuffer();
        let logoAvgLum = 0, logoCnt = 0;
        for (let i = 0; i < logoLum.length; i++) {
          if (logoLum[i] > 10) { logoAvgLum += logoLum[i]; logoCnt++; }
        }
        logoAvgLum = logoCnt > 0 ? logoAvgLum / logoCnt : 128;

        const isDarkProduct = lum(...targetRgb) < 120;
        if (isDarkProduct && logoAvgLum < 100) {
          const { data: ld, info: li } = await sharp(logoBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const inverted = Buffer.alloc(ld.length);
          for (let i = 0; i < ld.length; i += li.channels) {
            inverted[i] = 255 - ld[i];
            inverted[i + 1] = 255 - ld[i + 1];
            inverted[i + 2] = 255 - ld[i + 2];
            inverted[i + 3] = ld[i + 3];
          }
          logoBuffer = await sharp(inverted, { raw: { width: li.width, height: li.height, channels: li.channels } }).png().toBuffer() as Buffer;
        }

        let logoScaleFactor: number;
        switch (printSize) {
          case 'small': logoScaleFactor = 0.25; break;
          case 'large': logoScaleFactor = 0.55; break;
          case 'medium': default: logoScaleFactor = 0.40; break;
        }

        let targetLogoW: number;
        if (refAnalysis) {
          const refLogoScale = refAnalysis.logoRegion.width / refAnalysis.productRegion.width;
          targetLogoW = Math.round(bagBounds.width * refLogoScale * (printSize === 'small' ? 0.7 : printSize === 'large' ? 1.3 : 1.0));
        } else {
          targetLogoW = Math.round(bagBounds.width * logoScaleFactor);
        }

        const resizedLogo = await sharp(logoBuffer)
          .resize(targetLogoW, null, { fit: 'inside', withoutEnlargement: true })
          .png().toBuffer();
        const rlMeta = await sharp(resizedLogo).metadata();
        const lw = rlMeta.width || targetLogoW;
        const lh = rlMeta.height || 60;

        let posX: number, posY: number;
        if (refAnalysis) {
          const pos = getLogoPosition(bagBounds, refAnalysis.logoRegion, refAnalysis.productRegion, printPosition, printSize, lw, lh, bw, bh);
          posX = pos.x;
          posY = pos.y;
        } else {
          posX = Math.round(bagBounds.x + (bagBounds.width - lw) / 2);
          posY = Math.round(bagBounds.y + bagBounds.height * 0.35 - lh / 2);
        }

        const isDarkBag = lum(...targetRgb) < 120;
        if (isDarkBag) {
          const { data: ld, info: li } = await sharp(resizedLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const whiteLogo = Buffer.alloc(ld.length);
          for (let i = 0; i < ld.length; i += li.channels) {
            whiteLogo[i] = 255; whiteLogo[i + 1] = 255; whiteLogo[i + 2] = 255;
            whiteLogo[i + 3] = ld[i + 3];
          }
          const resizedLogoWhite = await sharp(whiteLogo, { raw: { width: li.width, height: li.height, channels: 4 } }).png().toBuffer();

          const shadowBuf = await sharp(resizedLogoWhite)
            .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
            .then(({ data, info }) => {
              const sb = Buffer.alloc(info.width * info.height * 4);
              for (let i = 0; i < info.width * info.height; i++) {
                const si = i * info.channels, di = i * 4;
                sb[di] = 0; sb[di + 1] = 0; sb[di + 2] = 0; sb[di + 3] = Math.round(data[si + 3] * 0.18);
              }
              return sharp(sb, { raw: { width: info.width, height: info.height, channels: 4 } }).blur(4).png().toBuffer();
            });

          const safeW = Math.min(lw, bw - posX);
          const safeH = Math.min(lh, bh - posY);
          let textureBuf: Buffer;
          try {
            textureBuf = await sharp(baseBuffer)
              .extract({ left: posX, top: posY, width: safeW, height: safeH })
              .greyscale().raw().toBuffer({ resolveWithObject: true })
              .then(({ data, info }) => {
                const sb = Buffer.alloc(info.width * info.height * 4);
                for (let i = 0; i < info.width * info.height; i++) {
                  const v = data[i];
                  sb[i * 4] = v; sb[i * 4 + 1] = v; sb[i * 4 + 2] = v;
                  sb[i * 4 + 3] = Math.round(15 + (v / 255) * 12);
                }
                return sharp(sb, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
              });
          } catch {
            textureBuf = resizedLogoWhite;
          }

          const layers: sharp.OverlayOptions[] = [
            { input: shadowBuf, left: posX + 2, top: posY + 3, blend: 'over' },
            { input: resizedLogoWhite, left: posX, top: posY, blend: 'over' },
            { input: textureBuf, left: posX, top: posY, blend: 'multiply' },
          ];

          baseBuffer = await sharp(baseBuffer).composite(layers).png().toBuffer();
        } else {
          const { data: cleanData, info: cleanInfo } = await sharp(resizedLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const cleanedLogo = Buffer.alloc(cleanData.length);

          let logoLumSum = 0, logoLumCnt = 0;
          for (let i = 0; i < cleanData.length; i += cleanInfo.channels) {
            if (cleanData[i + 3] > 40) {
              logoLumSum += lum(cleanData[i], cleanData[i + 1], cleanData[i + 2]);
              logoLumCnt++;
            }
          }
          const logoAvgLum = logoLumCnt > 0 ? logoLumSum / logoLumCnt : 128;
          const isLightLogo = logoAvgLum > 160;

          for (let i = 0; i < cleanData.length; i += cleanInfo.channels) {
            const a = cleanData[i + 3];
            if (a > 40) {
              if (isLightLogo) {
                cleanedLogo[i] = 30;
                cleanedLogo[i + 1] = 30;
                cleanedLogo[i + 2] = 30;
              } else {
                cleanedLogo[i] = cleanData[i];
                cleanedLogo[i + 1] = cleanData[i + 1];
                cleanedLogo[i + 2] = cleanData[i + 2];
              }
              cleanedLogo[i + 3] = 255;
            } else {
              cleanedLogo[i] = 0; cleanedLogo[i + 1] = 0; cleanedLogo[i + 2] = 0; cleanedLogo[i + 3] = 0;
            }
          }

          const cleanLogoBuf = await sharp(cleanedLogo, { raw: { width: cleanInfo.width, height: cleanInfo.height, channels: 4 } })
            .trim({ threshold: 5 })
            .png().toBuffer();

          const cleanMeta = await sharp(cleanLogoBuf).metadata();
          const clw = cleanMeta.width || lw;
          const clh = cleanMeta.height || lh;

          posX = Math.round(bagBounds.x + (bagBounds.width - clw) / 2);
          posY = Math.round(bagBounds.y + (bagBounds.height - clh) / 2);

          const shadowBuf = await sharp(cleanLogoBuf)
            .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
            .then(({ data, info }) => {
              const sb = Buffer.alloc(info.width * info.height * 4);
              for (let i = 0; i < info.width * info.height; i++) {
                const si = i * info.channels, di = i * 4;
                sb[di] = 0; sb[di + 1] = 0; sb[di + 2] = 0; sb[di + 3] = Math.round(data[si + 3] * 0.10);
              }
              return sharp(sb, { raw: { width: info.width, height: info.height, channels: 4 } }).blur(3).png().toBuffer();
            });

          baseBuffer = await sharp(baseBuffer).composite([
            { input: shadowBuf, left: posX + 2, top: posY + 3, blend: 'over' },
            { input: cleanLogoBuf, left: posX, top: posY, blend: 'over' },
          ]).png().toBuffer();
        }
        imageSource += '+logo';
      } catch (err) {
        console.error('[product-image] Logo error:', err);
      }
    }

    const webpBuffer = await sharp(baseBuffer).webp({ quality: 92 }).toBuffer();

    imageCache.set(cacheKey, { buffer: webpBuffer, timestamp: Date.now() });

    return new NextResponse(new Uint8Array(webpBuffer), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Image-Source': imageSource },
    });
  } catch (error) {
    return fromError(error);
  }
}
