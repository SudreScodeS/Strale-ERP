// app/components/product-preview.tsx
// Prévia do produto com composição profissional de logo
// Usa logo-compositor para: remoção de fundo, blend modes, textura de tecido, sombras

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAuthHeaders } from '../lib/authClient';
import { autoCompositeLogo, getPrintArea, type CompositorOptions } from '../lib/logo-compositor';

export interface PreviewConfig {
  productImageUrl: string;
  productName: string;
  logoDataUrl: string | null;
  selectedColorHex?: string;
  selectedColorName?: string;
  selectedMaterialName?: string;
  quantity?: number;
  unitPrice?: number;
}

interface ProductPreviewProps {
  config: PreviewConfig;
  onPreviewGenerated?: (dataUrl: string) => void;
  className?: string;
  compact?: boolean;
}

const DEFAULT_PRODUCT_COLORS: Record<string, string> = {
  sacola: '#2563eb',
  camiseta: '#f8fafc',
  caneca: '#f8fafc',
  default: '#2563eb',
};

function getDefaultColor(productName: string): string {
  const lower = productName.toLowerCase();
  for (const [key, color] of Object.entries(DEFAULT_PRODUCT_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return DEFAULT_PRODUCT_COLORS.default;
}

function getProductStyle(productName: string): string {
  const lower = productName.toLowerCase();
  if (lower.includes('camiseta') || lower.includes('camisa')) return 'camiseta';
  if (lower.includes('caneca') || lower.includes('mug')) return 'caneca';
  return 'sacola';
}

function getProductType(productName: string): 'sacola' | 'camiseta' | 'caneca' | 'default' {
  const lower = productName.toLowerCase();
  if (lower.includes('camiseta') || lower.includes('camisa')) return 'camiseta';
  if (lower.includes('caneca') || lower.includes('mug')) return 'caneca';
  if (lower.includes('sacola') || lower.includes('bag') || lower.includes('tote')) return 'sacola';
  return 'default';
}

/** Get optimal blend mode based on product and logo brightness */
function getOptimalBlendMode(
  productColorHex: string,
): 'multiply' | 'overlay' | 'soft-light' {
  const rgb = hexToRgb(productColorHex);
  if (!rgb) return 'multiply';
  const brightness = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;

  // Light products → multiply (darkens logo into fabric)
  // Dark products → soft-light (preserves logo visibility)
  if (brightness > 180) return 'multiply';
  if (brightness > 100) return 'soft-light';
  return 'overlay';
}

/** Get compositor options tuned for product type */
function getCompositorOptions(
  productColorHex: string,
  productType: string,
): CompositorOptions {
  const blendMode = getOptimalBlendMode(productColorHex);
  const rgb = hexToRgb(productColorHex);
  const brightness = rgb ? rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 : 200;

  const base: CompositorOptions = {
    blendMode,
    opacity: 0.92,
    featherRadius: 1.5,
    fabricTexture: true,
    textureIntensity: 0.05,
    shadowBlur: 3,
    shadowOpacity: 0.12,
    bgThreshold: 235,
  };

  // Adjust per product type
  if (productType === 'camiseta') {
    base.textureIntensity = 0.08; // More fabric texture on t-shirts
    base.featherRadius = 2;
  } else if (productType === 'caneca') {
    base.fabricTexture = false; // No fabric on mugs
    base.textureIntensity = 0;
    base.shadowBlur = 5;
    base.shadowOpacity = 0.2;
    base.featherRadius = 1;
  }

  // Dark products need lighter shadow and different opacity
  if (brightness < 80) {
    base.shadowOpacity = 0.08;
    base.opacity = 0.88;
  }

  return base;
}

// Cache global de imagens geradas (sobrevive re-renders)
const globalImageCache = new Map<string, HTMLImageElement>();

export default function ProductPreview({
  config,
  onPreviewGenerated,
  className = '',
  compact = false,
}: ProductPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showStock, setShowStock] = useState(false);

  const {
    productImageUrl,
    productName,
    logoDataUrl,
    selectedColorHex,
    selectedColorName,
    selectedMaterialName,
    quantity,
    unitPrice,
  } = config;

  const productColor = selectedColorHex || getDefaultColor(productName);
  const productStyle = getProductStyle(productName);
  const productType = getProductType(productName);
  const generationKey = `${productColor}-${productStyle}`;
  const hasStockImage = Boolean(productImageUrl);

  // ==========================================
  // 1. SEMPRE gerar imagem via IA
  // ==========================================
  useEffect(() => {
    if (showStock) return;

    const cached = globalImageCache.get(generationKey);
    if (cached) {
      setBaseImage(cached);
      return;
    }

    let cancelled = false;

    async function generateImage() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/product-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ color: productColor, style: productStyle }),
        });

        if (cancelled) return;

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data.retry) {
            setTimeout(() => { if (!cancelled) void generateImage(); }, 3000);
            return;
          }
          throw new Error(data.error || 'Erro ao gerar imagem');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          if (cancelled) { URL.revokeObjectURL(url); return; }
          globalImageCache.set(generationKey, img);
          setBaseImage(img);
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
  }, [generationKey, showStock, productColor, productStyle]);

  // ==========================================
  // 2. Carregar logo
  // ==========================================
  useEffect(() => {
    if (!logoDataUrl) { setLogoImage(null); return; }
    const img = new Image();
    img.onload = () => setLogoImage(img);
    img.onerror = () => setLogoImage(null);
    img.src = logoDataUrl;
  }, [logoDataUrl]);

  // ==========================================
  // 3. Renderizar Canvas com composição profissional
  // ==========================================
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, w, h);

    if (baseImage) {
      // Calculate product draw area (centered, 90% of canvas)
      const imgRatio = baseImage.width / baseImage.height;
      const canvasRatio = w / h;
      let drawW: number, drawH: number, drawX: number, drawY: number;

      if (imgRatio > canvasRatio) {
        drawW = w * 0.9;
        drawH = drawW / imgRatio;
        drawX = (w - drawW) / 2;
        drawY = (h - drawH) / 2;
      } else {
        drawH = h * 0.9;
        drawW = drawH * imgRatio;
        drawX = (w - drawW) / 2;
        drawY = (h - drawH) / 2;
      }

      if (logoImage) {
        // === PROFESSIONAL COMPOSITING ===
        // 1. Draw product to a temp canvas at the draw size
        const productCanvas = document.createElement('canvas');
        productCanvas.width = Math.ceil(drawW);
        productCanvas.height = Math.ceil(drawH);
        const pCtx = productCanvas.getContext('2d')!;
        pCtx.drawImage(baseImage, 0, 0, drawW, drawH);

        // 2. Scale print area to match the draw dimensions
        const fullPrintArea = getPrintArea(baseImage.width, baseImage.height, productType);
        const scaleX = drawW / baseImage.width;
        const scaleY = drawH / baseImage.height;
        const scaledPrintArea = {
          x: Math.round(fullPrintArea.x * scaleX),
          y: Math.round(fullPrintArea.y * scaleY),
          width: Math.round(fullPrintArea.width * scaleX),
          height: Math.round(fullPrintArea.height * scaleY),
        };

        // 3. Composite logo onto product
        const compositorOpts = getCompositorOptions(productColor, productType);
        const composited = autoCompositeLogo(
          productCanvas,
          logoImage,
          productType,
          compositorOpts,
        );

        // 4. Draw composited result to main canvas
        ctx.drawImage(composited, drawX, drawY, drawW, drawH);

        // 5. Draw print area guide (very subtle, for dev)
        if (false) { // Set to true for debugging
          ctx.save();
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(
            drawX + scaledPrintArea.x,
            drawY + scaledPrintArea.y,
            scaledPrintArea.width,
            scaledPrintArea.height,
          );
          ctx.setLineDash([]);
          ctx.restore();
        }
      } else {
        // No logo — just draw the product
        ctx.drawImage(baseImage, drawX, drawY, drawW, drawH);
      }
    } else if (!loading) {
      // Fallback: desenha sacola no Canvas
      drawFallbackBag(ctx, w, h, productColor, logoImage);
    }

    if (onPreviewGenerated) {
      try { onPreviewGenerated(canvas.toDataURL('image/png')); } catch { /* */ }
    }
  }, [baseImage, logoImage, productColor, productType, loading, onPreviewGenerated]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // ==========================================
  // Renderização
  // ==========================================

  const toggleButton = hasStockImage ? (
    <button
      type="button"
      onClick={() => setShowStock(!showStock)}
      className="absolute bottom-2 right-2 z-10 text-[9px] bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm border border-slate-200 hover:bg-white transition"
    >
      {showStock ? '✨ Ver IA' : '📦 Ver estoque'}
    </button>
  ) : null;

  // Modo compacto
  if (compact) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
        <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#e2e8f0' }}>
          {showStock && hasStockImage ? (
            <img src={productImageUrl} alt={productName} className="w-full h-full object-cover" />
          ) : (
            <canvas ref={canvasRef} width={200} height={200} className="w-full h-full object-contain" />
          )}
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
              <svg className="h-5 w-5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Modo completo
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm ${className}`}>
      <div className="relative w-full overflow-hidden" style={{ backgroundColor: '#e2e8f0', aspectRatio: '4/5' }}>
        {showStock && hasStockImage ? (
          <img src={productImageUrl} alt={productName} className="w-full h-full object-cover" />
        ) : (
          <>
            <canvas ref={canvasRef} width={512} height={640} className="w-full h-full object-contain" />

            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs text-slate-700 font-medium">Gerando imagem com IA…</span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-[10px] text-amber-700 bg-amber-50/90 rounded-lg px-2 py-1 text-center">{error}</p>
              </div>
            ) : null}

            {baseImage && !loading ? (
              <div className="absolute top-2 left-2">
                <span className="text-[9px] bg-blue-100/90 text-blue-700 rounded-full px-2 py-0.5 font-medium">✨ Gerado por IA</span>
              </div>
            ) : null}
          </>
        )}

        {toggleButton}

        {selectedColorHex ? (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
            <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: selectedColorHex }} />
            <span className="text-[10px] font-medium text-slate-700">{selectedColorName || 'Cor'}</span>
          </div>
        ) : null}
      </div>

      {/* Detalhes */}
      <div className="p-4 space-y-1.5">
        <h4 className="font-semibold text-slate-900 text-sm leading-tight">{productName}</h4>
        {selectedMaterialName ? <p className="text-xs text-slate-500">Material: <span className="text-slate-800 font-medium">{selectedMaterialName}</span></p> : null}
        {selectedColorName ? <p className="text-xs text-slate-500">Cor: <span className="text-slate-800 font-medium">{selectedColorName}</span></p> : null}
        {quantity && quantity > 0 ? <p className="text-xs text-slate-500">Qtd: <span className="text-slate-800 font-medium">{quantity}</span></p> : null}
        {unitPrice && unitPrice > 0 ? <p className="text-lg font-bold text-slate-900 mt-2">R$ {unitPrice.toFixed(2)}</p> : null}
        {logoDataUrl ? (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-emerald-500 text-xs">✓</span>
            <span className="text-[10px] text-emerald-600 font-medium">Logo aplicada</span>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 mt-1">Envie uma logo para personalizar</p>
        )}
      </div>
    </div>
  );
}

// ==========================================
// FALLBACK: Sacola Canvas (unchanged logic, improved logo rendering)
// ==========================================

function drawFallbackBag(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, logoImage: HTMLImageElement | null) {
  const bagW = w * 0.5, bagH = bagW * 1.4;
  const bagX = (w - bagW) / 2, bagY = h * 0.2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(w / 2, bagY + bagH + 10, bagW * 0.4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

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

  const shine = ctx.createLinearGradient(bagX, bagY, bagX + bagW * 0.4, bagY);
  shine.addColorStop(0, 'rgba(255,255,255,0.12)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fill();

  ctx.fillStyle = darken(color, 15);
  ctx.globalAlpha = 0.4;
  ctx.fillRect(bagX, bagY, bagW, 12);
  ctx.globalAlpha = 1;

  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bagX + 8, bagY + 12);
  ctx.lineTo(bagX + bagW - 8, bagY + 12);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  drawHandle(ctx, bagX + bagW * 0.28, bagY, color);
  drawHandle(ctx, bagX + bagW * 0.72, bagY, color);

  if (logoImage) {
    // Use compositor for fallback too
    const printArea = {
      x: bagX + bagW * 0.15,
      y: bagY + bagH * 0.25,
      width: bagW * 0.7,
      height: bagH * 0.45,
    };
    const bagCanvas = document.createElement('canvas');
    bagCanvas.width = w;
    bagCanvas.height = h;
    const bagCtx = bagCanvas.getContext('2d')!;
    bagCtx.drawImage(ctx.canvas, 0, 0);

    const composited = compositeLogoFallback(bagCanvas, logoImage, printArea, color);
    ctx.drawImage(composited, 0, 0);
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

function compositeLogoFallback(
  productCanvas: HTMLCanvasElement,
  logoImage: HTMLImageElement,
  printArea: { x: number; y: number; width: number; height: number },
  productColor: string,
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = productCanvas.width;
  out.height = productCanvas.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(productCanvas, 0, 0);

  // Process logo: remove white background
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = logoImage.width;
  logoCanvas.height = logoImage.height;
  const lCtx = logoCanvas.getContext('2d')!;
  lCtx.drawImage(logoImage, 0, 0);
  const imageData = lCtx.getImageData(0, 0, logoImage.width, logoImage.height);
  const data = imageData.data;

  // Detect bg from corners
  const cornerIdx = 0;
  const bgR = data[cornerIdx], bgG = data[cornerIdx + 1], bgB = data[cornerIdx + 2];

  for (let i = 0; i < data.length; i += 4) {
    const dist = Math.sqrt(
      (data[i] - bgR) ** 2 + (data[i + 1] - bgG) ** 2 + (data[i + 2] - bgB) ** 2,
    );
    if (dist < 60) {
      data[i + 3] = 0;
    } else if (dist < 120) {
      data[i + 3] = Math.round(((dist - 60) / 60) * 255);
    }
  }
  lCtx.putImageData(imageData, 0, 0);

  // Scale logo to fit print area
  const maxW = printArea.width * 0.65;
  const maxH = printArea.height * 0.65;
  const ratio = logoImage.width / logoImage.height;
  let lw: number, lh: number;
  if (ratio > maxW / maxH) { lw = maxW; lh = lw / ratio; } else { lh = maxH; lw = lh * ratio; }

  const lx = printArea.x + (printArea.width - lw) / 2;
  const ly = printArea.y + (printArea.height - lh) / 2;

  // Determine blend mode based on product color brightness
  const rgb = hexToRgb(productColor);
  const brightness = rgb ? rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 : 200;
  const blendMode: GlobalCompositeOperation = brightness > 150 ? 'multiply' : 'soft-light';

  // Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  ctx.globalAlpha = 0.12;
  ctx.drawImage(logoCanvas, lx + 1, ly + 2, lw, lh);
  ctx.restore();

  // Logo with blend mode
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.globalCompositeOperation = blendMode;
  ctx.drawImage(logoCanvas, lx, ly, lw, lh);
  ctx.restore();

  return out;
}

function drawHandle(ctx: CanvasRenderingContext2D, cx: number, top: number, color: string) {
  const hw = 4, hh = 45;
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
  ctx.restore();
}

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

function lighten(hex: string, pct: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return rgbToHex(c.r + (255 - c.r) * pct / 100, c.g + (255 - c.g) * pct / 100, c.b + (255 - c.b) * pct / 100);
}
function darken(hex: string, pct: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return rgbToHex(c.r * (1 - pct / 100), c.g * (1 - pct / 100), c.b * (1 - pct / 100));
}
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.min(255, Math.max(0, Math.round(c))).toString(16).padStart(2, '0')).join('');
}
