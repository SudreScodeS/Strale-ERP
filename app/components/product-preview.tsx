// app/components/product-preview.tsx
// Gera a imagem do produto 100% do zero no Canvas
// Sem SVG, sem imagens externas, sem template — tudo desenhado programaticamente

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
// UTILITÁRIOS DE COR
// ============================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.min(255, Math.max(0, Math.round(c))).toString(16).padStart(2, '0')).join('');
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

// ============================================================
// DESENHO DA SACOLA — 100% NO CANVAS
// ============================================================

/**
 * Desenha uma sacola/tote bag completa no canvas.
 * Tudo gerado programaticamente — sem imagens externas.
 */
function drawBagOnCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colorHex: string,
) {
  const cx = w / 2;
  const bagW = w * 0.6;
  const bagH = h * 0.65;
  const bagX = cx - bagW / 2;
  const bagY = h * 0.18;
  const cornerR = bagW * 0.04;

  // ---- Sombra no chão ----
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, bagY + bagH + 8, bagW * 0.45, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.fill();
  ctx.restore();

  // ---- Corpo da sacola ----
  ctx.save();
  // Sombra do corpo
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;

  // Gradiente do corpo
  const bodyGrad = ctx.createLinearGradient(bagX, bagY, bagX + bagW, bagY + bagH);
  bodyGrad.addColorStop(0, lighten(colorHex, 12));
  bodyGrad.addColorStop(0.4, colorHex);
  bodyGrad.addColorStop(1, darken(colorHex, 18));

  ctx.beginPath();
  roundRect(ctx, bagX, bagY, bagW, bagH, cornerR);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.restore();

  // Borda do corpo
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, bagX, bagY, bagW, bagH, cornerR);
  ctx.strokeStyle = darken(colorHex, 22);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // ---- Textura de tecido ----
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, bagX, bagY, bagW, bagH, cornerR);
  ctx.clip();
  ctx.globalAlpha = 0.04;
  for (let y = bagY; y < bagY + bagH; y += 3) {
    ctx.beginPath();
    ctx.moveTo(bagX, y);
    ctx.lineTo(bagX + bagW, y);
    ctx.strokeStyle = darken(colorHex, 30);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.restore();

  // ---- Dobras / sombra interna nas bordas ----
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, bagX, bagY, bagW, bagH, cornerR);
  ctx.clip();

  // Sombra esquerda
  const leftShadow = ctx.createLinearGradient(bagX, 0, bagX + bagW * 0.15, 0);
  leftShadow.addColorStop(0, 'rgba(0,0,0,0.08)');
  leftShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftShadow;
  ctx.fillRect(bagX, bagY, bagW * 0.15, bagH);

  // Sombra direita
  const rightShadow = ctx.createLinearGradient(bagX + bagW, 0, bagX + bagW * 0.85, 0);
  rightShadow.addColorStop(0, 'rgba(0,0,0,0.06)');
  rightShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightShadow;
  ctx.fillRect(bagX + bagW * 0.85, bagY, bagW * 0.15, bagH);

  // Sombra inferior
  const bottomShadow = ctx.createLinearGradient(0, bagY + bagH, 0, bagY + bagH * 0.85);
  bottomShadow.addColorStop(0, 'rgba(0,0,0,0.06)');
  bottomShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bottomShadow;
  ctx.fillRect(bagX, bagY + bagH * 0.85, bagW, bagH * 0.15);

  ctx.restore();

  // ---- Brilho superior ----
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, bagX, bagY, bagW, bagH, cornerR);
  ctx.clip();
  const shine = ctx.createLinearGradient(bagX, bagY, bagX, bagY + bagH * 0.3);
  shine.addColorStop(0, 'rgba(255,255,255,0.1)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(bagX, bagY, bagW, bagH * 0.3);
  ctx.restore();

  // ---- Dobra superior ----
  const foldH = bagH * 0.06;
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, bagX, bagY, bagW, foldH, [cornerR, cornerR, 0, 0]);
  const foldGrad = ctx.createLinearGradient(bagX, bagY, bagX, bagY + foldH);
  foldGrad.addColorStop(0, darken(colorHex, 10));
  foldGrad.addColorStop(1, darken(colorHex, 5));
  ctx.fillStyle = foldGrad;
  ctx.globalAlpha = 0.25;
  ctx.fill();
  ctx.restore();

  // ---- Alças ----
  const handleW = bagW * 0.05;
  const handleH = bagH * 0.25;
  const handleSpread = bagW * 0.22;

  // Alça esquerda
  drawHandle(ctx, cx - handleSpread, bagY, handleW, handleH, colorHex, -1);
  // Alça direita
  drawHandle(ctx, cx + handleSpread, bagY, handleW, handleH, colorHex, 1);
}

/**
 * Desenha uma alça da sacola.
 */
function drawHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  width: number,
  height: number,
  colorHex: string,
  direction: number, // -1 = esquerda, 1 = direita
) {
  ctx.save();

  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;

  const handleGrad = ctx.createLinearGradient(x - width, 0, x + width, 0);
  handleGrad.addColorStop(0, darken(colorHex, 15));
  handleGrad.addColorStop(0.5, darken(colorHex, 5));
  handleGrad.addColorStop(1, darken(colorHex, 20));

  ctx.beginPath();
  ctx.moveTo(x - width * 0.8, topY);
  ctx.quadraticCurveTo(
    x - width * 0.8 * direction,
    topY - height,
    x + width * 0.3 * direction,
    topY - height * 0.6,
  );
  ctx.quadraticCurveTo(
    x + width * 1.2 * direction,
    topY - height * 0.2,
    x + width * 0.8,
    topY,
  );

  ctx.strokeStyle = handleGrad;
  ctx.lineWidth = width * 1.6;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Brilho na alça
  ctx.beginPath();
  ctx.moveTo(x - width * 0.6, topY);
  ctx.quadraticCurveTo(
    x - width * 0.6 * direction,
    topY - height * 0.9,
    x + width * 0.2 * direction,
    topY - height * 0.55,
  );
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = width * 0.4;
  ctx.stroke();

  ctx.restore();
}

