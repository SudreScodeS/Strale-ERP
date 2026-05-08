// app/lib/logo-replacer.ts
// Port of Logo Replacer Pro (replacer.py) to TypeScript/Sharp
// Professional logo compositing engine — 100% local, no external APIs
//
// Features ported from Python:
// 1. Multi-strategy background removal (flood-fill + grab-foreground + edge refinement)
// 2. Multi-scale logo region detection (block analysis with scoring)
// 3. Luminance-preserving recolorization
// 4. Professional compositing (shadow, specular, lighting match)

import sharp from 'sharp';

// ==========================================
// Types
// ==========================================

export interface ReplacerOptions {
  color?: string;
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'full';
  colorIntensity?: number;
  removeBackground?: boolean;
  bgTolerance?: number;
  addShadow?: boolean;
  addHighlight?: boolean;
  manualRegion?: { x: number; y: number; width: number; height: number };
}

const COLOR_MAP: Record<string, [number, number, number]> = {
  red: [200, 30, 30], blue: [30, 60, 200], green: [30, 160, 50],
  black: [20, 20, 20], white: [240, 240, 240], yellow: [240, 210, 30],
  purple: [120, 40, 180], orange: [240, 130, 20], pink: [240, 100, 160],
  cyan: [30, 180, 220], gray: [128, 128, 128], navy: [20, 30, 80],
  maroon: [120, 20, 20], gold: [210, 175, 50], beige: [210, 190, 160],
  vermelho: [200, 30, 30], azul: [30, 60, 200], verde: [30, 160, 50],
  preto: [20, 20, 20], branco: [240, 240, 240], amarelo: [240, 210, 30],
  roxo: [120, 40, 180], laranja: [240, 130, 20], rosa: [240, 100, 160],
  cinza: [128, 128, 128], marrom: [120, 60, 20], dourado: [210, 175, 50],
  bege: [210, 190, 160],
};

const SIZE_MAP: Record<string, number> = {
  tiny: 0.15, small: 0.25, medium: 0.50, large: 0.75, full: 0.90,
};

// ==========================================
// Color utilities
// ==========================================

function colorDist(c1: [number, number, number], c2: [number, number, number]): number {
  const dr = c1[0] - c2[0], dg = c1[1] - c2[1], db = c1[2] - c2[2];
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

function lum(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function resolveColor(s: string): [number, number, number] | null {
  if (s.startsWith('#')) return hexToRgb(s);
  return COLOR_MAP[s.toLowerCase()] || null;
}

// ==========================================
// 1. Background Removal — Multi-strategy
// ==========================================

function autoDetectBg(data: Buffer, w: number, h: number, ch: number): [number, number, number] {
  const samples: Map<string, number> = new Map();
  const depth = Math.max(1, Math.min(5, Math.floor(w / 4), Math.floor(h / 4)));
  for (let off = 0; off < depth; off++) {
    for (let x = 0; x < w; x++) {
      for (const row of [off, h - 1 - off]) {
        if (row < 0 || row >= h) continue;
        const i = (row * w + x) * ch;
        const k = `${Math.floor(data[i] / 6)},${Math.floor(data[i + 1] / 6)},${Math.floor(data[i + 2] / 6)}`;
        samples.set(k, (samples.get(k) || 0) + 1);
      }
    }
    for (let y = 0; y < h; y++) {
      for (const col of [off, w - 1 - off]) {
        if (col < 0 || col >= w) continue;
        const i = (y * w + col) * ch;
        const k = `${Math.floor(data[i] / 6)},${Math.floor(data[i + 1] / 6)},${Math.floor(data[i + 2] / 6)}`;
        samples.set(k, (samples.get(k) || 0) + 1);
      }
    }
  }
  let best = '42,42,42', bestN = 0;
  for (const [k, n] of samples) { if (n > bestN) { bestN = n; best = k; } }
  const p = best.split(',').map(Number);
  return [p[0] * 6, p[1] * 6, p[2] * 6];
}

function grabFg(data: Buffer, w: number, h: number, ch: number, bg: [number, number, number], tol: number): Buffer {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * ch, di = (y * w + x) * 4;
      const r = data[si], g = data[si + 1], b = data[si + 2];
      const d = colorDist([r, g, b], bg);
      if (d < tol * 0.8) {
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 0;
      } else if (d < tol * 1.5) {
        const ratio = (d - tol * 0.8) / (tol * 0.7);
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = Math.round(255 * Math.max(0, Math.min(1, ratio)));
      } else {
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 255;
      }
    }
  }
  return out;
}

