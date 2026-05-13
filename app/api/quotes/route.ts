// app/api/quotes/route.ts
// API REST para gerenciamento de orçamentos
// Endpoints: GET (listar), POST (criar), PATCH (atualizar/clonar/converter), DELETE

import { NextResponse } from 'next/server';
import { Quote, QuoteItem } from '../../../types';
import { criarOrcamento, converterOrcamentoEmPedido, clonarOrcamento, atualizarStatusOrcamento } from '../../lib/business';
import { quoteData, userData } from '../../lib/data';
import { requireRole } from '../../lib/auth';

// ==========================================
// GET /api/quotes - LISTAR ORÇAMENTOS
// ==========================================

export async function GET(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    const quoteId = url.searchParams.get('id');

    // Buscar orçamento específico
    if (quoteId) {
      const quote = quoteData.getById(quoteId);
      if (!quote) {
        return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
      }
      // Seller só vê os próprios
      if (payload.role === 'seller' && quote.userId !== payload.userId) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
      }
      const creator = userData.getById(quote.userId);
      return NextResponse.json({ quote: { ...quote, createdByName: creator?.username || quote.userId } });
    }

    // Listar orçamentos
    let quotes = quoteData.getAll();

    // Filtra por role
    if (payload.role === 'seller') {
      quotes = quotes.filter(q => q.userId === payload.userId);
    }

    // Filtra por status se especificado
    if (statusFilter) {
      quotes = quotes.filter(q => q.status === statusFilter);
    }

    // Adiciona nome do criador
    const users = userData.getAll();
    const quotesWithCreator = quotes.map(q => ({
      ...q,
      createdByName: users.find(u => u.id === q.userId)?.username || q.userId,
    }));

    return NextResponse.json({ quotes: quotesWithCreator });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao listar orçamentos.' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }
}

// ==========================================
// POST /api/quotes - CRIAR ORÇAMENTO
// ==========================================

export async function POST(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const body = await request.json();

    const { customerName, name, items, logoColors, validDays, notes, deliveryDate } = body as {
      customerName?: string;
      name?: string;
      items: QuoteItem[];
      logoColors?: number;
      validDays?: number;
      notes?: string;
      deliveryDate?: string;
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Adicione pelo menos um item ao orçamento.' }, { status: 400 });
    }

    const quote = criarOrcamento(
      payload.userId,
      customerName || 'Cliente',
      name || `Orçamento ${new Date().toLocaleDateString('pt-BR')}`,
      items,
      logoColors || 0,
      validDays,
      notes,
      deliveryDate,
    );

    return NextResponse.json({ quote });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar orçamento.' },
      { status: 500 },
    );
  }
}

// ==========================================
// PATCH /api/quotes - ATUALIZAR/CLONAR/CONVERTER
// ==========================================

export async function PATCH(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const body = await request.json();

    const { quoteId, action, status, deliveryDate } = body as {
      quoteId: string;
      action?: 'clone' | 'convert' | 'update-status';
      status?: Quote['status'];
      deliveryDate?: string;
    };

    if (!quoteId) {
      return NextResponse.json({ error: 'ID do orçamento é obrigatório.' }, { status: 400 });
    }

    const quote = quoteData.getById(quoteId);
    if (!quote) {
      return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
    }

    // Verifica permissão
    if (payload.role === 'seller' && quote.userId !== payload.userId) {
      return NextResponse.json({ error: 'Você não pode modificar orçamentos de outros usuários.' }, { status: 403 });
    }

    // Clonar orçamento
    if (action === 'clone') {
      const result = clonarOrcamento(quoteId, payload.userId);
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ quote: result });
    }

    // Converter em pedido
    if (action === 'convert') {
      if (!deliveryDate) {
        return NextResponse.json({ error: 'A data de entrega é obrigatória para converter o orçamento em pedido.' }, { status: 400 });
      }
      const result = converterOrcamentoEmPedido(quoteId, payload.userId, deliveryDate);
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ order: result.order, invoice: result.invoice });
    }

    // Atualizar status
    if (action === 'update-status' && status) {
      const result = atualizarStatusOrcamento(quoteId, status);
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ quote: result });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar orçamento.' },
      { status: 500 },
    );
  }
}

// ==========================================
// DELETE /api/quotes - REMOVER ORÇAMENTO
// ==========================================

export async function DELETE(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const url = new URL(request.url);
    const quoteId = url.searchParams.get('quoteId');

    if (!quoteId) {
      return NextResponse.json({ error: 'ID do orçamento é obrigatório.' }, { status: 400 });
    }

    const quote = quoteData.getById(quoteId);
    if (!quote) {
      return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
    }

    if (payload.role === 'seller' && quote.userId !== payload.userId) {
      return NextResponse.json({ error: 'Você não pode remover orçamentos de outros usuários.' }, { status: 403 });
    }

    // Só permite remover rascunhos ou rejeitados
    if (quote.status !== 'draft' && quote.status !== 'rejected') {
      return NextResponse.json({ error: 'Apenas orçamentos em rascunho ou rejeitados podem ser removidos.' }, { status: 400 });
    }

    quoteData.delete(quoteId);
    return NextResponse.json({ message: 'Orçamento removido com sucesso.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover orçamento.' },
      { status: 500 },
    );
  }
}