/**
 * Helper para retângulo arredondado.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | number[],
) {
  const radii = Array.isArray(r) ? r : [r, r, r, r];
  const [tl, tr, br, bl] = radii;
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

// ============================================================
// LOGO — POSICIONAMENTO SOBRE O PRODUTO
// ============================================================

function drawLogoOnBag(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement,
  w: number,
  h: number,
) {
  // Área da sacola no canvas
  const bagW = w * 0.6;
  const bagH = h * 0.65;
  const bagX = w / 2 - bagW / 2;
  const bagY = h * 0.18;

  // Logo: máximo 28% da largura da sacola
  const maxLogoW = bagW * 0.28;
  const maxLogoH = bagH * 0.22;

  const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
  let drawW = maxLogoW;
  let drawH = drawW / ratio;
  if (drawH > maxLogoH) {
    drawH = maxLogoH;
    drawW = drawH * ratio;
  }

  // Centraliza na sacola (levemente acima do meio)
  const x = bagX + (bagW - drawW) / 2;
  const y = bagY + (bagH - drawH) / 2 - bagH * 0.06;

  // Sombra da logo
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  ctx.drawImage(logoImg, x, y, drawW, drawH);
  ctx.restore();

  // Borda sutil ao redor da logo
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1, y - 1, drawW + 2, drawH + 2);
  ctx.restore();
}

// ============================================================
// GERAÇÃO DA PRÉVIA — DO ZERO
// ============================================================

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

  // Se o produto tem imagem real, usa ela
  if (productImageUrl) {
    try {
      const img = await loadImage(productImageUrl);
      const ratio = img.naturalWidth / img.naturalHeight;
      let imgW = width * 0.85;
      let imgH = imgW / ratio;
      if (imgH > height * 0.85) { imgH = height * 0.85; imgW = imgH * ratio; }
      const imgX = (width - imgW) / 2;
      const imgY = (height - imgH) / 2;

      ctx.drawImage(img, imgX, imgY, imgW, imgH);

      // Aplica cor se selecionada
      if (selectedColorHex) {
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

      // Logo sobre a imagem
      if (logoDataUrl) {
        try {
          const logo = await loadImage(logoDataUrl);
          ctx.save();
          const maxLW = imgW * 0.28;
          const maxLH = imgH * 0.22;
          const lr = logo.naturalWidth / logo.naturalHeight;
          let lw = maxLW, lh = lw / lr;
          if (lh > maxLH) { lh = maxLH; lw = lh * lr; }
          const lx = imgX + (imgW - lw) / 2;
          const ly = imgY + (imgH - lh) / 2 - imgH * 0.06;
          ctx.shadowColor = 'rgba(0,0,0,0.2)';
          ctx.shadowBlur = 8;
          ctx.drawImage(logo, lx, ly, lw, lh);
          ctx.restore();
        } catch {}
      }

      return canvas.toDataURL('image/png');
    } catch {}
  }

  // Sem imagem real → desenha sacola do zero
  const bagColor = selectedColorHex || '#4a5568';
  drawBagOnCanvas(ctx, width, height, bagColor);

  // Logo sobre a sacola
  if (logoDataUrl) {
    try {
      const logo = await loadImage(logoDataUrl);
      drawLogoOnBag(ctx, logo, width, height);
    } catch {}
  }

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar'));
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
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string>('');

  const renderPreview = useCallback(async () => {
    setIsRendering(true);
    setError('');
    try {
      const w = compact ? 180 : 320;
      const h = compact ? 180 : 320;
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

  if (compact) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
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

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      <div className="relative bg-slate-50 p-3">
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

      <div className="p-4 border-t border-slate-100">
        <h4 className="font-semibold text-slate-900 text-sm">{config.productName}</h4>
        {config.selectedMaterialName ? (
          <p className="mt-1 text-xs text-slate-500">Material: <span className="text-slate-700 font-medium">{config.selectedMaterialName}</span></p>
        ) : null}
        {config.selectedColorName ? (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            Cor: <span className="text-slate-700 font-medium">{config.selectedColorName}</span>
            {config.selectedColorHex ? (
              <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: config.selectedColorHex }} />
            ) : null}
          </div>
        ) : null}
        {config.quantity && config.quantity > 0 ? (
          <p className="mt-1 text-xs text-slate-500">Qtd: <span className="text-slate-700 font-medium">{config.quantity}</span></p>
        ) : null}
        {config.unitPrice && config.unitPrice > 0 ? (
          <p className="mt-2 text-base font-bold text-slate-900">R$ {config.unitPrice.toFixed(2)}</p>
        ) : null}
        {config.logoDataUrl ? (
          <p className="mt-2 text-[10px] text-emerald-600 font-medium">✓ Logo aplicada</p>
        ) : null}
        {!config.productImageUrl ? (
          <p className="mt-1 text-[10px] text-amber-500">📐 Sacola gerada — cadastre imagem no estoque para foto real</p>
        ) : null}
      </div>
    </div>
  );
}