function floodFill(data: Buffer, w: number, h: number, ch: number, tol: number): Buffer {
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const si = i * ch, di = i * 4;
    out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = 255;
  }
  const isBg = new Uint8Array(w * h);
  const bgRef = new Map<number, [number, number, number]>();
  const queue: number[] = [];
  for (let x = 0; x < w; x++) { queue.push(x); queue.push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { queue.push(y * w); queue.push(y * w + w - 1); }

  while (queue.length > 0) {
    const pos = queue.pop()!;
    if (isBg[pos]) continue;
    const x = pos % w, y = Math.floor(pos / w);
    const di = pos * 4;
    const r = out[di], g = out[di + 1], b = out[di + 2];
    const ref = bgRef.get(pos);
    if (ref === undefined) {
      isBg[pos] = 1; out[di + 3] = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const np = ny * w + nx;
          if (!isBg[np] && !bgRef.has(np)) { bgRef.set(np, [r, g, b]); queue.push(np); }
        }
      }
      continue;
    }
    const d = colorDist([r, g, b], ref);
    const edgeBonus = Math.min(x, w - 1 - x, y, h - 1 - y) < 8 ? tol * 0.4 : 0;
    if (d < tol + edgeBonus) {
      isBg[pos] = 1; out[di + 3] = 0;
      const nr: [number, number, number] = [Math.round(ref[0] * 0.7 + r * 0.3), Math.round(ref[1] * 0.7 + g * 0.3), Math.round(ref[2] * 0.7 + b * 0.3)];
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const np = ny * w + nx;
          if (!isBg[np] && !bgRef.has(np)) { bgRef.set(np, nr); queue.push(np); }
        }
      }
    }
  }
  return out;
}

function autoTolerance(data: Buffer, w: number, h: number, ch: number): number {
  const vals: number[] = [];
  for (let x = 0; x < w; x++) {
    vals.push(lum(data[x * ch], data[x * ch + 1], data[x * ch + 2]));
    const bi = ((h - 1) * w + x) * ch;
    vals.push(lum(data[bi], data[bi + 1], data[bi + 2]));
  }
  for (let y = 0; y < h; y++) {
    const li = (y * w) * ch;
    vals.push(lum(data[li], data[li + 1], data[li + 2]));
    const ri = (y * w + w - 1) * ch;
    vals.push(lum(data[ri], data[ri + 1], data[ri + 2]));
  }
  if (vals.length === 0) return 50;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  if (std < 15) return 35;
  if (std < 40) return 50;
  return 70;
}

export async function removeBg(logoBuffer: Buffer, tolerance?: number): Promise<Buffer> {
  const { data, info } = await sharp(logoBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const tol = tolerance ?? autoTolerance(data, w, h, ch);
  const bg = autoDetectBg(data, w, h, ch);

  const imgFlood = floodFill(data, w, h, ch, tol);
  const imgGrab = grabFg(data, w, h, ch, bg, tol);

  const combined = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const fi = i * 4;
    if (imgFlood[fi + 3] <= imgGrab[fi + 3]) {
      combined[fi] = imgFlood[fi]; combined[fi + 1] = imgFlood[fi + 1]; combined[fi + 2] = imgFlood[fi + 2]; combined[fi + 3] = imgFlood[fi + 3];
    } else {
      combined[fi] = imgGrab[fi]; combined[fi + 1] = imgGrab[fi + 1]; combined[fi + 2] = imgGrab[fi + 2]; combined[fi + 3] = imgGrab[fi + 3];
    }
  }

  // Edge refinement
  const cleaned = Buffer.from(combined);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4 + 3;
      let opq = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (combined[((y + dy) * w + (x + dx)) * 4 + 3] > 128) opq++;
      }
      if (combined[idx] < 64 && opq >= 6) cleaned[idx] = 200;
      else if (combined[idx] > 128 && opq <= 1) cleaned[idx] = 0;
    }
  }

  return sharp(cleaned, { raw: { width: w, height: h, channels: 4 } }).ensureAlpha().png().toBuffer();
}

// ==========================================
// 2. Logo Region Detection
// ==========================================

interface Block { bx: number; by: number; variance: number; localDiff: number; edgeDensity: number; centerDist: number; score: number; }

