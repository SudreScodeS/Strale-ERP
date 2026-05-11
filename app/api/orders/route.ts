// app/api/orders/route.ts
// API REST para gerenciamento de pedidos de venda
// Endpoints: GET (listar), POST (criar), PATCH (atualizar status)
// Controle de acesso: Admin vê todos, Seller vê apenas os próprios

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderItem } from '../../../types';
import { finalizarPedido } from '../../lib/business';
import { financeData, groupData, orderData, userData, variableData } from '../../lib/data';
import { requireRole } from '../../lib/auth';

function getUsedQuantity(variable: { quantity: number }, fallback: number): number {
  return Math.max(0, Number(variable.quantity || fallback));
}

function hasEnoughStock(order: Order): { ok: boolean; missingVariableId?: string; needed?: number; available?: number } {
  const allVariables = variableData.getAll();
  for (const item of order.items) {
    for (const selected of item.selectedVariables) {
      const variable = allVariables.find((entry) => entry.id === selected.variableId);
      if (!variable) {
        return { ok: false, missingVariableId: selected.variableId, needed: getUsedQuantity(selected, item.quantity), available: 0 };
      }
      const needed = getUsedQuantity(selected, item.quantity);
      if (variable.stock < needed) {
        return { ok: false, missingVariableId: selected.variableId, needed, available: variable.stock };
      }
    }
  }
  return { ok: true };
}

function applyStock(order: Order, direction: 'decrease' | 'increase') {
  const allVariables = variableData.getAll();
  for (const item of order.items) {
    for (const selected of item.selectedVariables) {
      const variable = allVariables.find((entry) => entry.id === selected.variableId);
      if (!variable) continue;
      const used = getUsedQuantity(selected, item.quantity);
      const nextStock = direction === 'decrease'
        ? Math.max(0, variable.stock - used)
        : variable.stock + used;
      variableData.updateStock(variable.id, nextStock);
      variable.stock = nextStock;
    }
  }
}

function validateGroupQuantities(item: OrderItem): { ok: boolean; message?: string } {
  const groups = groupData.getByProductId(item.productId);
  const groupsWithSelection = new Map<string, number>();
  item.selectedVariables.forEach((selected) => {
    const current = groupsWithSelection.get(selected.groupId) || 0;
    groupsWithSelection.set(selected.groupId, current + getUsedQuantity(selected, item.quantity));
  });

  for (const group of groups) {
    const totalForGroup = groupsWithSelection.get(group.id) || 0;
    if (totalForGroup !== item.quantity) {
      return {
        ok: false,
        message: `No grupo "${group.name}", a soma das variáveis (${totalForGroup}) deve ser igual à quantidade do produto (${item.quantity}).`,
      };
    }
  }

  return { ok: true };
}

// ==========================================
// GET /api/orders - LISTAR PEDIDOS
// ==========================================

// LISTA PEDIDOS COM CONTROLE DE ACESSO POR ROLE
// Admin: vê todos os pedidos do sistema
// Seller: vê apenas pedidos que ele mesmo criou
// Usado em: Dashboard de vendas, histórico de pedidos
export async function GET(request: Request) {
  try {
    // Verifica autenticação e role (admin ou seller)
    const payload = requireRole(request, ['admin', 'seller']);

    // Busca todos os pedidos
    const orders = orderData.getAll();

    // Filtra baseado na role do usuário
    const visibleOrders = payload.role === 'admin'
      ? orders // Admin vê tudo
      : orders.filter((order) => order.userId === payload.userId); // Seller vê apenas os próprios

    const users = userData.getAll();
    const ordersWithCreator = visibleOrders.map((order) => ({
      ...order,
      createdByName: users.find((user) => user.id === order.userId)?.username || order.userId,
    }));

    return NextResponse.json({ orders: ordersWithCreator });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }
}

// ==========================================
// POST /api/orders - CRIAR NOVO PEDIDO
// ==========================================

// CRIA E FINALIZA NOVO PEDIDO DE VENDA
// Processo completo: validação, cálculo de preços, baixa de estoque, financeiro, nota fiscal
// Usado quando cliente finaliza compra no sistema
export async function POST(request: Request) {
  try {
    // Verifica autenticação (admin ou seller podem criar pedidos)
    const payload = requireRole(request, ['admin', 'seller']);

    // Extrai dados do corpo da requisição
    const body = await request.json();
    const { name, items, logoColors } = body as { name?: string; items: OrderItem[]; logoColors: number };

    // VALIDAÇÃO BÁSICA DOS DADOS
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Dados do pedido inválidos.' }, { status: 400 });
    }

    for (const item of items) {
      const validation = validateGroupQuantities(item);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.message || 'Quantidades por grupo inválidas.' }, { status: 400 });
      }
    }

    const orderName = name?.trim() || `Pedido ${new Date().toLocaleString()}`;

    // PROCESSA PEDIDO COMPLETO (veja business.ts para detalhes)
    // Inclui: cálculos, financeiro, baixa de estoque, nota fiscal
    const { order, invoice } = finalizarPedido(payload.userId, orderName, items, logoColors);

    return NextResponse.json({ order, invoice });
  } catch (error) {
    // Erro genérico - em produção, logar erro específico
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao finalizar pedido.' }, { status: 500 });
  }
}

