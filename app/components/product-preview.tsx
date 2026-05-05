// app/components/product-preview.tsx
// Prévia do produto: HTML + CSS puro (sem Canvas, sem SVG, sem dependências)
// Gera sacola realista com textura de tecido, sombras, dobras e alças proporcionais

'use client';

import { useMemo, useState } from 'react';

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

/**
 * Cores padrão para produtos sem cor selecionada.
 */
const DEFAULT_PRODUCT_COLORS: Record<string, string> = {
  sacola: '#1e40af',
  camiseta: '#f8fafc',
  caneca: '#f8fafc',
  default: '#1e40af',
};

function getDefaultColor(productName: string): string {
  const lower = productName.toLowerCase();
  for (const [key, color] of Object.entries(DEFAULT_PRODUCT_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return DEFAULT_PRODUCT_COLORS.default;
}

/**
 * Componente de prévia do produto.
 * Gera uma sacola realista com CSS puro — textura de tecido, sombras,
 * dobras verticais, alças proporcionais e logo centralizada na face frontal.
 */
export default function ProductPreview({
  config,
  onPreviewGenerated,
  className = '',
  compact = false,
}: ProductPreviewProps) {
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

  // Cor do produto
  const productColor = selectedColorHex || getDefaultColor(productName);

  // Se tem imagem real do produto
  const hasRealImage = Boolean(productImageUrl && !imgError);

  // Notifica parent sobre a prévia
  useMemo(() => {
    if (onPreviewGenerated) {
      onPreviewGenerated(`preview:${productName}:${productColor}:${logoDataUrl ? 'logo' : 'no-logo'}`);
    }
  }, [productName, productColor, logoDataUrl, onPreviewGenerated]);

  if (compact) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
        <div
          className="relative w-full aspect-square flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: hasRealImage ? '#f8fafc' : '#e2e8f0' }}
        >
          {hasRealImage ? (
            <img
              src={productImageUrl}
              alt={productName}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <RealisticBag color={productColor} logoUrl={logoDataUrl} compact />
          )}
          {logoDataUrl && hasRealImage ? (
            <img
              src={logoDataUrl}
              alt="Logo"
              className="absolute inset-0 m-auto h-12 w-12 object-contain drop-shadow-md"
              style={{ maxWidth: '35%', maxHeight: '35%' }}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm ${className}`}>
      {/* Área visual do produto */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          backgroundColor: hasRealImage ? '#f8fafc' : '#e2e8f0',
          aspectRatio: '4/5',
        }}
      >
        {hasRealImage ? (
          <>
            <img
              src={productImageUrl}
              alt={productName}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            {/* Overlay de cor se selecionada */}
            {selectedColorHex ? (
              <div
                className="absolute inset-0 mix-blend-multiply"
                style={{ backgroundColor: selectedColorHex, opacity: 0.4 }}
              />
            ) : null}
          </>
        ) : (
          /* Sacola realista gerada com CSS */
          <div className="w-full h-full flex items-center justify-center relative">
            <RealisticBag color={productColor} logoUrl={logoDataUrl} />
          </div>
        )}

        {/* Badge de cor selecionada */}
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

      {/* Detalhes do produto */}
      <div className="p-4 space-y-1.5">
        <h4 className="font-semibold text-slate-900 text-sm leading-tight">{productName}</h4>

        {selectedMaterialName ? (
          <p className="text-xs text-slate-500">
            Material: <span className="text-slate-800 font-medium">{selectedMaterialName}</span>
          </p>
        ) : null}

        {selectedColorName ? (
          <p className="text-xs text-slate-500">
            Cor: <span className="text-slate-800 font-medium">{selectedColorName}</span>
          </p>
        ) : null}

        {quantity && quantity > 0 ? (
          <p className="text-xs text-slate-500">
            Qtd: <span className="text-slate-800 font-medium">{quantity}</span>
          </p>
        ) : null}

        {unitPrice && unitPrice > 0 ? (
          <p className="text-lg font-bold text-slate-900 mt-2">
            R$ {unitPrice.toFixed(2)}
          </p>
        ) : null}

        {logoDataUrl ? (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-emerald-500 text-xs">✓</span>
            <span className="text-[10px] text-emerald-600 font-medium">Logo aplicada</span>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 mt-1">Envie uma logo para personalizar</p>
        )}

        {!hasRealImage ? (
          <p className="text-[10px] text-amber-500 mt-1">
            📐 Visual ilustrativo — adicione imagem no estoque para foto real
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: Sacola Realista CSS
// ==========================================

interface RealisticBagProps {
  color: string;
  logoUrl: string | null;
  compact?: boolean;
}

function RealisticBag({ color, logoUrl, compact = false }: RealisticBagProps) {
  const light = lighten(color, 20);
  const lighter = lighten(color, 35);
  const dark = darken(color, 25);
  const darker = darken(color, 40);
  const mid = darken(color, 10);

  // Tamanhos proporcionais
  const bagW = compact ? 120 : 200;
  const bagH = compact ? 150 : 260;
  const foldH = compact ? 10 : 18;
  const handleW = compact ? 3 : 5;
  const handleH = compact ? 30 : 50;
  const handleGap = compact ? 28 : 48;

  return (
    <div
      className="relative"
      style={{
        width: bagW,
        height: bagH + handleH + 8,
        filter: 'drop-shadow(6px 10px 24px rgba(0,0,0,0.25))',
      }}
    >
      {/* Alças — atrás da sacola */}
      <div
        className="absolute flex justify-center"
        style={{
          top: 0,
          left: 0,
          right: 0,
          height: handleH + 10,
          zIndex: 0,
        }}
      >
        {/* Alça esquerda */}
        <div
          style={{
            position: 'absolute',
            left: bagW * 0.25 - handleW / 2,
            width: handleW,
            height: handleH,
            borderRadius: handleW,
            background: `linear-gradient(90deg, ${darker} 0%, ${dark} 30%, ${mid} 50%, ${dark} 70%, ${darker} 100%)`,
            transform: 'rotate(-6deg)',
            transformOrigin: 'bottom center',
            boxShadow: `inset 0 0 2px rgba(255,255,255,0.15), 1px 2px 4px rgba(0,0,0,0.2)`,
          }}
        />
        {/* Alça direita */}
        <div
          style={{
            position: 'absolute',
            left: bagW * 0.75 - handleW / 2,
            width: handleW,
            height: handleH,
            borderRadius: handleW,
            background: `linear-gradient(90deg, ${darker} 0%, ${dark} 30%, ${mid} 50%, ${dark} 70%, ${darker} 100%)`,
            transform: 'rotate(6deg)',
            transformOrigin: 'bottom center',
            boxShadow: `inset 0 0 2px rgba(255,255,255,0.15), 1px 2px 4px rgba(0,0,0,0.2)`,
          }}
        />
      </div>

      {/* Corpo da sacola */}
      <div
        className="absolute overflow-hidden"
        style={{
          top: handleH,
          left: 0,
          width: bagW,
          height: bagH,
          borderRadius: `${compact ? 4 : 6}px ${compact ? 4 : 6}px ${compact ? 8 : 14}px ${compact ? 8 : 14}px`,
          zIndex: 1,
        }}
      >
        {/* Fundo gradiente principal */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              170deg,
              ${lighter} 0%,
              ${light} 15%,
              ${color} 35%,
              ${mid} 65%,
              ${dark} 90%,
              ${darker} 100%
            )`,
          }}
        />

        {/* Textura de tecido (linhas horizontais finas) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(255,255,255,0.03) 2px,
              rgba(255,255,255,0.03) 3px
            )`,
          }}
        />

        {/* Textura de tecido (linhas verticais finas) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 3px,
              rgba(0,0,0,0.02) 3px,
              rgba(0,0,0,0.02) 4px
            )`,
          }}
        />

        {/* Dobras verticais simuladas */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(90deg,
                transparent 0%,
                rgba(0,0,0,0.04) 18%,
                transparent 22%,
                rgba(255,255,255,0.03) 30%,
                transparent 35%,
                rgba(0,0,0,0.03) 48%,
                transparent 52%,
                rgba(255,255,255,0.02) 60%,
                transparent 65%,
                rgba(0,0,0,0.04) 78%,
                transparent 82%,
                rgba(255,255,255,0.03) 90%,
                transparent 100%
              )
            `,
          }}
        />

        {/* Brilho lateral esquerdo */}
        <div
          className="absolute top-0 left-0"
          style={{
            width: '40%',
            height: '100%',
            background: `linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 100%)`,
          }}
        />

        {/* Sombra lateral direita */}
        <div
          className="absolute top-0 right-0"
          style={{
            width: '25%',
            height: '100%',
            background: `linear-gradient(270deg, rgba(0,0,0,0.12) 0%, transparent 100%)`,
          }}
        />

        {/* Dobra superior (borda da boca) */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            height: foldH,
            background: `linear-gradient(180deg, ${dark} 0%, ${mid} 40%, transparent 100%)`,
            opacity: 0.5,
          }}
        />

        {/* Linha de costura na dobra */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: foldH - 2,
            height: 1,
            backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 4px, transparent 4px, transparent 8px)`,
          }}
        />

        {/* Sombra interna na base */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: '20%',
            background: `linear-gradient(0deg, rgba(0,0,0,0.15) 0%, transparent 100%)`,
          }}
        />

        {/* Sombra de fundo (chão) */}
        <div
          className="absolute -bottom-3 left-1/2 -translate-x-1/2"
          style={{
            width: bagW * 0.8,
            height: 12,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Logo ou texto placeholder */}
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="absolute object-contain"
            style={{
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: '55%',
              maxHeight: '35%',
              filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.2))',
            }}
          />
        ) : (
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: '70%',
            }}
          >
            <span
              className="font-bold tracking-wider text-center select-none"
              style={{
                fontSize: compact ? 11 : 16,
                color: 'rgba(255,255,255,0.7)',
                textShadow: '0 1px 3px rgba(0,0,0,0.2)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              Logo Aqui
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// UTILITÁRIOS DE COR
// ==========================================

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