function analyzeBlocks(gray: Buffer, w: number, h: number, bs: number): { blocks: Block[]; cols: number; rows: number } {
  const cols = Math.floor(w / bs), rows = Math.floor(h / bs);
  const blocks: Block[] = [];
  const blurR = Math.max(1, Math.floor(bs / 2));
  const blurred = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0, cnt = 0;
    for (let dy = -blurR; dy <= blurR; dy++) for (let dx = -blurR; dx <= blurR; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) { sum += gray[ny * w + nx]; cnt++; }
    }
    blurred[y * w + x] = Math.round(sum / cnt);
  }

  for (let by = 0; by < rows; by++) for (let bx = 0; bx < cols; bx++) {
    const vals: number[] = [];
    for (let dy = 0; dy < bs; dy++) for (let dx = 0; dx < bs; dx++) {
      const px = bx * bs + dx, py = by * bs + dy;
      if (px < w && py < h) vals.push(gray[py * w + px]);
    }
    if (vals.length === 0) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const cx = bx * bs + Math.floor(bs / 2), cy = by * bs + Math.floor(bs / 2);
    const localBlur = cx < w && cy < h ? blurred[cy * w + cx] : mean;
    const localDiff = Math.abs(mean - localBlur);

    let edges = 0, total = 0;
    for (let dy = 1; dy < bs - 1; dy++) for (let dx = 1; dx < bs - 1; dx++) {
      const px = bx * bs + dx, py = by * bs + dy;
      if (px >= w - 1 || py >= h - 1) continue;
      const p = (py2: number, px2: number) => gray[py2 * w + px2];
      const gx = -p(py - 1, px - 1) + p(py - 1, px + 1) - 2 * p(py, px - 1) + 2 * p(py, px + 1) - p(py + 1, px - 1) + p(py + 1, px + 1);
      const gy = -p(py - 1, px - 1) - 2 * p(py - 1, px) - p(py - 1, px + 1) + p(py + 1, px - 1) + 2 * p(py + 1, px) + p(py + 1, px + 1);
      if (Math.sqrt(gx * gx + gy * gy) > 25) edges++;
      total++;
    }
    const edgeDensity = total > 0 ? edges / total : 0;
    const nc = 1.0 - Math.min(Math.sqrt(((bx + 0.5) / cols - 0.5) ** 2 + ((by + 0.5) / rows - 0.5) ** 2) * 2, 1.0);
    blocks.push({ bx, by, variance, localDiff, edgeDensity, centerDist: nc, score: 0 });
  }
  return { blocks, cols, rows };
}

function scoreBlocks(blocks: Block[]): Block[] {
  if (blocks.length === 0) return blocks;
  const maxV = Math.max(...blocks.map(b => b.variance)) || 1;
  const maxD = Math.max(...blocks.map(b => b.localDiff)) || 1;
  const maxE = Math.max(...blocks.map(b => b.edgeDensity)) || 1;
  for (const b of blocks) {
    const nv = b.variance / maxV, nd = b.localDiff / maxD, ne = b.edgeDensity / maxE;
    const vs = 1.0 - Math.abs(nv - 0.4) * 2;
    let es: number;
    if (ne < 0.15) es = (ne / 0.15) * 0.5;
    else if (ne < 0.6) es = 0.5 + ((ne - 0.15) / 0.45) * 0.5;
    else es = Math.max(0, 1.0 - (ne - 0.6) / 0.4);
    b.score = vs * 0.20 + nd * 0.35 + es * 0.25 + b.centerDist * 0.20;
  }
  return blocks;
}

export async function detectRegion(buf: Buffer): Promise<{ x: number; y: number; width: number; height: number }> {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let best: { x: number; y: number; width: number; height: number } | null = null;
  let bestConf = -1;

  for (const bs of [Math.max(12, Math.floor(Math.min(w, h) / 50)), Math.max(20, Math.floor(Math.min(w, h) / 30)), Math.max(30, Math.floor(Math.min(w, h) / 20))]) {
    const { blocks, cols, rows } = analyzeBlocks(data, w, h, bs);
    if (blocks.length === 0) continue;
    const scored = scoreBlocks([...blocks]);
    const scores = scored.map(b => b.score);
    const conf = Math.max(...scores) - (scores.reduce((a, b) => a + b, 0) / scores.length);
    if (conf > bestConf) {
      bestConf = conf;
      const sorted = [...scored].sort((a, b) => b.score - a.score);
      const top = sorted.slice(0, Math.max(4, Math.floor(sorted.length / 5)));
      let rx = Math.min(...top.map(b => b.bx)) * bs;
      let ry = Math.min(...top.map(b => b.by)) * bs;
      let rw = (Math.max(...top.map(b => b.bx)) - Math.min(...top.map(b => b.bx)) + 1) * bs;
      let rh = (Math.max(...top.map(b => b.by)) - Math.min(...top.map(b => b.by)) + 1) * bs;
      const pad = bs * 2;
      rx = Math.max(0, rx - pad); ry = Math.max(0, ry - pad);
      rw = Math.min(w - rx, rw + 2 * pad); rh = Math.min(h - ry, rh + 2 * pad);
      if (rw < Math.min(w, h) * 0.06 || rh < Math.min(w, h) * 0.06) {
        rw = rh = Math.round(Math.min(w, h) * 0.25);
        rx = Math.floor((w - rw) / 2); ry = Math.floor((h - rh) / 2);
      }
      best = { x: rx, y: ry, width: rw, height: rh };
    }
  }
  return best || { x: Math.floor(w / 4), y: Math.floor(h / 4), width: Math.floor(w / 2), height: Math.floor(h / 2) };
}