// ==========================================
// PATCH /api/orders - ATUALIZAR STATUS DO PEDIDO
// ==========================================

// ATUALIZA STATUS DE PEDIDO EXISTENTE
// Controle de permissões: Seller só pode cancelar, Admin pode alterar qualquer status
// Usado para: cancelamentos, mudanças de status operacional
export async function PATCH(request: Request) {
  try {
    // Verifica autenticação
    const payload = requireRole(request, ['admin', 'seller']);

    // Extrai dados da atualização
    const body = await request.json();
    const { orderId, status } = body as { orderId: string; status: Order['status'] };

    // VALIDAÇÃO DOS DADOS
    if (!orderId || !status) {
      return NextResponse.json({ error: 'Dados de atualização inválidos.' }, { status: 400 });
    }

    // CONTROLE DE PERMISSÕES POR ROLE
    // Seller só pode cancelar pedidos (não pode alterar status para outros valores)
    if (payload.role === 'seller' && status !== 'cancelled') {
      return NextResponse.json({ error: 'Vendedor só pode cancelar pedidos.' }, { status: 403 });
    }

    // Verifica se pedido existe
    const order = orderData.getAll().find((entry) => entry.id === orderId);
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }

    if (payload.role === 'seller' && order.userId !== payload.userId) {
      return NextResponse.json({ error: 'Você não pode atualizar pedidos de outros usuários.' }, { status: 403 });
    }

    const previousStatus = order.status;
    const saleRecord = financeData.getAll().find((record) => record.type === 'sale' && record.orderId === orderId);

    if (previousStatus !== status) {
      if (previousStatus === 'completed' && status !== 'completed') {
        applyStock(order, 'increase');
      }

      if (previousStatus !== 'completed' && status === 'completed') {
        const stockCheck = hasEnoughStock(order);
        if (!stockCheck.ok) {
          return NextResponse.json(
            {
              error: `Estoque insuficiente para reativar pedido. Variável: ${stockCheck.missingVariableId}. Necessário: ${stockCheck.needed}. Disponível: ${stockCheck.available}.`,
            },
            { status: 409 },
          );
        }
        applyStock(order, 'decrease');
      }
    }

    // Atualiza status no banco de dados
    orderData.update(orderId, { status });

    // Mantém financeiro sincronizado com status do pedido:
    // só existe receita enquanto pedido está "completed".
    if (previousStatus !== status) {
      if (status === 'completed' && !saleRecord) {
        financeData.create({
          id: uuidv4(),
          type: 'sale',
          amount: order.totalPrice,
          description: `Pedido: ${order.name}`,
          date: new Date(),
          orderId: order.id,
        });
      }

      if (status !== 'completed' && saleRecord) {
        financeData.delete(saleRecord.id);
      }
    }

    // Retorna pedido atualizado
    return NextResponse.json({ order: { ...order, status } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao atualizar pedido.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ error: 'orderId é obrigatório.' }, { status: 400 });
    }

    const order = orderData.getAll().find((entry) => entry.id === orderId);
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }

    if (payload.role === 'seller' && order.userId !== payload.userId) {
      return NextResponse.json({ error: 'Você não pode remover pedidos de outros usuários.' }, { status: 403 });
    }

    if (order.status !== 'cancelled') {
      return NextResponse.json({ error: 'Somente pedidos cancelados podem ser removidos.' }, { status: 400 });
    }

    orderData.delete(orderId);

    const saleRecord = financeData.getAll().find((record) => record.type === 'sale' && record.orderId === orderId);
    if (saleRecord) {
      financeData.delete(saleRecord.id);
    }

    return NextResponse.json({ message: 'Pedido cancelado removido com sucesso.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover pedido.' },
      { status: 500 },
    );
  }
}

// ==========================================
// NOTAS DE API E SEGURANÇA
// ==========================================

// PADRÃO DE RESPOSTAS:
// - 200: Sucesso com dados
// - 400: Dados inválidos (ex: campos obrigatórios faltando)
// - 403: Permissão negada (ex: seller tentando alterar status não permitido)
// - 404: Recurso não encontrado (ex: pedido não existe)
// - 500: Erro interno do servidor

// MELHORIAS FUTURAS:
// 1. Validação mais robusta dos dados de entrada (schema validation)
// 2. Paginação para listagem de pedidos (GET)
// 3. Filtros avançados (por data, status, cliente)
// 4. Logs de auditoria para mudanças de status
// 5. Notificações em tempo real para status updates
// 6. Rate limiting para prevenir abuso de API
