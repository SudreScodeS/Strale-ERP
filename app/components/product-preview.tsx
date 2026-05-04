// app/components/product-preview.tsx
// Componente de prévia visual REAL do produto
// Usa a imagem do produto como base — NÃO sobrepõe logo genérica
// Mostra o produto com a cor/material aplicado e detalhes das seleções

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface PreviewConfig {
  productImageUrl: string;
  productName: string;
  logoDataUrl: string | null;       // Logo do cliente (para posicionamento futuro)
  selectedColorHex?: string;         // Cor selecionada (variável)
  selectedColorName?: string;        // Nome da cor selecionada
  selectedMaterialName?: string;     // Material selecionado
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

/**
 * Aplica cor sobre a imagem do produto usando blending.
 * Usa multiply para preservar textura/material e mudar apenas a cor.
 */
function applyColorBlend(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colorHex: string,
  intensity: number = 0.5,
) {
  // Multiply: escurece e aplica a cor preservando textura
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = intensity;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Suaviza com overlay leve
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Gera a imagem de prévia do produto.
 * Se tem imagem do produto → usa ela como base, aplica cor se selecionada
 * Se não tem → mostra placeholder elegante
 */
export async function generateProductPreview(config: PreviewConfig): Promise<string> {
  const { productImageUrl, selectedColorHex, width = 500, height = 500 } = config;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (!ctx) throw new Error('Canvas não suportado');

  // Fundo limpo
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  if (!productImageUrl) {
    // Sem imagem: placeholder elegante
    drawPlaceholder(ctx, width, height, config.productName);
    return canvas.toDataURL('image/png');
  }

  try {
    // Carrega e desenha a imagem do produto
    const productImg = await loadImage(productImageUrl);

    // Calcula dimensões mantendo proporção (85% do canvas, centralizado)
    const imgRatio = productImg.naturalWidth / productImg.naturalHeight;
    let imgW = width * 0.85;
    let imgH = imgW / imgRatio;
    if (imgH > height * 0.85) {
      imgH = height * 0.85;
      imgW = imgH * imgRatio;
    }
    const imgX = (width - imgW) / 2;
    const imgY = (height - imgH) / 2;

    // Desenha imagem do produto
    ctx.drawImage(productImg, imgX, imgY, imgW, imgH);

    // Aplica cor selecionada sobre a imagem (se houver)
    if (selectedColorHex) {
      // Cria máscara apenas na área do produto
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgX, imgY, imgW, imgH);
      ctx.clip();
      applyColorBlend(ctx, width, height, selectedColorHex, 0.45);
      ctx.restore();
    }

    // Se tem logo do cliente, posiciona sobre o produto
    if (config.logoDataUrl) {
      try {
        const logoImg = await loadImage(config.logoDataUrl);
        drawLogoOverlay(ctx, logoImg, imgX, imgY, imgW, imgH);
      } catch {
        // Logo falhou, continua sem ela
      }
    }
  } catch {
    // Falha ao carregar imagem do produto
    drawPlaceholder(ctx, width, height, config.productName);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Desenha a logo do cliente posicionada sobre o produto.
 * Centraliza na área do produto com escala proporcional.
 */
function drawLogoOverlay(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement,
  productX: number,
  productY: number,
  productW: number,
  productH: number,
) {
  // Logo ocupa no máximo 30% da largura do produto
  const maxLogoW = productW * 0.3;
  const maxLogoH = productH * 0.25;

  const logoRatio = logoImg.naturalWidth / logoImg.naturalHeight;
  let drawW = maxLogoW;
  let drawH = drawW / logoRatio;

  if (drawH > maxLogoH) {
    drawH = maxLogoH;
    drawW = drawH * logoRatio;
  }

  // Centraliza na área do produto
  const x = productX + (productW - drawW) / 2;
  const y = productY + (productH - drawH) / 2;

  // Sombra suave
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  ctx.drawImage(logoImg, x, y, drawW, drawH);
  ctx.restore();
}

/**
 * Placeholder quando não há imagem do produto.
 */
function drawPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number, name: string) {
  // Fundo gradiente sutil
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#e2e8f0');
  grad.addColorStop(1, '#f1f5f9');
  ctx.fillStyle = grad;
  ctx.fillRect(w * 0.1, h * 0.15, w * 0.8, h * 0.7);

  // Ícone de produto
  ctx.fillStyle = '#94a3b8';
  ctx.font = `${w * 0.12}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📦', w / 2, h * 0.4);

  // Nome do produto
  ctx.fillStyle = '#64748b';
  ctx.font = `bold ${w * 0.04}px sans-serif`;
  ctx.fillText(name || 'Produto', w / 2, h * 0.55);

  // Texto auxiliar
  ctx.fillStyle = '#94a3b8';
  ctx.font = `${w * 0.03}px sans-serif`;
  ctx.fillText('Adicione uma imagem no estoque', w / 2, h * 0.63);
}

/**
 * Carrega imagem de forma assíncrona.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = src;
  });
}

/**
 * Componente React: prévia visual do produto.
 * Mostra a imagem do produto com cor/material aplicado + detalhes das seleções.
 * Estilo: card de catálogo de produto (igual à segunda imagem de referência).
 */
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
      // Fundo limpo
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      if (!config.productImageUrl) {
        drawPlaceholder(ctx, w, h, config.productName);
        const dataUrl = canvas.toDataURL('image/png');
        setPreviewUrl(dataUrl);
        onPreviewGenerated?.(dataUrl);
        setIsRendering(false);
        return;
      }

      // Carrega e desenha imagem do produto
      const productImg = await loadImage(config.productImageUrl);
      const imgRatio = productImg.naturalWidth / productImg.naturalHeight;
      let imgW = w * 0.85;
      let imgH = imgW / imgRatio;
      if (imgH > h * 0.85) { imgH = h * 0.85; imgW = imgH * imgRatio; }
      const imgX = (w - imgW) / 2;
      const imgY = (h - imgH) / 2;

      ctx.drawImage(productImg, imgX, imgY, imgW, imgH);

      // Aplica cor se selecionada
      if (config.selectedColorHex) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(imgX, imgY, imgW, imgH);
        ctx.clip();
        applyColorBlend(ctx, w, h, config.selectedColorHex, 0.45);
        ctx.restore();
      }

      // Logo do cliente sobre o produto
      if (config.logoDataUrl) {
        try {
          const logoImg = await loadImage(config.logoDataUrl);
          drawLogoOverlay(ctx, logoImg, imgX, imgY, imgW, imgH);
        } catch {}
      }

      const dataUrl = canvas.toDataURL('image/png');
      setPreviewUrl(dataUrl);
      onPreviewGenerated?.(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao renderizar');
    } finally {
      setIsRendering(false);
    }
  }, [config, compact, onPreviewGenerated]);

  useEffect(() => {
    void renderPreview();
  }, [renderPreview]);

  // Renderiza como card de produto (estilo catálogo)
  if (compact) {
    // Modo compacto: só a imagem
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
        <canvas ref={canvasRef} style={{ display: previewUrl ? 'none' : 'block' }} />
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

  // Modo completo: card de catálogo com detalhes
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      {/* Imagem do produto */}
      <div className="relative bg-slate-50 p-2">
        <canvas ref={canvasRef} style={{ display: previewUrl ? 'none' : 'block' }} className="mx-auto" />
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

      {/* Detalhes do produto (estilo catálogo) */}
      <div className="p-4 border-t border-slate-100">
        <h4 className="font-semibold text-slate-900 text-sm">{config.productName}</h4>

        {config.selectedMaterialName ? (
          <p className="mt-1 text-xs text-slate-500">
            Material: {config.selectedMaterialName}
          </p>
        ) : null}

        {config.selectedColorName ? (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <span>Cor: {config.selectedColorName}</span>
            {config.selectedColorHex ? (
              <span
                className="inline-block h-3 w-3 rounded-full border border-slate-300"
                style={{ backgroundColor: config.selectedColorHex }}
              />
            ) : null}
          </div>
        ) : null}

        {config.quantity && config.quantity > 0 ? (
          <p className="mt-1 text-xs text-slate-500">Qtd: {config.quantity}</p>
        ) : null}

        {config.unitPrice && config.unitPrice > 0 ? (
          <p className="mt-2 text-sm font-bold text-slate-900">
            R$ {config.unitPrice.toFixed(2)}
          </p>
        ) : null}

        {config.logoDataUrl ? (
          <p className="mt-2 text-[10px] text-emerald-600 font-medium">✓ Logo aplicada</p>
        ) : null}
      </div>
    </div>
  );
}