// ==========================================
// 3. Recolorization
// ==========================================

export async function recolor(buf: Buffer, target: [number, number, number], intensity = 0.75): Promise<Buffer> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const out = Buffer.alloc(w * h * 4);
  const [tr, tg, tb] = target;
  const tLum = lum(tr, tg, tb);

  let tSum = 0, cnt = 0;
  for (let i = 0; i < w * h; i++) {
    const si = i * ch;
    if (data[si + 3] > 10) { tSum += lum(data[si], data[si + 1], data[si + 2]); cnt++; }
  }
  const avgLum = cnt > 0 ? tSum / cnt : 128;

  for (let i = 0; i < w * h; i++) {
    const si = i * ch, di = i * 4;
    const r = data[si], g = data[si + 1], b = data[si + 2], a = data[si + 3];
    if (a === 0) { out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 0; continue; }
    const oLum = lum(r, g, b);
    let lr = avgLum > 0 ? oLum / avgLum : 1.0;
    lr = Math.max(0.15, Math.min(3.5, lr));
    let nr = tLum * lr * (tr / Math.max(tLum, 1));
    let ng = tLum * lr * (tg / Math.max(tLum, 1));
    let nb = tLum * lr * (tb / Math.max(tLum, 1));
    nr = r * (1 - intensity) + nr * intensity;
    ng = g * (1 - intensity) + ng * intensity;
    nb = b * (1 - intensity) + nb * intensity;
    out[di] = Math.max(0, Math.min(255, Math.round(nr)));
    out[di + 1] = Math.max(0, Math.min(255, Math.round(ng)));
    out[di + 2] = Math.max(0, Math.min(255, Math.round(nb)));
    out[di + 3] = a;
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).ensureAlpha().png().toBuffer();
}

// ==========================================
// 4. Compositing
// ==========================================

async function sampleLighting(base: Buffer, region: { x: number; y: number; width: number; height: number }): Promise<number> {
  const meta = await sharp(base).metadata();
  const iw = meta.width || 512, ih = meta.height || 640;
  const l = Math.max(0, Math.min(region.x, iw - region.width));
  const t = Math.max(0, Math.min(region.y, ih - region.height));
  const rw = Math.min(region.width, iw - l), rh = Math.min(region.height, ih - t);
  if (rw <= 0 || rh <= 0) return 128;
  const rd = await sharp(base).extract({ left: l, top: t, width: rw, height: rh }).greyscale().raw().toBuffer();
  const step = Math.max(1, Math.floor(Math.min(rw, rh) / 20));
  let sum = 0, cnt = 0;
  for (let y = 0; y < rh; y += step) for (let x = 0; x < rw; x += step) { sum += rd[y * rw + x]; cnt++; }
  return cnt > 0 ? sum / cnt : 128;
}

async function applyLighting(logo: Buffer, targetLum: number): Promise<Buffer> {
  const { data, info } = await sharp(logo).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, cnt = 0;
  for (let i = 0; i < info.width * info.height; i++) { if (data[i] > 10) { sum += data[i]; cnt++; } }
  if (cnt === 0) return logo;
  const curLum = sum / cnt;
  if (curLum === 0) return logo;
  const ratio = Math.max(0.35, Math.min(2.5, targetLum / curLum));
  return sharp(logo).modulate({ brightness: ratio }).toBuffer();
}

async function makeShadow(logo: Buffer, w: number, h: number, opacity = 0.18, blur = 6): Promise<Buffer> {
  const { data, info } = await sharp(logo).resize(w, h, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sb = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const si = i * info.channels, di = i * 4;
    sb[di] = 0; sb[di + 1] = 0; sb[di + 2] = 0; sb[di + 3] = Math.round(data[si + 3] * opacity);
  }
  return sharp(sb, { raw: { width: info.width, height: info.height, channels: 4 } }).blur(blur).png().toBuffer();
}

