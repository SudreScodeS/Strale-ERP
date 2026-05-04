// app/components/product-preview.tsx
// Componente de prévia visual do produto
// Gera um TEMPLATE da sacola/produto em SVG quando não há imagem cadastrada
// Aplica cor do produto + posiciona logo do cliente

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface PreviewConfig {
  productImageUrl: string;
  productName: string;
  logoDataUrl: string | null;
  selectedColorHex?: string;
  selectedColorName?: string;
  selectedMaterialName?: string;
  quantity?: number;
  unitPrice?: number;
  width?: number;
  height?: number;
}

interface ProductPreviewProps {
  config: PreviewConfig;
  onPreviewGenerated?: (dataUrl: string) => void;
  className?: string;
  compact?: boolean;
}

// ============================================================
// TEMPLATE SVG DA SACOLA (gerado programaticamente)
// ============================================================

/**
 * Gera um SVG de sacola/tote bag com a cor especificada.
 * Retorna um data URL do SVG para usar como imagem base.
 */
function generateBagSvg(colorHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
    <defs>
      <linearGradient id="bagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${lightenColor(colorHex, 15)};stop-opacity:1" />
        <stop offset="50%" style="stop-color:${colorHex};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${darkenColor(colorHex, 20)};stop-opacity:1" />
      </linearGradient>
      <linearGradient id="handleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${darkenColor(colorHex, 10)};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${darkenColor(colorHex, 30)};stop-opacity:1" />
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="2" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.15)"/>
      </filter>
      <filter id="innerShadow">
        <feComponentTransfer in="SourceAlpha">
          <feFuncA type="table" tableValues="1 0"/>
        </feComponentTransfer>
        <feGaussianBlur stdDeviation="3"/>
        <feOffset dx="2" dy="3" result="offsetblur"/>
        <feFlood flood-color="rgba(0,0,0,0.2)" result="color"/>
        <feComposite in2="offsetblur" operator="in"/>
        <feComposite in2="SourceAlpha" operator="in"/>
        <feMerge>
          <feMergeNode in="SourceGraphic"/>
          <feMergeNode/>
        </feMerge>
      </filter>
    </defs>

    <!-- Sombra da sacola -->
    <ellipse cx="200" cy="470" rx="120" ry="15" fill="rgba(0,0,0,0.08)"/>

    <!-- Corpo da sacola -->
    <g filter="url(#shadow)">
      <path d="M80,120 L80,430 Q80,450 100,450 L300,450 Q320,450 320,430 L320,120 Z" fill="url(#bagGrad)" stroke="${darkenColor(colorHex, 25)}" stroke-width="1.5"/>

      <!-- Dobra superior -->
      <path d="M80,120 L80,150 Q80,145 85,140 L315,140 Q320,145 320,150 L320,120 Q320,110 310,110 L90,110 Q80,110 80,120 Z" fill="${darkenColor(colorHex, 8)}" opacity="0.3"/>

      <!-- Fundo da sacola (sombra interna) -->
      <rect x="80" y="420" width="240" height="30" rx="0" ry="10" fill="${darkenColor(colorHex, 15)}" opacity="0.2"/>
    </g>

    <!-- Alças -->
    <g filter="url(#innerShadow)">
      <!-- Alça esquerda -->
      <path d="M140,110 Q140,40 170,40 Q200,40 200,70" fill="none" stroke="url(#handleGrad)" stroke-width="10" stroke-linecap="round"/>
      <!-- Alça direita -->
      <path d="M200,70 Q200,40 230,40 Q260,40 260,110" fill="none" stroke="url(#handleGrad)" stroke-width="10" stroke-linecap="round"/>
    </g>

    <!-- Brilho sutil na sacola -->
    <path d="M100,130 L100,400 Q100,410 110,410 L160,410 L160,130 Z" fill="white" opacity="0.06"/>

    <!-- Textura sutil -->
    <pattern id="fabric" patternUnits="userSpaceOnUse" width="4" height="4">
      <path d="M0,0 L4,4 M4,0 L0,4" stroke="${darkenColor(colorHex, 5)}" stroke-width="0.3" opacity="0.15"/>
    </pattern>
    <path d="M82,122 L82,428 Q82,448 102,448 L298,448 Q318,448 318,428 L318,122 Z" fill="url(#fabric)"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * Clareia uma cor hex em X%.
 */
function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.min(255, rgb.r + Math.round((255 - rgb.r) * percent / 100));
  const g = Math.min(255, rgb.g + Math.round((255 - rgb.g) * percent / 100));
  const b = Math.min(255, rgb.b + Math.round((255 - rgb.b) * percent / 100));
  return rgbToHex(r, g, b);
}

/**
 * Escurece uma cor hex em X%.
 */
