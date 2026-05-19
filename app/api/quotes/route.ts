// app/api/quotes/route.ts
// API REST para gerenciamento de orçamentos
// Endpoints: GET (listar), POST (criar), PATCH (atualizar/clonar/converter), DELETE

import { NextResponse } from 'next/server';
import { Quote, QuoteItem } from '../../../types';
import { criarOrcamento, converterOrcamentoEmPedido, clonarOrcamento, atualizarStatusOrcamento } from '../../lib/business';
import { quoteData, userData, groupData, variableData } from '../../lib/data';
import { requireRole } from '../../lib/auth';
import { logActivity } from '../../lib/activity-logger';

// Enriquece itens do orçamento com nomes de grupos e variáveis
function enrichQuoteItems(items: QuoteItem[]): QuoteItem[] {
  const groups = groupData.getAll();
  const variables = variableData.getAll();
  return items.map(item => ({
    ...item,
    selectedVariables: item.selectedVariables.map(sv => {
      if (sv.variableName && sv.groupName) return sv; // já enriquecido
      const group = groups.find(g => g.id === sv.groupId);
      const variable = variables.find(v => v.id === sv.variableId);
      return {
        ...sv,
        groupName: sv.groupName || group?.name || sv.groupId,
        variableName: sv.variableName || variable?.name || sv.variableId,
      };
    }),
  }));
}

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
        return NextResponse.json({ message: 'Orçamento não encontrado.' }, { status: 404 });
      }
      // Seller só vê os próprios
      if (payload.role === 'seller' && quote.userId !== payload.userId) {
        return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
      }
      const creator = userData.getById(quote.userId);
      return NextResponse.json({ quote: { ...quote, items: enrichQuoteItems(quote.items), createdByName: creator?.username || quote.userId } });
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
      items: enrichQuoteItems(q.items),
      createdByName: users.find(u => u.id === q.userId)?.username || q.userId,
    }));

    return NextResponse.json({ quotes: quotesWithCreator });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Erro ao listar orçamentos.' },
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
      return NextResponse.json({ message: 'Adicione pelo menos um item ao orçamento.' }, { status: 400 });
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

    const creator = userData.getById(payload.userId);
    logActivity(payload.userId, creator?.username || payload.userId, 'create', 'quote', `Criou orçamento "${name}"`, quote.id, `Cliente: ${customerName}`);
    return NextResponse.json({ quote });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Erro ao criar orçamento.' },
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

    const { quoteId, action, status, deliveryDate, name } = body as {
      quoteId: string;
      action?: 'clone' | 'convert' | 'update-status';
      status?: Quote['status'];
      deliveryDate?: string;
      name?: string;
    };

    if (!quoteId) {
      return NextResponse.json({ message: 'ID do orçamento é obrigatório.' }, { status: 400 });
    }

    const quote = quoteData.getById(quoteId);
    if (!quote) {
      return NextResponse.json({ message: 'Orçamento não encontrado.' }, { status: 404 });
    }

    // Verifica permissão
    if (payload.role === 'seller' && quote.userId !== payload.userId) {
      return NextResponse.json({ message: 'Você não pode modificar orçamentos de outros usuários.' }, { status: 403 });
    }

    // Clonar orçamento
    if (action === 'clone') {
      const result = clonarOrcamento(quoteId, payload.userId);
      if ('error' in result) {
        return NextResponse.json({ message: result.error }, { status: 400 });
      }
      return NextResponse.json({ quote: result });
    }

    // Converter em pedido
    if (action === 'convert') {
      if (!deliveryDate) {
        return NextResponse.json({ message: 'A data de entrega é obrigatória para converter o orçamento em pedido.' }, { status: 400 });
      }
      const result = converterOrcamentoEmPedido(quoteId, payload.userId, deliveryDate, name);
      if ('error' in result) {
        return NextResponse.json({ message: result.error }, { status: 400 });
      }
      const converter = userData.getById(payload.userId);
      logActivity(payload.userId, converter?.username || payload.userId, 'convert', 'quote', `Converteu orçamento "${quote.name}" em pedido #${result.order.id}`, quoteId, `Pedido: ${result.order.id}`);
      return NextResponse.json({ order: result.order, invoice: result.invoice });
    }

    // Atualizar status
    if (action === 'update-status' && status) {
      const result = atualizarStatusOrcamento(quoteId, status);
      if ('error' in result) {
        return NextResponse.json({ message: result.error }, { status: 400 });
      }
      const updater = userData.getById(payload.userId);
      logActivity(payload.userId, updater?.username || payload.userId, 'status_change', 'quote', `Alterou status do orçamento "${quote.name}" para ${status}`, quoteId);
      return NextResponse.json({ quote: result });
    }

    return NextResponse.json({ message: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Erro ao atualizar orçamento.' },
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
      return NextResponse.json({ message: 'ID do orçamento é obrigatório.' }, { status: 400 });
    }

    const quote = quoteData.getById(quoteId);
    if (!quote) {
      return NextResponse.json({ message: 'Orçamento não encontrado.' }, { status: 404 });
    }

    if (payload.role === 'seller' && quote.userId !== payload.userId) {
      return NextResponse.json({ message: 'Você não pode remover orçamentos de outros usuários.' }, { status: 403 });
    }

    // Só permite remover rascunhos ou rejeitados
    if (quote.status !== 'draft' && quote.status !== 'rejected') {
      return NextResponse.json({ message: 'Apenas orçamentos em rascunho ou rejeitados podem ser removidos.' }, { status: 400 });
    }

    quoteData.delete(quoteId);
    const deleter = userData.getById(payload.userId);
    logActivity(payload.userId, deleter?.username || payload.userId, 'delete', 'quote', `Removeu orçamento "${quote.name}"`, quoteId);
    return NextResponse.json({ message: 'Orçamento removido com sucesso.' });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Erro ao remover orçamento.' },
      { status: 500 },
    );
  }
}