async function makeSpecular(w: number, h: number, intensity = 12): Promise<Buffer> {
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const a = y < h / 3 ? Math.round(intensity * (1 - y / (h / 3))) : 0;
    buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = Math.max(0, a);
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

// ==========================================
// Main Pipeline
// ==========================================

export async function replaceLogo(baseBuffer: Buffer, logoBuffer: Buffer, options: ReplacerOptions = {}): Promise<Buffer> {
  const {
    color, size = 'medium', colorIntensity = 0.75,
    removeBackground: shouldRemoveBg = true, bgTolerance,
    addShadow = true, addHighlight = true, manualRegion,
  } = options;

  // 1. Clean logo
  let cleanLogo = shouldRemoveBg ? await removeBg(logoBuffer, bgTolerance) : await sharp(logoBuffer).ensureAlpha().png().toBuffer();
  try { cleanLogo = await sharp(cleanLogo).trim({ threshold: 10 }).png().toBuffer(); } catch { /* ok */ }

  // 2. Detect region
  const region = manualRegion || await detectRegion(baseBuffer);

  // 3. Recolor
  let base = baseBuffer;
  if (color) { const rgb = resolveColor(color); if (rgb) base = await recolor(base, rgb, colorIntensity); }

  // 4. Size
  const scale = SIZE_MAP[size] || 0.5;
  let tw = Math.max(1, Math.round(region.width * scale));
  let th = Math.max(1, Math.round(region.height * scale));
  const lm = await sharp(cleanLogo).metadata();
  const lr = (lm.width || 1) / (lm.height || 1);
  if (tw / Math.max(th, 1) > lr) tw = Math.max(1, Math.round(th * lr));
  else th = Math.max(1, Math.round(tw / lr));

  let processed = await sharp(cleanLogo).resize(tw, th, { fit: 'inside', withoutEnlargement: true }).ensureAlpha().png().toBuffer();

  // 5. Lighting
  const targetLum = await sampleLighting(base, region);
  processed = await applyLighting(processed, targetLum);

  // 6. Position
  const lx = region.x + Math.floor((region.width - tw) / 2);
  const ly = region.y + Math.floor((region.height - th) / 2);

  // 7. Composite
  const layers: sharp.OverlayOptions[] = [];
  if (addShadow) {
    const shadow = await makeShadow(processed, tw, th);
    layers.push({ input: shadow, left: lx + 4, top: ly + 4, blend: 'over' });
  }
  layers.push({ input: processed, left: lx, top: ly, blend: 'multiply' });
  if (addHighlight) {
    const spec = await makeSpecular(tw, th);
    layers.push({ input: spec, left: lx, top: ly, blend: 'over' });
  }

  let result = await sharp(base).composite(layers).png().toBuffer();
  try { result = await sharp(result).sharpen({ sigma: 0.5, m1: 0.5, m2: 0.5 }).png().toBuffer(); } catch { /* ok */ }
  return result;
}

/**
 * Quick preview — lighter pipeline for real-time use
 */
export async function quickPreview(baseBuffer: Buffer, logoBuffer: Buffer, options: ReplacerOptions = {}): Promise<Buffer> {
  const { color, size = 'medium', colorIntensity = 0.75, manualRegion } = options;

  let cleanLogo = await removeBg(logoBuffer, 40);
  try { cleanLogo = await sharp(cleanLogo).trim({ threshold: 10 }).png().toBuffer(); } catch { /* ok */ }

  const region = manualRegion || await detectRegion(baseBuffer);

  let base = baseBuffer;
  if (color) { const rgb = resolveColor(color); if (rgb) base = await recolor(base, rgb, colorIntensity); }

  const scale = SIZE_MAP[size] || 0.5;
  let tw = Math.max(1, Math.round(region.width * scale));
  let th = Math.max(1, Math.round(region.height * scale));
  const lm = await sharp(cleanLogo).metadata();
  const lr = (lm.width || 1) / (lm.height || 1);
  if (tw / Math.max(th, 1) > lr) tw = Math.max(1, Math.round(th * lr));
  else th = Math.max(1, Math.round(tw / lr));

  const processed = await sharp(cleanLogo).resize(tw, th, { fit: 'inside', withoutEnlargement: true }).ensureAlpha().png().toBuffer();
  const lx = region.x + Math.floor((region.width - tw) / 2);
  const ly = region.y + Math.floor((region.height - th) / 2);
  const shadow = await makeShadow(processed, tw, th, 0.12, 4);

  return sharp(base).composite([
    { input: shadow, left: lx + 3, top: ly + 3, blend: 'over' },
    { input: processed, left: lx, top: ly, blend: 'multiply' },
  ]).png().toBuffer();
}
