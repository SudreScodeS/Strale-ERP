// app/api/logo-analysis/route.ts
// API endpoint para análise real de logo via Google Cloud Vision
// Recebe upload de imagem, analisa cores dominantes e retorna resultado

import { NextResponse } from 'next/server';
import { analyzeLogoImage, validateImage } from '../../lib/vision';
import { requireRole } from '../../lib/auth';

export async function POST(request: Request) {
  try {
    // Autenticação
    requireRole(request, ['admin', 'seller']);

    // Parse do multipart form data
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo de imagem enviado.' },
        { status: 400 },
      );
    }

    // Validação de formato e tamanho
    const validation = validateImage(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 },
      );
    }

    // Análise real via Google Cloud Vision
    const analysis = await analyzeLogoImage(file);

    // Se conteúdo inseguro, rejeita
    if (!analysis.safeSearch.safe) {
      return NextResponse.json(
        {
          error: `Imagem rejeitada: ${analysis.safeSearch.issues.join(', ')}. Envie uma imagem apropriada.`,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      colors: analysis.significantColorCount,
      colorDetails: analysis.colors.slice(0, 8), // Top 8 cores para exibição
      complexity: analysis.complexity,
      description: analysis.description,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno na análise de logo.';

    // Se for erro de configuração, retornar 503 (serviço indisponível)
    if (message.includes('credencial') || message.includes('GOOGLE_')) {
      return NextResponse.json(
        { error: 'Serviço de análise de imagem não configurado. Contate o administrador.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
