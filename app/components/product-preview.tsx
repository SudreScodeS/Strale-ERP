// app/components/product-preview.tsx
// Prévia do produto com IA generativa + Canvas para composição em tempo real
// SEMPRE gera imagem via IA — foto do estoque é opcional (botão de alternância)

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAuthHeaders } from '../lib/authClient';

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
  const generationKey = `${productColor}-${productStyle}`;
  const hasStockImage = Boolean(productImageUrl);

  // ==========================================
  // 1. SEMPRE gerar imagem via IA
  // ==========================================
  useEffect(() => {
    // Se está mostrando estoque, não gera
    if (showStock) return;

    // Verifica cache global
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
  // 3. Renderizar Canvas
  // ==========================================
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Fundo
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, w, h);

    if (baseImage) {
      // Imagem gerada pela IA
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

      ctx.drawImage(baseImage, drawX, drawY, drawW, drawH);

      // Logo
      if (logoImage) {
        const maxLogoW = drawW * 0.45;
        const maxLogoH = drawH * 0.3;
        const ratio = logoImage.width / logoImage.height;
        let lw: number, lh: number;
        if (ratio > maxLogoW / maxLogoH) { lw = maxLogoW; lh = lw / ratio; }
        else { lh = maxLogoH; lw = lh * ratio; }

        const lx = drawX + (drawW - lw) / 2;
        const ly = drawY + drawH * 0.35;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
        ctx.drawImage(logoImage, lx, ly, lw, lh);
        ctx.restore();
      }
    } else if (!loading) {
      // Fallback: desenha sacola no Canvas
      drawFallbackBag(ctx, w, h, productColor, logoImage);
    }

    if (onPreviewGenerated) {
      try { onPreviewGenerated(canvas.toDataURL('image/png')); } catch { /* */ }
    }
  }, [baseImage, logoImage, productColor, loading, onPreviewGenerated]);

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
// FALLBACK: Sacola Canvas
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
    const maxW = bagW * 0.6, maxH = bagH * 0.3;
    const r = logoImage.width / logoImage.height;
    let lw: number, lh: number;
    if (r > maxW / maxH) { lw = maxW; lh = lw / r; } else { lh = maxH; lw = lh * r; }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.drawImage(logoImage, bagX + (bagW - lw) / 2, bagY + bagH * 0.38, lw, lh);
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
