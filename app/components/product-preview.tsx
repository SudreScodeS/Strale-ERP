// app/components/product-preview.tsx
// Product preview with realistic logo compositing
// ALWAYS uses canvas for final rendering — no CSS overlay fallback
// Pipeline: API/real-image → Canvas draw → Logo composite with print effects

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAuthHeaders } from '../lib/authClient';

export interface PreviewConfig {
  productImageUrl: string;
  productName: string;
  logoDataUrl: string | null;
  referenceImageUrl?: string | null;
  selectedColorHex?: string;
  selectedColorName?: string;
  selectedMaterialName?: string;
  selectedVariables?: string[];
  printPosition?: string;
  printSize?: string;
  quantity?: number;
  unitPrice?: number;
}

interface ProductPreviewProps {
  config: PreviewConfig;
  onPreviewGenerated?: (dataUrl: string) => void;
  className?: string;
  compact?: boolean;
}

// ==========================================
// Default colors by product type
// ==========================================

const DEFAULT_PRODUCT_COLORS: Record<string, string> = {
  sacola: '#2563eb',
  camiseta: '#f8fafc',
  caneca: '#f8fafc',
  default: '#2563eb',
};

function getDefaultColor(productName?: string): string {
  const lower = (productName || '').toLowerCase();
  for (const [key, color] of Object.entries(DEFAULT_PRODUCT_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return DEFAULT_PRODUCT_COLORS.default;
}

function getProductStyle(productName?: string): string {
  const lower = (productName || '').toLowerCase();
  if (lower.includes('camiseta') || lower.includes('camisa')) return 'camiseta';
  if (lower.includes('caneca') || lower.includes('mug')) return 'caneca';
  return 'sacola';
}

// ==========================================
// Print area positioning (matches server-side)
// ==========================================

function getPrintArea(
  canvasW: number,
  canvasH: number,
  style: string,
): { x: number; y: number; width: number; height: number } {
  const areas: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }> = {
    sacola:   { xPct: 0.12, yPct: 0.20, wPct: 0.76, hPct: 0.50 },
    camiseta: { xPct: 0.22, yPct: 0.18, wPct: 0.56, hPct: 0.38 },
    caneca:   { xPct: 0.18, yPct: 0.15, wPct: 0.64, hPct: 0.60 },
  };
  const area = areas[style] || areas.sacola;
  return {
    x: Math.round(canvasW * area.xPct),
    y: Math.round(canvasH * area.yPct),
    width: Math.round(canvasW * area.wPct),
    height: Math.round(canvasH * area.hPct),
  };
}

// ==========================================
// Dynamic blend mode based on product brightness
// ==========================================

function getBlendMode(hexColor: string): GlobalCompositeOperation {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return 'multiply';
  const brightness = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
  if (brightness < 80) return 'overlay';
  if (brightness > 200) return 'multiply';
  return 'soft-light';
}

// ==========================================
// Component
// ==========================================

export default function ProductPreview({
  config,
  onPreviewGenerated,
  className = '',
  compact = false,
}: ProductPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [apiImage, setApiImage] = useState<HTMLImageElement | null>(null);
  const [realProductImage, setRealProductImage] = useState<HTMLImageElement | null>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageSource, setImageSource] = useState<string>('none');

  const {
    productImageUrl,
    productName,
    logoDataUrl,
    referenceImageUrl,
    selectedColorHex,
    selectedColorName,
    selectedMaterialName,
    selectedVariables = [],
    printPosition,
    printSize,
    quantity,
    unitPrice,
  } = config;

  const productColor = selectedColorHex || getDefaultColor(productName);
  const hasRealImage = Boolean(productImageUrl);
  const productStyle = getProductStyle(productName);

  // Cache key
  const logoShortHash = logoDataUrl ? logoDataUrl.substring(logoDataUrl.length - 20) : 'nologo';
  const refShortHash = referenceImageUrl ? referenceImageUrl.substring(referenceImageUrl.length - 10) : 'noref';
  const variablesKey = selectedVariables.join(',');
  const generationKey = `${productColor}-${productStyle}-${variablesKey}-${logoShortHash}-${refShortHash}`;

  // ==========================================
  // 1. Load real product image (always, if URL exists)
  // ==========================================
  useEffect(() => {
    if (!productImageUrl) { setRealProductImage(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setRealProductImage(img);
    img.onerror = () => setRealProductImage(null);
    img.src = productImageUrl;
  }, [productImageUrl]);

  // ==========================================
  // 2. Fetch generated/composited image from API
  //    When logo exists: ALWAYS call API for proper compositing
  // ==========================================
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    // Always call API to apply color recoloring (logo is optional)
    // Only skip if we have a real image AND no color change AND no logo
    if (hasRealImage && !logoDataUrl && !selectedColorHex) return;

    const cached = imageCacheRef.current.get(generationKey);
    if (cached) {
      setApiImage(cached);
      return;
    }

    let cancelled = false;

    async function generateImage() {
      setLoading(true);
      setError('');

      try {
        const body: Record<string, unknown> = {
          color: productColor,
          style: productStyle,
          variables: selectedVariables,
          material: selectedMaterialName,
          printPosition: printPosition || 'front',
          printSize: printSize || 'medium',
        };
        if (logoDataUrl) body.logoDataUrl = logoDataUrl;
        if (referenceImageUrl) body.referenceImageUrl = referenceImageUrl;

        // Send real product photo as base
        if (hasRealImage && productImageUrl) {
          try {
            const imgResp = await fetch(productImageUrl);
            const imgBlob = await imgResp.blob();
            const imgBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(imgBlob);
            });
            body.productImageBase64 = imgBase64;
          } catch {
            console.warn('[product-preview] Could not convert product image to base64');
          }
        }

        const response = await fetch('/api/product-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(body),
        });

        if (cancelled) return;

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data.fallback) {
            setApiImage(null);
            setError('IA não configurada — usando composição local');
            setLoading(false);
            return;
          }
          if (data.retry) {
            setTimeout(() => { if (!cancelled) void generateImage(); }, 3000);
            return;
          }
          throw new Error(data.error || 'Erro ao gerar imagem');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const src = response.headers.get('X-Image-Source');
        if (!cancelled) setImageSource(src || 'ai');

        const img = new Image();
        img.onload = () => {
          if (cancelled) { URL.revokeObjectURL(url); return; }
          imageCacheRef.current.set(generationKey, img);
          setApiImage(img);
          setLoading(false);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          if (!cancelled) { setError('Erro ao carregar imagem'); setLoading(false); }
        };
        img.src = url;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro na geração');
          setLoading(false);
        }
      }
    }

    void generateImage();
    return () => { cancelled = true; };
  }, [generationKey, hasRealImage, productColor, productStyle, selectedVariables, logoDataUrl, referenceImageUrl]);

  // ==========================================
  // 3. Load logo as Image
  // ==========================================
  useEffect(() => {
    if (!logoDataUrl) { setLogoImage(null); return; }
    const img = new Image();
    img.onload = () => setLogoImage(img);
    img.onerror = () => setLogoImage(null);
    img.src = logoDataUrl;
  }, [logoDataUrl]);

  // ==========================================
  // 4. Canvas rendering — ALWAYS draws base + composites logo
  //    No CSS overlay fallback. Canvas is the single source of truth.
  // ==========================================
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // ─────────────────────────────────────
    // Determine base image: API result (with color applied) > fallback SVG
    // Always prefer API result — it has the correct color applied
    // ─────────────────────────────────────
    const baseImg = apiImage || realProductImage;

    if (baseImg) {
      // ─────────────────────────────────────
      // Draw base image (fit to canvas, centered)
      // ─────────────────────────────────────
      const imgRatio = baseImg.width / baseImg.height;
      const canvasRatio = w / h;
      let drawW: number, drawH: number, drawX: number, drawY: number;

      if (imgRatio > canvasRatio) {
        drawW = w; drawH = w / imgRatio; drawX = 0; drawY = (h - drawH) / 2;
      } else {
        drawH = h; drawW = h * imgRatio; drawX = (w - drawW) / 2; drawY = 0;
      }

      ctx.drawImage(baseImg, drawX, drawY, drawW, drawH);

      // ─────────────────────────────────────
      // Composite logo (if present and not already baked in)
      // ─────────────────────────────────────
      // Logo is already composited in API result — never draw again
      const alreadyComposited = Boolean(apiImage) || imageSource === 'composited' || imageSource === 'composited-ref' ||
        imageSource === 'ai-refined-with-logo' || imageSource === 'ai-with-logo' ||
        imageSource === 'logo-composited' || imageSource === 'logo-replacer' ||
        imageSource === 'recolored-photo' || imageSource === 'local-recolor' ||
        (imageSource && imageSource.includes('+logo'));

      if (logoImage && !alreadyComposited) {
        const area = getPrintArea(drawW, drawH, productStyle);
        const logoAreaX = drawX + area.x;
        const logoAreaY = drawY + area.y;

        // Scale: 75% of print area
        const maxLogoW = area.width * 0.75;
        const maxLogoH = area.height * 0.75;
        const logoRatio = logoImage.width / logoImage.height;
        let logoW: number, logoH: number;

        if (logoRatio > maxLogoW / maxLogoH) {
          logoW = maxLogoW; logoH = logoW / logoRatio;
        } else {
          logoH = maxLogoH; logoW = logoH * logoRatio;
        }

        // Position: centered horizontally, 40% from top of print area
        const logoX = logoAreaX + (area.width - logoW) / 2;
        const logoY = logoAreaY + area.height * 0.40 - logoH / 2;

        // Dynamic blend mode based on product color
        const blendMode = getBlendMode(productColor);

        // ─────────────────────────────────────
        // PERSPECTIVE DEFORMATION
        // Simulates the logo following the product's 3D form.
        // Draw logo onto a temporary canvas, then map it to a
        // perspective-distorted quadrilateral.
        // ─────────────────────────────────────
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.ceil(logoW);
        offscreen.height = Math.ceil(logoH);
        const offCtx = offscreen.getContext('2d')!;
        offCtx.drawImage(logoImage, 0, 0, logoW, logoH);

        // Perspective parameters — subtle 3D effect
        // Top is slightly narrower (viewed from above), bottom slightly wider
        const perspectiveStrength = 0.04; // 4% perspective distortion
        const topNarrow = logoW * perspectiveStrength;
        const bottomWide = logoW * perspectiveStrength * 0.5;

        // Source quad corners (flat rectangle)
        const sx = [0, logoW, logoW, 0];
        const sy = [0, 0, logoH, logoH];

        // Destination quad corners (perspective distorted)
        const dx = [logoX + topNarrow, logoX + logoW - topNarrow, logoX + logoW + bottomWide, logoX - bottomWide];
        const dy = [logoY, logoY, logoY + logoH, logoY + logoH];

        // Draw shadow first (offset, blurred)
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.filter = 'blur(4px)';
        drawPerspectiveQuad(ctx, offscreen,
          sx, sy,
          dx.map((x, i) => x + (i < 2 ? 2 : 3)),
          dy.map((y, i) => y + (i < 2 ? 2 : 4)),
        );
        ctx.filter = 'none';
        ctx.restore();

        // Draw logo with perspective + blend mode
        ctx.save();
        ctx.globalCompositeOperation = blendMode;
        ctx.globalAlpha = 0.92;
        drawPerspectiveQuad(ctx, offscreen, sx, sy, dx, dy);
        ctx.restore();

        // Surface lighting overlay — product luminance through logo
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.10;
        const areaCrop = document.createElement('canvas');
        areaCrop.width = Math.ceil(area.width);
        areaCrop.height = Math.ceil(area.height);
        const areaCtx = areaCrop.getContext('2d')!;
        areaCtx.drawImage(baseImg, drawX + area.x, drawY + area.y, area.width, area.height, 0, 0, area.width, area.height);
        drawPerspectiveQuad(ctx, areaCrop, [0, area.width, area.width, 0], [0, 0, area.height, area.height], dx, dy);
        ctx.restore();

        // Edge darkening — ink absorption at logo boundary
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.05;
        const shrink = Math.max(1, logoW * 0.008);
        drawPerspectiveQuad(ctx, offscreen, sx, sy,
          dx.map((x, i) => i < 2 ? x + shrink : x - shrink * 0.5),
          dy.map((y, i) => i < 2 ? y + shrink : y - shrink * 0.5),
        );
        ctx.restore();

        // Highlight sheen — directional gloss gradient
        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = 0.4;
        const sheenGrad = ctx.createLinearGradient(logoX, logoY, logoX + logoW, logoY + logoH);
        sheenGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
        sheenGrad.addColorStop(0.35, 'rgba(255,255,255,0)');
        sheenGrad.addColorStop(0.65, 'rgba(0,0,0,0)');
        sheenGrad.addColorStop(1, 'rgba(0,0,0,0.04)');
        ctx.fillStyle = sheenGrad;
        ctx.beginPath();
        ctx.moveTo(dx[0], dy[0]);
        for (let i = 1; i < 4; i++) ctx.lineTo(dx[i], dy[i]);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else {
      // ─────────────────────────────────────
      // Fallback: canvas-drawn bag illustration
      // ─────────────────────────────────────
      drawFallbackBag(ctx, w, h, productColor, logoImage);
    }

    // Notify parent
    if (onPreviewGenerated) {
      try { onPreviewGenerated(canvas.toDataURL('image/png')); } catch { /* ignore */ }
    }
  }, [apiImage, realProductImage, logoImage, productColor, onPreviewGenerated, imageSource, productStyle]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // ==========================================
  // Render — canvas is ALWAYS in the DOM
  // ==========================================

  if (compact) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
        <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'transparent' }}>
          <canvas ref={canvasRef} width={400} height={500} className="w-full h-full object-contain" />
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(19, 17, 26, 0.6)' }}>
              <div className="flex flex-col items-center gap-2">
                <svg className="h-6 w-6 animate-spin text-[var(--brand)]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-[10px] text-[var(--text-secondary)]">Processando…</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm ${className}`}>
      <div className="relative w-full overflow-hidden" style={{ backgroundColor: 'transparent', aspectRatio: '4/5' }}>
        <canvas ref={canvasRef} width={768} height={960} className="w-full h-full object-contain" />

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(19, 17, 26, 0.5)' }}>
            <div className="flex flex-col items-center gap-3">
              <svg className="h-8 w-8 animate-spin text-[var(--brand)]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-[var(--text-secondary)]">Processando com Logo Replacer Pro…</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute bottom-2 left-2 right-2">
            <p className="text-[10px] text-[var(--warning)] bg-[var(--warning-bg)] rounded-lg px-2 py-1 text-center">{error}</p>
          </div>
        ) : null}

        {apiImage && imageSource !== 'none' ? (
          <div className="absolute top-2 left-2">
            <span className="text-[9px] bg-[var(--info-bg)] text-[var(--info)] rounded-full px-2 py-0.5 font-medium">
              Logo Replacer Pro
            </span>
          </div>
        ) : !loading && !error && !apiImage ? (
          <div className="absolute top-2 left-2">
            <span className="text-[9px] bg-[var(--surface-muted)] text-[var(--text-muted)] rounded-full px-2 py-0.5 font-medium">
              Composicao local
            </span>
          </div>
        ) : null}

        {selectedColorHex ? (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
            <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: selectedColorHex }} />
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">{selectedColorName || 'Cor'}</span>
          </div>
        ) : null}
      </div>

      <div className="p-4 space-y-1.5">
        <h4 className="font-semibold text-[var(--text-primary)] text-sm leading-tight">{productName}</h4>
        {selectedMaterialName ? (
          <p className="text-xs text-[var(--text-muted)]">Material: <span className="text-[var(--text-primary)] font-medium">{selectedMaterialName}</span></p>
        ) : null}
        {selectedColorName ? (
          <p className="text-xs text-[var(--text-muted)]">Cor: <span className="text-[var(--text-primary)] font-medium">{selectedColorName}</span></p>
        ) : null}
        {quantity && quantity > 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Qtd: <span className="text-[var(--text-primary)] font-medium">{quantity}</span></p>
        ) : null}
        {unitPrice && unitPrice > 0 ? (
          <p className="text-lg font-bold text-[var(--text-primary)] mt-2">R$ {unitPrice.toFixed(2)}</p>
        ) : null}
        {logoDataUrl ? (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[var(--success)] text-xs">✓</span>
            <span className="text-[10px] text-[var(--success)] font-medium">Logo aplicada</span>
          </div>
        ) : (
          <p className="text-[10px] text-[var(--text-faint)] mt-1">Envie uma logo para personalizar</p>
        )}
        {!apiImage && !loading && !error ? (
          <p className="text-[10px] text-[var(--success)] mt-1">
            Logo Replacer Pro — composição 100% local
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ==========================================
// Perspective quad drawing
// Maps a source canvas/image to a distorted quadrilateral
// by splitting into two triangles with affine transforms
// ==========================================

function drawPerspectiveQuad(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement | HTMLImageElement,
  sx: number[], sy: number[],  // Source quad corners (4 points: TL, TR, BR, BL)
  dx: number[], dy: number[],  // Dest quad corners (4 points: TL, TR, BR, BL)
) {
  // Split quad into two triangles: TL-TR-BL and TR-BR-BL
  drawTriangle(ctx, source,
    sx[0], sy[0], sx[1], sy[1], sx[3], sy[3],
    dx[0], dy[0], dx[1], dy[1], dx[3], dy[3],
  );
  drawTriangle(ctx, source,
    sx[1], sy[1], sx[2], sy[2], sx[3], sy[3],
    dx[1], dy[1], dx[2], dy[2], dx[3], dy[3],
  );
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement | HTMLImageElement,
  sx0: number, sy0: number, sx1: number, sy1: number, sx2: number, sy2: number,
  dx0: number, dy0: number, dx1: number, dy1: number, dx2: number, dy2: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx1, dy1);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();

  // Compute affine transform from source triangle to dest triangle
  // Source: (sx0,sy0), (sx1,sy1), (sx2,sy2)
  // Dest:   (dx0,dy0), (dx1,dy1), (dx2,dy2)
  const denom = (sx0 - sx2) * (sy1 - sy2) - (sx1 - sx2) * (sy0 - sy2);
  if (Math.abs(denom) < 0.001) { ctx.restore(); return; }

  const m11 = ((dx0 - dx2) * (sy1 - sy2) - (dx1 - dx2) * (sy0 - sy2)) / denom;
  const m12 = ((dx1 - dx2) * (sx0 - sx2) - (dx0 - dx2) * (sx1 - sx2)) / denom;
  const m21 = ((dy0 - dy2) * (sy1 - sy2) - (dy1 - dy2) * (sy0 - sy2)) / denom;
  const m22 = ((dy1 - dy2) * (sx0 - sx2) - (dy0 - dy2) * (sx1 - sx2)) / denom;
  const tx = dx2 - m11 * sx2 - m12 * sy2;
  const ty = dy2 - m21 * sx2 - m22 * sy2;

  ctx.setTransform(m11, m21, m12, m22, tx, ty);
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

// ==========================================
// Fallback: Canvas-drawn bag illustration
// ==========================================

function drawFallbackBag(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  logoImage: HTMLImageElement | null,
) {
  const bagW = w * 0.5;
  const bagH = bagW * 1.4;
  const bagX = (w - bagW) / 2;
  const bagY = h * 0.2;

  // Ground shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(w / 2, bagY + bagH + 10, bagW * 0.4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Bag body gradient
  const gradient = ctx.createLinearGradient(bagX, bagY, bagX + bagW, bagY + bagH);
  gradient.addColorStop(0, lighten(color, 25));
  gradient.addColorStop(0.3, lighten(color, 10));
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(0.7, darken(color, 10));
  gradient.addColorStop(1, darken(color, 30));

  ctx.save();
  ctx.fillStyle = gradient;
  roundRect(ctx, bagX, bagY, bagW, bagH, 6);
  ctx.fill();

  // Fabric texture
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < bagH; i += 3) {
    ctx.beginPath();
    ctx.moveTo(bagX, bagY + i);
    ctx.lineTo(bagX + bagW, bagY + i);
    ctx.strokeStyle = i % 6 < 3 ? '#000' : '#fff';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Side shine
  const shine = ctx.createLinearGradient(bagX, bagY, bagX + bagW * 0.4, bagY);
  shine.addColorStop(0, 'rgba(255,255,255,0.12)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fill();

  // Top fold
  ctx.fillStyle = darken(color, 15);
  ctx.globalAlpha = 0.4;
  ctx.fillRect(bagX, bagY, bagW, 12);
  ctx.globalAlpha = 1;

  // Stitching
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bagX + 8, bagY + 12);
  ctx.lineTo(bagX + bagW - 8, bagY + 12);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Handles
  drawHandle(ctx, bagX + bagW * 0.28, bagY, color);
  drawHandle(ctx, bagX + bagW * 0.72, bagY, color);

  // Logo or placeholder
  if (logoImage) {
    const area = getPrintArea(bagW, bagH, 'sacola');
    const maxLogoW = area.width * 0.75;
    const maxLogoH = area.height * 0.75;
    const ratio = logoImage.width / logoImage.height;
    let lw: number, lh: number;
    if (ratio > maxLogoW / maxLogoH) { lw = maxLogoW; lh = lw / ratio; }
    else { lh = maxLogoH; lw = lh * ratio; }

    const lx = bagX + area.x + (area.width - lw) / 2;
    const ly = bagY + area.y + area.height * 0.40 - lh / 2;

    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(logoImage, lx, ly, lw, lh);
    ctx.restore();

    // Logo with blend
    const blend = getBlendMode(color);
    ctx.save();
    ctx.globalCompositeOperation = blend;
    ctx.globalAlpha = 0.94;
    ctx.drawImage(logoImage, lx, ly, lw, lh);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `bold ${bagW * 0.09}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 3;
    ctx.fillText('Logo Aqui', bagX + bagW / 2, bagY + bagH * 0.45);
    ctx.restore();
  }
}

