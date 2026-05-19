// api/v1/quotes/route.ts
// V1 standardized quotes endpoint.

import { NextResponse } from 'next/server';
import { Quote, QuoteItem } from '../../../../types';
import { criarOrcamento, converterOrcamentoEmPedido, clonarOrcamento, atualizarStatusOrcamento } from '../../../../lib/business';
import { quoteData, userData, groupData, variableData } from '../../../../lib/data';
import { requireRole } from '../../../../lib/auth';
import { logActivity } from '../../../../lib/activity-logger';
import { ok, created, badRequest, forbidden, notFound, fromError, success } from '../../../../lib/api-response';

function enrichQuoteItems(items: QuoteItem[]): QuoteItem[] {
  const groups = groupData.getAll();
  const variables = variableData.getAll();
  return items.map(item => ({
    ...item,
    selectedVariables: item.selectedVariables.map(sv => {
      if (sv.variableName && sv.groupName) return sv;
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

// GET /api/v1/quotes
export async function GET(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    const quoteId = url.searchParams.get('id');

    if (quoteId) {
      const quote = quoteData.getById(quoteId);
      if (!quote) {
        return notFound('Orçamento não encontrado.');
      }
      if (payload.role === 'seller' && quote.userId !== payload.userId) {
        return forbidden('Acesso negado.');
      }
      const creator = userData.getById(quote.userId);
      return ok({ quote: { ...quote, items: enrichQuoteItems(quote.items), createdByName: creator?.username || quote.userId } });
    }

    let quotes = quoteData.getAll();

    if (payload.role === 'seller') {
      quotes = quotes.filter(q => q.userId === payload.userId);
    }

    if (statusFilter) {
      quotes = quotes.filter(q => q.status === statusFilter);
    }

    const users = userData.getAll();
    const quotesWithCreator = quotes.map(q => ({
      ...q,
      items: enrichQuoteItems(q.items),
      createdByName: users.find(u => u.id === q.userId)?.username || q.userId,
    }));

    return ok(quotesWithCreator);
  } catch (error) {
    return fromError(error);
  }
}

// POST /api/v1/quotes
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
      return badRequest('Adicione pelo menos um item ao orçamento.');
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
    return created(quote);
  } catch (error) {
    return fromError(error);
  }
}

// PATCH /api/v1/quotes
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
      return badRequest('ID do orçamento é obrigatório.');
    }

    const quote = quoteData.getById(quoteId);
    if (!quote) {
      return notFound('Orçamento não encontrado.');
    }

    if (payload.role === 'seller' && quote.userId !== payload.userId) {
      return forbidden('Você não pode modificar orçamentos de outros usuários.');
    }

    if (action === 'clone') {
      const result = clonarOrcamento(quoteId, payload.userId);
      if ('error' in result) {
        return badRequest(result.error);
      }
      return ok(result);
    }

    if (action === 'convert') {
      if (!deliveryDate) {
        return badRequest('A data de entrega é obrigatória para converter o orçamento em pedido.');
      }
      const result = converterOrcamentoEmPedido(quoteId, payload.userId, deliveryDate, name);
      if ('error' in result) {
        return badRequest(result.error);
      }
      const converter = userData.getById(payload.userId);
      logActivity(payload.userId, converter?.username || payload.userId, 'convert', 'quote', `Converteu orçamento "${quote.name}" em pedido #${result.order.id}`, quoteId, `Pedido: ${result.order.id}`);
      return ok({ order: result.order, invoice: result.invoice });
    }

    if (action === 'update-status' && status) {
      const result = atualizarStatusOrcamento(quoteId, status);
      if ('error' in result) {
        return badRequest(result.error);
      }
      const updater = userData.getById(payload.userId);
      logActivity(payload.userId, updater?.username || payload.userId, 'status_change', 'quote', `Alterou status do orçamento "${quote.name}" para ${status}`, quoteId);
      return ok(result);
    }

    return badRequest('Ação inválida.');
  } catch (error) {
    return fromError(error);
  }
}

// DELETE /api/v1/quotes
export async function DELETE(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const url = new URL(request.url);
    const quoteId = url.searchParams.get('quoteId');

    if (!quoteId) {
      return badRequest('ID do orçamento é obrigatório.');
    }

    const quote = quoteData.getById(quoteId);
    if (!quote) {
      return notFound('Orçamento não encontrado.');
    }

    if (payload.role === 'seller' && quote.userId !== payload.userId) {
      return forbidden('Você não pode remover orçamentos de outros usuários.');
    }

    if (quote.status !== 'draft' && quote.status !== 'rejected') {
      return badRequest('Apenas orçamentos em rascunho ou rejeitados podem ser removidos.');
    }

    quoteData.delete(quoteId);
    const deleter = userData.getById(payload.userId);
    logActivity(payload.userId, deleter?.username || payload.userId, 'delete', 'quote', `Removeu orçamento "${quote.name}"`, quoteId);
    return success('Orçamento removido com sucesso.');
  } catch (error) {
    return fromError(error);
  }
}
