// app/components/product-preview.tsx
// Componente de prévia visual REAL: EDITA a imagem do produto
// 1. Muda a cor do produto (sacola/camiseta) baseado na variável selecionada
// 2. Extrai a logo da imagem enviada e posiciona no produto
// 3. Resultado: imagem que representa fielmente o pedido

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface PreviewConfig {
  productImageUrl: string;
  productName: string;
  logoDataUrl: string | null;      // Imagem completa enviada pelo cliente
  selectedColorHex?: string;        // Cor da variável selecionada
  selectedMaterialName?: string;
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
 * Aplica cor do produto usando blending.
 * Usa multiply para escurecer + overlay para colorir preservando textura.
 */
function applyProductColor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colorHex: string,
) {
  // Camada 1: Multiply (preserva textura, aplica cor)
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Camada 2: Soft light para suavizar
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Desenha a logo sobre o produto com posicionamento correto.
 * A logo é a imagem que o cliente enviou — usamos ela inteira como overlay.
 */
function drawLogoOnProduct(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement,
  canvasW: number,
  canvasH: number,
) {
  // Tamanho da logo: proporcional ao canvas, não maior que 40%
  const maxLogoW = canvasW * 0.4;
  const maxLogoH = canvasH * 0.35;

  const logoRatio = logoImg.naturalWidth / logoImg.naturalHeight;
  let drawW = maxLogoW;
  let drawH = drawW / logoRatio;

  if (drawH > maxLogoH) {
    drawH = maxLogoH;
    drawW = drawH * logoRatio;
  }

  // Centraliza no canvas (posição do produto)
  const x = (canvasW - drawW) / 2;
  const y = (canvasH - drawH) / 2 - canvasH * 0.05; // Levemente acima do centro

  // Sombra para destacar
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  ctx.drawImage(logoImg, x, y, drawW, drawH);
  ctx.restore();
}

/**
 * Gera a imagem do produto com a cor trocada.
 * Retorna o canvas com o produto recolorido (sem logo).
 */
function recolorProduct(
  productImg: HTMLImageElement,
  colorHex: string,
  w: number,
  h: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Desenha produto original
  const imgRatio = productImg.naturalWidth / productImg.naturalHeight;
  let imgW = w * 0.9;
  let imgH = imgW / imgRatio;
  if (imgH > h * 0.9) { imgH = h * 0.9; imgW = imgH * imgRatio; }
  const imgX = (w - imgW) / 2;
  const imgY = (h - imgH) / 2;

  ctx.drawImage(productImg, imgX, imgY, imgW, imgH);

  // Aplica cor do produto
  applyProductColor(ctx, w, h, colorHex);

  return canvas;
}

/**
 * Gera a prévia visual completa do produto.
 * Fluxo:
 * 1. Carrega imagem do produto (ex: sacola)
 * 2. Troca a cor do produto pela variável selecionada
 * 3. Extrai e posiciona a logo sobre o produto
 * 4. Retorna data URL da composição final
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
  if (!ctx) throw new Error('Canvas não suportado');

  // Fundo neutro
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, width, height);

  if (!productImageUrl) {
    // Sem imagem do produto — mostra placeholder
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Produto sem imagem', width / 2, height / 2);
    return canvas.toDataURL('image/png');
  }

  // Carrega imagem do produto
  const productImg = await loadImage(productImageUrl);

  // Passo 1: Desenha produto e aplica cor
  if (selectedColorHex) {
    // Com cor selecionada: desenha produto recolorido
    const recoloredCanvas = recolorProduct(productImg, selectedColorHex, width, height);
    ctx.drawImage(recoloredCanvas, 0, 0);
  } else {
    // Sem cor selecionada: desenha produto original
    const imgRatio = productImg.naturalWidth / productImg.naturalHeight;
    let imgW = width * 0.9;
    let imgH = imgW / imgRatio;
    if (imgH > height * 0.9) { imgH = height * 0.9; imgW = imgH * imgRatio; }
    const imgX = (width - imgW) / 2;
    const imgY = (height - imgH) / 2;
    ctx.drawImage(productImg, imgX, imgY, imgW, imgH);
  }

  // Passo 2: Extrai e posiciona a logo sobre o produto
  if (logoDataUrl) {
    try {
      const logoImg = await loadImage(logoDataUrl);
      drawLogoOnProduct(ctx, logoImg, width, height);
    } catch {
      console.warn('[Preview] Falha ao carregar logo para composição');
    }
  }

  // Marca d'água sutil
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.font = `bold ${width * 0.1}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText('PRÉVIA', width / 2, height * 0.88);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Carrega imagem de forma assíncrona.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem`));
    img.src = src;
  });
}

/**
 * Componente React que renderiza a prévia visual do produto.
 * Mostra o produto com a cor aplicada e a logo posicionada.
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

    const w = compact ? 200 : 400;
    const h = compact ? 200 : 400;
    canvas.width = w;
    canvas.height = h;

    try {
      // Fundo
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, w, h);

      if (!config.productImageUrl) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${compact ? 10 : 14}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Sem imagem', w / 2, h / 2);
        const dataUrl = canvas.toDataURL('image/png');
        setPreviewUrl(dataUrl);
        onPreviewGenerated?.(dataUrl);
        setIsRendering(false);
        return;
      }

      // Carrega produto
      const productImg = await loadImage(config.productImageUrl);
      const imgRatio = productImg.naturalWidth / productImg.naturalHeight;
      let imgW = w * 0.9;
      let imgH = imgW / imgRatio;
      if (imgH > h * 0.9) { imgH = h * 0.9; imgW = imgH * imgRatio; }
      const imgX = (w - imgW) / 2;
      const imgY = (h - imgH) / 2;

      // Desenha produto
      ctx.drawImage(productImg, imgX, imgY, imgW, imgH);

      // Aplica cor do produto (se selecionada)
      if (config.selectedColorHex) {
        applyProductColor(ctx, w, h, config.selectedColorHex);
      }

      // Desenha logo (se enviada)
      if (config.logoDataUrl) {
        try {
          const logoImg = await loadImage(config.logoDataUrl);
          drawLogoOnProduct(ctx, logoImg, w, h);
        } catch {
          // Continua sem logo
        }
      }

      // Label do material
      if (config.selectedMaterialName) {
        ctx.save();
        ctx.font = `bold ${compact ? 8 : 11}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(config.selectedMaterialName, compact ? 4 : 10, h - (compact ? 6 : 12));
        ctx.restore();
      }

      const dataUrl = canvas.toDataURL('image/png');
      setPreviewUrl(dataUrl);
      onPreviewGenerated?.(dataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao renderizar prévia';
      setError(msg);
      console.error('[ProductPreview]', msg);
    } finally {
      setIsRendering(false);
    }
  }, [config, compact, onPreviewGenerated]);

  useEffect(() => {
    void renderPreview();
  }, [renderPreview]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-auto" style={{ display: previewUrl ? 'none' : 'block' }} />
      {previewUrl ? (
        <img src={previewUrl} alt={`Prévia: ${config.productName}`} className="w-full h-auto rounded-2xl" />
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
        <div className="absolute inset-0 flex items-center justify-center bg-red-50/90 p-2">
          <p className="text-xs text-red-600 text-center">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
