// app/components/product-preview.tsx
// Prévia do produto com geração de imagem por IA
// Usa foto real do inventário como referência quando disponível (img2img)
// Aplica logo via compositor profissional

'use client';

import { useEffect, useRef, useState } from 'react';
import { getAuthHeaders } from '../lib/authClient';
import {
  autoCompositeLogo,
  compositeLogo,
  getPrintArea,
  getProductCompositorOptions,
  type CompositorOptions,
} from '../lib/logo-compositor';

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
  const [imageSource, setImageSource] = useState<'ai' | 'img2img' | 'fallback' | 'ai-with-logo' | 'composited'>('ai');
  const [logoIntegrated, setLogoIntegrated] = useState(false);
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
  const logoShortHash = logoDataUrl ? logoDataUrl.substring(logoDataUrl.length - 20) : 'nologo';
  const generationKey = `${productColor}-${productStyle}-${productImageUrl || 'noimg'}-${logoShortHash}`;
  const hasStockImage = Boolean(productImageUrl);

  // ==========================================
  // 1. Gerar imagem via IA (com foto real como referência quando disponível)
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
        const body: Record<string, string> = {
          color: productColor,
          style: productStyle,
        };
        if (productImageUrl) {
          body.imageUrl = productImageUrl;
        }
        if (logoDataUrl) {
          body.logoDataUrl = logoDataUrl;
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
          if (data.retry) {
            setTimeout(() => { if (!cancelled) void generateImage(); }, 3000);
            return;
          }
          throw new Error(data.error || 'Erro ao gerar imagem');
        }

        const src = response.headers.get('X-Image-Source');
        if (!cancelled) {
          if (src === 'ai-with-logo') {
            setImageSource('ai-with-logo');
            setLogoIntegrated(true);
          } else if (src === 'composited') {
            setImageSource('composited');
            setLogoIntegrated(true);
          } else {
            setImageSource(src === 'img2img' ? 'img2img' : 'ai');
            setLogoIntegrated(false);
          }
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
  }, [generationKey, showStock, productColor, productStyle, productImageUrl]);

  // ==========================================
  // 2. Carregar logo (garante re-render quando carregar)
  // ==========================================
  useEffect(() => {
    if (!logoDataUrl) {
      setLogoImage(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLogoImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setLogoImage(null);
    };
    img.src = logoDataUrl;
    return () => { cancelled = true; };
  }, [logoDataUrl]);

  // ==========================================
  // 3. Renderizar Canvas com composição
  //
  // ⚠️ CORREÇÃO CRÍTICA: NÃO incluir `loading` nas dependências!
  // `loading` muda para false ANTES do logoImage carregar,
  // causando renderização sem logo (stale closure).
  //
  // Dependências corretas: apenas os dados visuais que afetam o canvas.
  // O guard `if (!baseImage) return` previne renderização prematura.
  // ==========================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Transparent background — herda o fundo do container (dark mode safe)
    // NÃO preencher com cor sólida para evitar bordas brancas/acinzentadas

    if (baseImage) {
      // Calculate product draw area — fill canvas as much as possible
      const imgRatio = baseImage.width / baseImage.height;
      const canvasRatio = w / h;
      let drawW: number, drawH: number, drawX: number, drawY: number;

      // Preencher o canvas o máximo possível (sem margens brancas)
      if (imgRatio > canvasRatio) {
        // Imagem mais larga que canvas → ajustar pela largura
        drawW = w;
        drawH = w / imgRatio;
        drawX = 0;
        drawY = (h - drawH) / 2;
      } else {
        // Imagem mais alta que canvas → ajustar pela altura
        drawH = h;
        drawW = h * imgRatio;
        drawX = (w - drawW) / 2;
        drawY = 0;
      }

      if (logoImage && !logoIntegrated) {
        // === COMPOSIÇÃO CLIENT-SIDE: produto + logo ===
        // Usado APENAS quando a API NÃO integrou a logo (fallback)

        // 1. Desenha produto num canvas temporário (no tamanho de draw)
        const productCanvas = document.createElement('canvas');
        productCanvas.width = Math.ceil(drawW);
        productCanvas.height = Math.ceil(drawH);
        const pCtx = productCanvas.getContext('2d')!;
        pCtx.drawImage(baseImage, 0, 0, drawW, drawH);

        // 2. Obtém opções otimizadas para o tipo de produto
        const compositorOpts = getProductCompositorOptions(productType, productColor);

        // 3. Composita logo sobre o produto com efeitos realistas
        const composited = autoCompositeLogo(
          productCanvas,
          logoImage,
          productType,
          compositorOpts,
        );

        // 4. Desenha resultado no canvas principal
        ctx.drawImage(composited, drawX, drawY, drawW, drawH);
      } else {
        // Sem logo — desenha produto direto
        ctx.drawImage(baseImage, drawX, drawY, drawW, drawH);
      }
    } else if (!loading) {
      // Fallback: desenha sacola no Canvas quando não tem imagem de IA
      drawFallbackBag(ctx, w, h, productColor, logoImage, productType);
    }

    if (onPreviewGenerated) {
      try { onPreviewGenerated(canvas.toDataURL('image/png')); } catch { /* */ }
    }
  }, [baseImage, logoImage, logoIntegrated, productColor, productType, loading, onPreviewGenerated]);

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

  const sourceLabel = imageSource === 'ai-with-logo' ? '🖨️ Logo integrada pela IA'
    : imageSource === 'composited' ? '🎨 Logo aplicada'
    : imageSource === 'img2img' ? '🎨 Baseado na foto'
    : '✨ Gerado por IA';

  // Modo compacto
  if (compact) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
        <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'transparent' }}>
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
      <div className="relative w-full overflow-hidden" style={{ backgroundColor: 'transparent', aspectRatio: '4/5' }}>
        {showStock && hasStockImage ? (
          <img src={productImageUrl} alt={productName} className="w-full h-full object-cover" />
        ) : (
          <>
            <canvas ref={canvasRef} width={768} height={960} className="w-full h-full object-contain" />

            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs text-slate-700 font-medium">
                    {productImageUrl ? 'Gerando baseado na foto do produto…' : 'Gerando imagem com IA…'}
                  </span>
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
                <span className="text-[9px] bg-blue-100/90 text-blue-700 rounded-full px-2 py-0.5 font-medium">{sourceLabel}</span>
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
// FALLBACK: Sacola Canvas (quando não tem imagem de IA)
// ==========================================

function drawFallbackBag(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  logoImage: HTMLImageElement | null,
  productType: string,
) {
  const bagW = w * 0.5, bagH = bagW * 1.4;
  const bagX = (w - bagW) / 2, bagY = h * 0.2;

  // Shadow
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

  // Fabric texture lines
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

  // Shine
  const shine = ctx.createLinearGradient(bagX, bagY, bagX + bagW * 0.4, bagY);
  shine.addColorStop(0, 'rgba(255,255,255,0.12)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fill();

  // Top fold line
  ctx.fillStyle = darken(color, 15);
  ctx.globalAlpha = 0.4;
  ctx.fillRect(bagX, bagY, bagW, 12);
  ctx.globalAlpha = 1;

  // Dashed line
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

  // Logo compositing via professional compositor
  if (logoImage) {
    // Create a temporary canvas with the bag drawing
    const bagCanvas = document.createElement('canvas');
    bagCanvas.width = w;
    bagCanvas.height = h;
    const bagCtx = bagCanvas.getContext('2d')!;
    bagCtx.drawImage(ctx.canvas, 0, 0);

    // Define print area on the bag (centered, prominent)
    const printArea = {
      x: bagX + bagW * 0.1,
      y: bagY + bagH * 0.2,
      width: bagW * 0.8,
      height: bagH * 0.5,
    };

    // Use professional compositor
    const composited = compositeLogo(bagCanvas, logoImage, printArea, {
      blendMode: 'multiply',
      opacity: 0.97,
      featherRadius: 2,
      fabricTexture: true,
      textureIntensity: 0.03,
      shadowBlur: 3,
      shadowOpacity: 0.08,
      bgThreshold: 200,
      matchLighting: false, // Disabled — canvas bag has its own gradients that bleed into logo
      lightingIntensity: 0,
    });
    ctx.drawImage(composited, 0, 0);
  } else {
    // Placeholder text
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
