// app/api/logo-analysis/route.ts
// API endpoint para análise inteligente de imagem
// Separa automaticamente: cor do PRODUTO vs cores da LOGO
// Retorna dados completos para geração de prévia visual

import { NextResponse } from 'next/server';
import { analyzeLogoImage, validateImage } from '../../lib/vision';
import { requireRole } from '../../lib/auth';

export async function POST(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo de imagem enviado.' }, { status: 400 });
    }

    const validation = validateImage(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const analysis = await analyzeLogoImage(file);

    if (!analysis.safeSearch.safe) {
      return NextResponse.json(
        { error: `Imagem rejeitada: ${analysis.safeSearch.issues.join(', ')}. Envie uma imagem apropriada.` },
        { status: 422 },
      );
    }

    return NextResponse.json({
      // Cores da LOGO (elementos gráficos, texto)
      colors: analysis.significantColorCount,
      colorDetails: analysis.colors.slice(0, 8),

      // Cor do PRODUTO (sacola, camiseta, etc)
      productColor: analysis.productColorHex,
      productColorRgb: analysis.productColorRgb,

      // Metadados
      complexity: analysis.complexity,
      description: analysis.description,
      source: analysis.source,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno na análise de logo.';

    if (message.includes('credencial') || message.includes('GOOGLE_')) {
      return NextResponse.json(
        { error: 'Serviço de análise de imagem não configurado. Contate o administrador.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
