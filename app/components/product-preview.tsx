// app/components/product-preview.tsx
// Prévia do produto com geração de imagem por IA
// Usa foto real do inventário como referência quando disponível (img2img)
// Aplica logo via compositor profissional

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAuthHeaders } from '../lib/authClient';
import {
  autoCompositeLogo,
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
  const [imageSource, setImageSource] = useState<'ai' | 'img2img' | 'fallback'>('ai');
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
  const generationKey = `${productColor}-${productStyle}-${productImageUrl || 'noimg'}`;
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
          setImageSource(src === 'img2img' ? 'img2img' : 'ai');
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

    // Background
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, w, h);

    // Guard: don't render until base image is ready
    if (!baseImage) return;

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
      // === COMPOSIÇÃO PROFISSIONAL: produto + logo ===

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

    if (onPreviewGenerated) {
      try { onPreviewGenerated(canvas.toDataURL('image/png')); } catch { /* */ }
    }
  }, [baseImage, logoImage, productColor, productType, onPreviewGenerated]);

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

  const sourceLabel = imageSource === 'img2img' ? '🎨 Baseado na foto' : '✨ Gerado por IA';

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