function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.round(rgb.r * (1 - percent / 100)));
  const g = Math.max(0, Math.round(rgb.g * (1 - percent / 100)));
  const b = Math.max(0, Math.round(rgb.b * (1 - percent / 100)));
  return rgbToHex(r, g, b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// COMPOSIÇÃO DA PRÉVIA
// ============================================================

/**
 * Gera a prévia visual completa.
 * Se tem imagem do produto → usa ela como base
 * Se NÃO tem → gera template SVG da sacola com a cor selecionada
 */
export async function generateProductPreview(config: PreviewConfig): Promise<string> {
  const {
    productImageUrl,
    logoDataUrl,
    selectedColorHex,
    width = 500,
    height = 500,
  } = config;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Fundo
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Determina a imagem base do produto
  let baseImageUrl = productImageUrl;

  if (!baseImageUrl) {
    // Sem imagem cadastrada → gera template SVG da sacola
    const bagColor = selectedColorHex || '#6b7280'; // cinza padrão se não selecionou cor
    baseImageUrl = generateBagSvg(bagColor);
  }

  try {
    const productImg = await loadImage(baseImageUrl);

    // Calcula dimensões (85% do canvas, centralizado)
    const imgRatio = productImg.naturalWidth / productImg.naturalHeight;
    let imgW = width * 0.85;
    let imgH = imgW / imgRatio;
    if (imgH > height * 0.85) {
      imgH = height * 0.85;
      imgW = imgH * imgRatio;
    }
    const imgX = (width - imgW) / 2;
    const imgY = (height - imgH) / 2;

    // Desenha o produto
    ctx.drawImage(productImg, imgX, imgY, imgW, imgH);

    // Se tem imagem real do produto E selecionou cor, aplica blend
    if (productImageUrl && selectedColorHex) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgX, imgY, imgW, imgH);
      ctx.clip();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = selectedColorHex;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Posiciona logo do cliente sobre o produto
    if (logoDataUrl) {
      try {
        const logoImg = await loadImage(logoDataUrl);
        drawLogoOnProduct(ctx, logoImg, imgX, imgY, imgW, imgH);
      } catch {
        // Logo falhou, continua
      }
    }

  } catch {
    // Falha total: placeholder
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(width * 0.1, height * 0.15, width * 0.8, height * 0.7);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Produto', width / 2, height / 2);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Posiciona a logo sobre a área do produto.
 */
function drawLogoOnProduct(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement,
  productX: number,
  productY: number,
  productW: number,
  productH: number,
) {
  // Logo: máximo 30% da largura do produto, centralizada
  const maxLogoW = productW * 0.3;
  const maxLogoH = productH * 0.25;

  const logoRatio = logoImg.naturalWidth / logoImg.naturalHeight;
  let drawW = maxLogoW;
  let drawH = drawW / logoRatio;

  if (drawH > maxLogoH) {
    drawH = maxLogoH;
    drawW = drawH * logoRatio;
  }

  const x = productX + (productW - drawW) / 2;
  const y = productY + (productH - drawH) / 2 - productH * 0.05;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  ctx.drawImage(logoImg, x, y, drawW, drawH);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = src;
  });
}

// ============================================================
// COMPONENTE REACT
// ============================================================

export default function ProductPreview({
  config,
  onPreviewGenerated,
  className = '',
  compact = false,
}: ProductPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string>('');

  const renderPreview = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsRendering(true);
    setError('');

    const w = compact ? 180 : 320;
    const h = compact ? 180 : 320;
    canvas.width = w;
    canvas.height = h;

    try {
      const url = await generateProductPreview({ ...config, width: w, height: h });
      setPreviewUrl(url);
      onPreviewGenerated?.(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao renderizar');
    } finally {
      setIsRendering(false);
    }
  }, [config, compact, onPreviewGenerated]);

  useEffect(() => {
    void renderPreview();
  }, [renderPreview]);

  // Modo compacto: só a imagem
  if (compact) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {previewUrl ? <img src={previewUrl} alt={config.productName} className="w-full h-auto" /> : null}
        {isRendering ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <svg className="h-5 w-5 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : null}
        {error ? <p className="absolute bottom-1 left-1 text-[9px] text-red-500 bg-white/80 px-1 rounded">{error}</p> : null}
      </div>
    );
  }

  // Modo completo: card de catálogo
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      {/* Imagem do produto */}
      <div className="relative bg-slate-50 p-3">
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {previewUrl ? (
          <img src={previewUrl} alt={config.productName} className="w-full h-auto rounded-xl" />
        ) : null}
        {isRendering ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <svg className="h-6 w-6 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50/90">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : null}
      </div>

      {/* Detalhes do produto */}
      <div className="p-4 border-t border-slate-100">
        <h4 className="font-semibold text-slate-900 text-sm">{config.productName}</h4>

        {config.selectedMaterialName ? (
          <p className="mt-1 text-xs text-slate-500">
            Material: <span className="text-slate-700 font-medium">{config.selectedMaterialName}</span>
          </p>
        ) : null}

        {config.selectedColorName ? (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            Cor: <span className="text-slate-700 font-medium">{config.selectedColorName}</span>
            {config.selectedColorHex ? (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300 shadow-sm"
                style={{ backgroundColor: config.selectedColorHex }}
              />
            ) : null}
          </div>
        ) : null}

        {config.quantity && config.quantity > 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            Qtd: <span className="text-slate-700 font-medium">{config.quantity}</span>
          </p>
        ) : null}

        {config.unitPrice && config.unitPrice > 0 ? (
          <p className="mt-2 text-base font-bold text-slate-900">
            R$ {config.unitPrice.toFixed(2)}
          </p>
        ) : null}

        {config.logoDataUrl ? (
          <p className="mt-2 text-[10px] text-emerald-600 font-medium">✓ Logo aplicada na prévia</p>
        ) : (
          <p className="mt-2 text-[10px] text-slate-400">Envie uma logo para personalizar</p>
        )}

        {!config.productImageUrl ? (
          <p className="mt-1 text-[10px] text-amber-500">📐 Template gerado — cadastre imagem no estoque para usar foto real</p>
        ) : null}
      </div>
    </div>
  );
}