function drawHandle(ctx: CanvasRenderingContext2D, cx: number, top: number, color: string) {
  const hw = 4;
  const hh = 45;
  ctx.save();
  const grad = ctx.createLinearGradient(cx - hw, top, cx + hw, top);
  grad.addColorStop(0, darken(color, 35));
  grad.addColorStop(0.3, darken(color, 15));
  grad.addColorStop(0.5, darken(color, 5));
  grad.addColorStop(0.7, darken(color, 15));
  grad.addColorStop(1, darken(color, 35));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - hw, top);
  ctx.quadraticCurveTo(cx - hw - 2, top - hh, cx - hw, top - hh);
  ctx.lineTo(cx + hw, top - hh);
  ctx.quadraticCurveTo(cx + hw + 2, top - hh, cx + hw, top);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = -1;
  ctx.fill();
  ctx.restore();
}

// ==========================================
// Utilities
// ==========================================

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function lighten(hex: string, pct: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return rgbToHex(
    c.r + (255 - c.r) * pct / 100,
    c.g + (255 - c.g) * pct / 100,
    c.b + (255 - c.b) * pct / 100,
  );
}

function darken(hex: string, pct: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return rgbToHex(c.r * (1 - pct / 100), c.g * (1 - pct / 100), c.b * (1 - pct / 100));
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.min(255, Math.max(0, Math.round(c))).toString(16).padStart(2, '0')).join('');
}
