// app/api/assistant/route.ts
// API do assistente inteligente — híbrido: Ollama (LLM) + Pattern Matching local
// Fluxo: pergunta → Ollama extrai parâmetros → código calcula preço/dados → resposta
// Se Ollama indisponível, fallback 100% local via pattern matching

import { NextResponse } from 'next/server';
import { processQuestion } from '../../lib/assistant';
import { extractParamsFromQuestion, checkOllamaStatus } from '../../lib/ollama-client';
import { calculateItemPricing, type PricingInput } from '../../lib/pricing';
import { productData, variableData, groupData } from '../../lib/data';
import { requireRole } from '../../lib/auth';
import { globalConfig } from '../../../config/global';

export async function POST(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const body = await request.json();
    const { question } = body as { question?: string };

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Faça uma pergunta.' }, { status: 400 });
    }

    const q = question.trim();

    // ===== TENTATIVA 1: OLLAMA (LLM LOCAL) =====
    const params = await extractParamsFromQuestion(q);

    if (params && params.intent === 'quote' && params.quantity) {
      // Ollama extraiu parâmetros de orçamento — calcula preço
      const quoteResponse = await generateQuoteFromParams(params);
      if (quoteResponse) {
        return NextResponse.json({
          answer: quoteResponse.answer,
          type: quoteResponse.type,
          data: quoteResponse.data,
          source: 'ollama',
        });
      }
    }

    if (params && params.intent === 'query') {
      // Ollama identificou como query — usa pattern matching local
      const result = processQuestion(q);
      return NextResponse.json({ ...result, source: 'ollama+local' });
    }

    // ===== TENTATIVA 2: PATTERN MATCHING LOCAL =====
    const result = processQuestion(q);
    return NextResponse.json({ ...result, source: params ? 'ollama-fallback' : 'local' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro no assistente.' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }
}

// GET — status do Ollama
export async function GET(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 },
    );
  }

  const status = await checkOllamaStatus();
  return NextResponse.json(status);
}

// ==========================================
// GERAÇÃO DE ORÇAMENTO A PARTIR DE PARÂMETROS
// ==========================================

async function generateQuoteFromParams(params: Awaited<ReturnType<typeof extractParamsFromQuestion>>): Promise<{ answer: string; type: string; data?: unknown } | null> {
  if (!params || !params.quantity) return null;

  const products = productData.getAll();
  const groups = groupData.getAll();
  const variables = variableData.getAll();

  // Tenta encontrar produto pelo nome
  let product = params.product
    ? products.find(p => p.name.toLowerCase().includes(params.product!.toLowerCase()))
    : products[0];

  if (!product) product = products[0];
  if (!product) return { answer: 'Nenhum produto cadastrado no sistema.', type: 'text' };

  // Tenta encontrar variáveis por material, cor, fechamento
  const productGroups = groups.filter(g => g.productId === product!.id);
  const productVariables = variables.filter(v => productGroups.some(g => g.id === v.groupId));

  const selectedVariables: { groupId: string; variableId: string; quantity: number }[] = [];
  const matchedNames: string[] = [];

  // Match por material
  if (params.material) {
    const match = productVariables.find(v =>
      v.name.toLowerCase().includes(params.material!.toLowerCase())
    );
    if (match) {
      selectedVariables.push({ groupId: match.groupId, variableId: match.id, quantity: params.quantity });
      matchedNames.push(match.name);
    }
  }

  // Match por cor
  if (params.color) {
    const match = productVariables.find(v =>
      v.name.toLowerCase().includes(params.color!.toLowerCase()) &&
      !selectedVariables.some(sv => sv.variableId === v.id)
    );
    if (match) {
      selectedVariables.push({ groupId: match.groupId, variableId: match.id, quantity: params.quantity });
      matchedNames.push(match.name);
    }
  }

  // Match por fechamento
  if (params.closure) {
    const match = productVariables.find(v =>
      v.name.toLowerCase().includes(params.closure!.toLowerCase()) &&
      !selectedVariables.some(sv => sv.variableId === v.id)
    );
    if (match) {
      selectedVariables.push({ groupId: match.groupId, variableId: match.id, quantity: params.quantity });
      matchedNames.push(match.name);
    }
  }

  // Se não encontrou nenhuma variável, pega a primeira de cada grupo
  if (selectedVariables.length === 0) {
    for (const group of productGroups) {
      const firstVar = variables.find(v => v.groupId === group.id);
      if (firstVar) {
        selectedVariables.push({ groupId: group.id, variableId: firstVar.id, quantity: params.quantity });
        matchedNames.push(firstVar.name);
      }
    }
  }

  // Monta input para o motor de preços
  const pricingInput: PricingInput = {
    productId: product.id,
    selectedVariables,
    quantity: params.quantity,
    logoColors: 1,
    dimensions: params.dimensions || undefined,
    printType: params.printType || undefined,
    printSize: (params.printSize as 'small' | 'medium' | 'large') || undefined,
    printPosition: (params.printPosition as 'front' | 'back' | 'both') || undefined,
  };

  const pricing = calculateItemPricing(pricingInput);

  // Monta resposta
  const lines: string[] = [];
  lines.push(`**Orçamento rápido — ${product.name}**`);
  lines.push('');
  lines.push(`📦 **${params.quantity} unidades**`);

  if (matchedNames.length > 0) {
    lines.push(`🎨 Variáveis: ${matchedNames.join(', ')}`);
  }

  if (params.dimensions) {
    lines.push(`📐 Dimensão: ${params.dimensions.width}×${params.dimensions.height}cm`);
  }

  if (params.printType) {
    const printLabel = params.printType === 'serigrafia' ? 'Serigrafia' :
      params.printType === 'sublimacao' ? 'Sublimação' : 'DTF';
    lines.push(`🖨️ Impressão: ${printLabel} (${params.printSize || 'medium'}, ${params.printPosition || 'frente'})`);
  }

  lines.push('');
  lines.push(`💰 **Preço unitário: R$ ${pricing.unitPrice.toFixed(2)}**`);
  lines.push(`💰 **Total: R$ ${pricing.totalPrice.toFixed(2)}**`);
  lines.push(`📊 Margem: R$ ${pricing.margin.toFixed(2)}`);
  lines.push('');
  lines.push(`_${pricing.breakdown}_`);
  lines.push('');
  lines.push('💡 Para criar um orçamento formal, acesse **Orçamentos → Novo orçamento**.');

  return {
    answer: lines.join('\n'),
    type: 'metric',
    data: {
      product: product.name,
      quantity: params.quantity,
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice,
      breakdown: pricing,
    },
  };
}
