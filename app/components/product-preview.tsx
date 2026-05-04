// app/components/product-preview.tsx
// Componente de prévia visual REAL do produto usando HTML Canvas
// Composição: imagem base do produto + cor/material + logo posicionada
// Gera data URL para exibição no carrinho

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface PreviewConfig {
  productImageUrl: string;
  productName: string;
  logoDataUrl: string | null;
  selectedColorHex?: string;     // Cor selecionada (variável de cor)
  selectedMaterialName?: string;  // Nome do material selecionado
  width?: number;
  height?: number;
}

interface ProductPreviewProps {
  config: PreviewConfig;
  onPreviewGenerated?: (dataUrl: string) => void;
  className?: string;
  compact?: boolean; // Modo compacto para carrinho
}

// Posicionamento da logo por tipo de produto (normalizado 0-1)
const LOGO_PLACEMENT: Record<string, { x: number; y: number; maxW: number; maxH: number }> = {
  sacola: { x: 0.5, y: 0.45, maxW: 0.35, maxH: 0.3 },
  default: { x: 0.5, y: 0.5, maxW: 0.4, maxH: 0.35 },
};

function getPlacement(productName: string) {
  const lower = productName.toLowerCase();
  if (lower.includes('sacola')) return LOGO_PLACEMENT.sacola;
  return LOGO_PLACEMENT.default;
}

/**
 * Aplica tint de cor sobre a imagem do produto usando Canvas.
 * Simula a cor/material selecionado aplicando um overlay semi-transparente.
 */
function applyColorTint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colorHex: string,
  intensity: number = 0.25,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = intensity;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Suaviza o resultado
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Desenha a logo na posição correta sobre o produto, mantendo proporção.
 */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  productName: string,
) {
  const placement = getPlacement(productName);

  // Tamanho máximo da logo
  const maxLogoW = canvasW * placement.maxW;
  const maxLogoH = canvasH * placement.maxH;

  // Calcula escala mantendo proporção
  const logoRatio = logo.naturalWidth / logo.naturalHeight;
  let drawW = maxLogoW;
  let drawH = drawW / logoRatio;

  if (drawH > maxLogoH) {
    drawH = maxLogoH;
    drawW = drawH * logoRatio;
  }

  // Centraliza no ponto de ancoragem
  const x = canvasW * placement.x - drawW / 2;
  const y = canvasH * placement.y - drawH / 2;

  // Sombra suave para destacar a logo
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.drawImage(logo, x, y, drawW, drawH);
  ctx.restore();

  // Borda sutil ao redor da logo para definição
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1, y - 1, drawW + 2, drawH + 2);
  ctx.restore();
}

/**
 * Gera a prévia visual do produto em um canvas.
 * Retorna a data URL da imagem gerada.
 */
export async function generateProductPreview(config: PreviewConfig): Promise<string> {
  const {
    productImageUrl,
    productName,
    logoDataUrl,
    selectedColorHex,
    width = 600,
    height = 600,
  } = config;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas não suportado');

  // Fundo neutro
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, width, height);

  // Carrega e desenha a imagem base do produto
  const productImg = await loadImage(productImageUrl);
  
  // Centraliza e redimensiona a imagem do produto para caber no canvas
  const imgRatio = productImg.naturalWidth / productImg.naturalHeight;
  let imgW = width * 0.9;
  let imgH = imgW / imgRatio;
  if (imgH > height * 0.9) {
    imgH = height * 0.9;
    imgW = imgH * imgRatio;
  }
  const imgX = (width - imgW) / 2;
  const imgY = (height - imgH) / 2;

  // Desenha imagem base
  ctx.drawImage(productImg, imgX, imgY, imgW, imgH);

  // Aplica tint de cor se selecionada
  if (selectedColorHex) {
    applyColorTint(ctx, width, height, selectedColorHex, 0.2);
  }

  // Desenha logo se enviada
  if (logoDataUrl) {
    try {
      const logoImg = await loadImage(logoDataUrl);
      drawLogo(ctx, logoImg, width, height, productName);
    } catch {
      // Logo falhou, continua sem ela
      console.warn('[Preview] Falha ao carregar logo para composição');
    }
  }

  // Marca d'água sutil "Prévia"
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.font = `bold ${width * 0.12}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText('PRÉVIA', width / 2, height * 0.85);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Carrega uma imagem de forma assíncrona.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src.substring(0, 50)}...`));
    img.src = src;
  });
}

/**
 * Componente React que renderiza a prévia visual do produto.
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
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, w, h);

      // Imagem do produto
      if (config.productImageUrl) {
        const productImg = await loadImage(config.productImageUrl);
        const imgRatio = productImg.naturalWidth / productImg.naturalHeight;
        let imgW = w * 0.9;
        let imgH = imgW / imgRatio;
        if (imgH > h * 0.9) {
          imgH = h * 0.9;
          imgW = imgH * imgRatio;
        }
        const imgX = (w - imgW) / 2;
        const imgY = (h - imgH) / 2;
        ctx.drawImage(productImg, imgX, imgY, imgW, imgH);
      } else {
        // Placeholder de produto quando não há imagem
        ctx.save();
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(w * 0.15, h * 0.1, w * 0.7, h * 0.8);
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${compact ? 11 : 14}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(config.productName || 'Produto', w / 2, h / 2);
        ctx.restore();
      }

      // Tint de cor
      if (config.selectedColorHex) {
        applyColorTint(ctx, w, h, config.selectedColorHex, 0.2);
      }

      // Logo
      if (config.logoDataUrl) {
        try {
          const logoImg = await loadImage(config.logoDataUrl);
          drawLogo(ctx, logoImg, w, h, config.productName);
        } catch {
          // Ignora falha de logo
        }
      }

      // Label do material
      if (config.selectedMaterialName) {
        ctx.save();
        ctx.font = `bold ${compact ? 9 : 12}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const labelY = h - (compact ? 8 : 14);
        ctx.fillText(config.selectedMaterialName, compact ? 6 : 12, labelY);
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
