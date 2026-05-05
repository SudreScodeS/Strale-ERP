// app/components/product-preview.tsx
// Prévia do produto: HTML + CSS puro (sem Canvas, sem SVG, sem dependências)
// Mostra: imagem do produto OU placeholder colorido + logo + detalhes

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
  sacola: '#1e293b',
  camiseta: '#f8fafc',
  caneca: '#f8fafc',
  default: '#475569',
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
 * 100% HTML/CSS — sem Canvas, sem SVG complexo.
 * Se o produto tem imagem → mostra a imagem
 * Se não tem → mostra placeholder colorido com a logo
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

  // Notifica parent sobre a prévia (usando representação textual)
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
          style={{ backgroundColor: hasRealImage ? '#f8fafc' : productColor }}
        >
          {hasRealImage ? (
            <img
              src={productImageUrl}
              alt={productName}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="text-center p-4">
              <div className="text-4xl mb-1">👜</div>
              <p className="text-xs text-white/80 font-medium">{productName}</p>
            </div>
          )}
          {logoDataUrl ? (
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
          backgroundColor: hasRealImage ? '#f8fafc' : productColor,
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
          /* Placeholder: sacola estilizada com CSS */
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            {/* Forma da sacola */}
            <div className="relative">
              {/* Corpo da sacola */}
              <div
                className="w-40 h-52 rounded-b-lg rounded-t-sm relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${lighten(productColor, 15)} 0%, ${productColor} 50%, ${darken(productColor, 20)} 100%)`,
                  boxShadow: '4px 8px 20px rgba(0,0,0,0.15)',
                }}
              >
                {/* Dobra superior */}
                <div
                  className="absolute top-0 left-0 right-0 h-3"
                  style={{ backgroundColor: darken(productColor, 10), opacity: 0.3 }}
                />
                {/* Brilho */}
                <div
                  className="absolute top-0 left-0 w-1/3 h-full"
                  style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, transparent 100%)' }}
                />
                {/* Textura */}
                <div
                  className="absolute inset-0 opacity-5"
                  style={{
                    backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 3px)`,
                  }}
                />
              </div>
              {/* Alças */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-10">
                <div
                  className="w-2 h-10 rounded-full"
                  style={{
                    background: `linear-gradient(180deg, ${darken(productColor, 10)} 0%, ${darken(productColor, 25)} 100%)`,
                    transform: 'rotate(-8deg)',
                  }}
                />
                <div
                  className="w-2 h-10 rounded-full"
                  style={{
                    background: `linear-gradient(180deg, ${darken(productColor, 10)} 0%, ${darken(productColor, 25)} 100%)`,
                    transform: 'rotate(8deg)',
                  }}
                />
              </div>
            </div>

            {/* Logo sobre a sacola */}
            {logoDataUrl ? (
              <img
                src={logoDataUrl}
                alt="Logo"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-lg"
                style={{ maxWidth: '30%', maxHeight: '25%' }}
              />
            ) : null}
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
