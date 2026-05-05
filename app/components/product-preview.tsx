// app/components/product-preview.tsx
// Prévia do produto com IA generativa + Canvas para composição em tempo real
// Fluxo: IA gera imagem base da sacola → Canvas compõe cor + logo em tempo real

'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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

// Cores padrão
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

// Estilo do produto baseado no nome
function getProductStyle(productName: string): string {
  const lower = productName.toLowerCase();
  if (lower.includes('camiseta') || lower.includes('camisa')) return 'camiseta';
  if (lower.includes('caneca') || lower.includes('mug')) return 'caneca';
  return 'sacola';
}

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
  const [imgError, setImgError] = useState(false);

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
  const hasRealImage = Boolean(productImageUrl && !imgError);
  const productStyle = getProductStyle(productName);

  // Cache key para a imagem gerada
  const generationKey = `${productColor}-${productStyle}`;

  // ==========================================
  // 1. Gerar/carregar imagem base da sacola via IA
  // ==========================================
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    if (hasRealImage) return; // Não gera se tem imagem real

    // Verifica cache local (no browser)
    const cached = imageCacheRef.current.get(generationKey);
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
          body: JSON.stringify({
            color: productColor,
            style: productStyle,
          }),
        });

        if (cancelled) return;

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data.fallback) {
            // Sem token — usa fallback Canvas
            setBaseImage(null);
            setError('IA não configurada — usando visual ilustrativo');
            setLoading(false);
            return;
          }
          if (data.retry) {
            // Modelo carregando — retry em 3s
            setTimeout(() => {
              if (!cancelled) void generateImage();
            }, 3000);
            return;
          }
          throw new Error(data.error || 'Erro ao gerar imagem');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          imageCacheRef.current.set(generationKey, img);
          setBaseImage(img);
          setLoading(false);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          if (!cancelled) {
            setError('Erro ao carregar imagem gerada');
            setLoading(false);
          }
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
  }, [generationKey, hasRealImage, productColor, productStyle]);

  // ==========================================
  // 2. Carregar logo como Image
  // ==========================================
  useEffect(() => {
    if (!logoDataUrl) {
      setLogoImage(null);
      return;
    }

    const img = new Image();
    img.onload = () => setLogoImage(img);
    img.onerror = () => setLogoImage(null);
    img.src = logoDataUrl;
  }, [logoDataUrl]);

  // ==========================================
  // 3. Renderizar no Canvas (composição em tempo real)
  // ==========================================
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Limpa
    ctx.clearRect(0, 0, w, h);

    // Fundo
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, w, h);

    if (hasRealImage) {
      // Modo imagem real: desenha a imagem do estoque
      // (será desenhada via <img> no fallback, Canvas só para logo overlay)
      return;
    }

    if (baseImage) {
      // ========================================
      // MODO IA: imagem gerada pela IA
      // ========================================

      // Calcula dimensões mantendo proporção
      const imgRatio = baseImage.width / baseImage.height;
      const canvasRatio = w / h;
      let drawW: number, drawH: number, drawX: number, drawY: number;

      if (imgRatio > canvasRatio) {
        drawW = w * 0.85;
        drawH = drawW / imgRatio;
        drawX = (w - drawW) / 2;
        drawY = (h - drawH) / 2;
      } else {
        drawH = h * 0.85;
        drawW = drawH * imgRatio;
        drawX = (w - drawW) / 2;
        drawY = (h - drawH) / 2;
      }

      // Desenha a imagem base
      ctx.drawImage(baseImage, drawX, drawY, drawW, drawH);

      // Aplica tint de cor sutil (para ajustar a cor da sacola)
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = productColor;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.restore();

      // Clareia um pouco para manter visibilidade
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.15;
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.restore();

      // Composição do logo
      if (logoImage) {
        const logoMaxW = drawW * 0.45;
        const logoMaxH = drawH * 0.3;
        const logoRatio = logoImage.width / logoImage.height;

        let logoW: number, logoH: number;
        if (logoRatio > logoMaxW / logoMaxH) {
          logoW = logoMaxW;
          logoH = logoW / logoRatio;
        } else {
          logoH = logoMaxH;
          logoW = logoH * logoRatio;
        }

        const logoX = drawX + (drawW - logoW) / 2;
        const logoY = drawY + drawH * 0.35;

        // Sombra da logo
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
        ctx.drawImage(logoImage, logoX, logoY, logoW, logoH);
        ctx.restore();
      }

    } else {
      // ========================================
      // MODO FALLBACK: Canvas puro (sem IA)
      // ========================================
      drawFallbackBag(ctx, w, h, productColor, logoImage);
    }

    // Notifica parent
    if (onPreviewGenerated) {
      try {
        onPreviewGenerated(canvas.toDataURL('image/png'));
      } catch { /* ignore */ }
    }
  }, [baseImage, logoImage, productColor, hasRealImage, onPreviewGenerated]);

  // Re-renderiza quando dependências mudam
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // ==========================================
  // Renderização
  // ==========================================

  // Modo compacto (carrinho)
  if (compact) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
        <div
          className="relative w-full aspect-square flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: '#e2e8f0' }}
        >
          {hasRealImage ? (
            <>
              <img
                src={productImageUrl}
                alt={productName}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt="Logo"
                  className="absolute inset-0 m-auto h-12 w-12 object-contain drop-shadow-md"
                  style={{ maxWidth: '35%', maxHeight: '35%' }}
                />
              ) : null}
            </>
          ) : (
            <canvas
              ref={canvasRef}
              width={compact ? 200 : 400}
              height={compact ? 200 : 500}
              className="w-full h-full object-contain"
            />
          )}
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <svg className="h-6 w-6 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-[10px] text-slate-600">Gerando…</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Modo completo (card de catálogo)
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm ${className}`}>
      {/* Área visual */}
      <div
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: '#e2e8f0', aspectRatio: '4/5' }}
      >
        {hasRealImage ? (
          <>
            <img
              src={productImageUrl}
              alt={productName}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            {selectedColorHex ? (
              <div
                className="absolute inset-0 mix-blend-multiply"
                style={{ backgroundColor: selectedColorHex, opacity: 0.4 }}
              />
            ) : null}
            {logoDataUrl ? (
              <img
                src={logoDataUrl}
                alt="Logo"
                className="absolute object-contain drop-shadow-lg"
                style={{
                  top: '40%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  maxWidth: '40%',
                  maxHeight: '30%',
                }}
              />
            ) : null}
          </>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              width={400}
              height={500}
              className="w-full h-full object-contain"
            />

            {/* Loading overlay */}
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs text-slate-600">Gerando imagem com IA…</span>
                </div>
              </div>
            ) : null}

            {/* Error banner */}
            {error ? (
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-[10px] text-amber-700 bg-amber-50/90 rounded-lg px-2 py-1 text-center">
                  {error}
                </p>
              </div>
            ) : null}

            {/* Badge: fonte da imagem */}
            {baseImage ? (
              <div className="absolute top-2 left-2">
                <span className="text-[9px] bg-blue-100/90 text-blue-700 rounded-full px-2 py-0.5 font-medium">
                  ✨ Gerado por IA
                </span>
              </div>
            ) : !loading && !error ? (
              <div className="absolute top-2 left-2">
                <span className="text-[9px] bg-slate-100/90 text-slate-500 rounded-full px-2 py-0.5 font-medium">
                  🎨 Ilustrativo
                </span>
              </div>
            ) : null}
          </>
        )}

        {/* Badge de cor */}
        {selectedColorHex ? (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
            <span
              className="h-3 w-3 rounded-full border border-slate-300"
              style={{ backgroundColor: selectedColorHex }}
            />
            <span className="text-[10px] font-medium text-slate-700">{selectedColorName || 'Cor'}</span>
          </div>
        ) : null}
      </div>

      {/* Detalhes */}
      <div className="p-4 space-y-1.5">
        <h4 className="font-semibold text-slate-900 text-sm leading-tight">{productName}</h4>
        {selectedMaterialName ? (
          <p className="text-xs text-slate-500">Material: <span className="text-slate-800 font-medium">{selectedMaterialName}</span></p>
        ) : null}
        {selectedColorName ? (
          <p className="text-xs text-slate-500">Cor: <span className="text-slate-800 font-medium">{selectedColorName}</span></p>
        ) : null}
        {quantity && quantity > 0 ? (
          <p className="text-xs text-slate-500">Qtd: <span className="text-slate-800 font-medium">{quantity}</span></p>
        ) : null}
        {unitPrice && unitPrice > 0 ? (
          <p className="text-lg font-bold text-slate-900 mt-2">R$ {unitPrice.toFixed(2)}</p>
        ) : null}
        {logoDataUrl ? (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-emerald-500 text-xs">✓</span>
            <span className="text-[10px] text-emerald-600 font-medium">Logo aplicada</span>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 mt-1">Envie uma logo para personalizar</p>
        )}
        {!hasRealImage && !baseImage && !loading ? (
          <p className="text-[10px] text-amber-500 mt-1">
            📐 Configure HUGGINGFACE_API_TOKEN para imagens geradas por IA
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ==========================================
// FALLBACK: Sacola desenhada no Canvas
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

  // Sombra no chão
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(w / 2, bagY + bagH + 10, bagW * 0.4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Corpo da sacola
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

  // Textura de tecido
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

  // Brilho lateral
  const shine = ctx.createLinearGradient(bagX, bagY, bagX + bagW * 0.4, bagY);
  shine.addColorStop(0, 'rgba(255,255,255,0.12)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fill();

  // Borda superior (dobra)
  ctx.fillStyle = darken(color, 15);
  ctx.globalAlpha = 0.4;
  ctx.fillRect(bagX, bagY, bagW, 12);
  ctx.globalAlpha = 1;

  // Costura
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bagX + 8, bagY + 12);
  ctx.lineTo(bagX + bagW - 8, bagY + 12);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();

  // Alças
  drawHandle(ctx, bagX + bagW * 0.28, bagY, color);
  drawHandle(ctx, bagX + bagW * 0.72, bagY, color);

  // Logo ou placeholder
  if (logoImage) {
    const maxLogoW = bagW * 0.6;
    const maxLogoH = bagH * 0.3;
    const ratio = logoImage.width / logoImage.height;
    let lw: number, lh: number;
    if (ratio > maxLogoW / maxLogoH) {
      lw = maxLogoW;
      lh = lw / ratio;
    } else {
      lh = maxLogoH;
      lw = lh * ratio;
    }
    const lx = bagX + (bagW - lw) / 2;
    const ly = bagY + bagH * 0.38;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.drawImage(logoImage, lx, ly, lw, lh);
    ctx.restore();
  } else {
    // Texto "Logo Aqui"
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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.min(255, Math.max(0, Math.round(c))).toString(16).padStart(2, '0')).join('');
}
