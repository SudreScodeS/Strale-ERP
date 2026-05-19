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
import { logActivity } from '../../lib/activity-logger';

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
  const groupsWithSelection = new Set<string>();
  item.selectedVariables.forEach((selected) => {
    groupsWithSelection.add(selected.groupId);
  });

  for (const group of groups) {
    if (!groupsWithSelection.has(group.id)) {
      return {
        ok: false,
        message: `Selecione uma opção de ${group.name.toLowerCase()}.`,
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
    let orders = orderData.getAll();

    // Date range filtering
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    if (fromDate || toDate) {
      orders = orders.filter((order) => {
        const d = new Date(order.createdAt);
        if (fromDate && d < new Date(`${fromDate}T00:00:00`)) return false;
        if (toDate && d > new Date(`${toDate}T23:59:59`)) return false;
        return true;
      });
    }

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
      { message: error instanceof Error ? error.message : 'Unauthorized' },
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
    const { name, items, logoColors, deliveryDate } = body as { name?: string; items: OrderItem[]; logoColors: number; deliveryDate?: string };

    // VALIDAÇÃO BÁSICA DOS DADOS
    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'Dados do pedido inválidos.' }, { status: 400 });
    }

    if (!deliveryDate) {
      return NextResponse.json({ message: 'A data de entrega é obrigatória.' }, { status: 400 });
    }

    for (const item of items) {
      const validation = validateGroupQuantities(item);
      if (!validation.ok) {
        return NextResponse.json({ message: validation.message || 'Quantidades por grupo inválidas.' }, { status: 400 });
      }
    }

    const orderName = name?.trim() || `Pedido ${new Date().toLocaleString()}`;

    // PROCESSA PEDIDO COMPLETO (veja business.ts para detalhes)
    // Inclui: cálculos, financeiro, baixa de estoque, nota fiscal
    const { order, invoice } = finalizarPedido(payload.userId, orderName, items, logoColors, deliveryDate);
    const creator = userData.getById(payload.userId);
    logActivity(payload.userId, creator?.username || payload.userId, 'create', 'order', `Criou pedido "${orderName}"`, order.id, `Total: R$ ${order.totalPrice.toFixed(2)}`);

    return NextResponse.json({ order, invoice });
  } catch (error) {
    // Erro genérico - em produção, logar erro específico
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Erro ao finalizar pedido.' }, { status: 500 });
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
    const { orderId, action, status, editData, delivered, deliveryDate, restoreData } = body as {
      orderId?: string;
      action?: 'restore';
      status?: Order['status'];
      editData?: {
        name: string;
        items: OrderItem[];
        totalCost: number;
        totalPrice: number;
        logoCost: number;
      };
      delivered?: boolean;
      deliveryDate?: string;
      restoreData?: Order;
    };

    // MODO RESTAURAR: reinsere pedido deletado
    if (action === 'restore' && restoreData) {
      const existing = orderData.getAll().find((entry) => entry.id === restoreData.id);
      if (existing) {
        return NextResponse.json({ message: 'Pedido já existe.' }, { status: 409 });
      }
      orderData.create(restoreData);
      const restorer = userData.getById(payload.userId);
      logActivity(payload.userId, restorer?.username || payload.userId, 'restore', 'order', `Restaurou pedido "${restoreData.name}"`, restoreData.id);
      return NextResponse.json({ order: restoreData, message: 'Pedido restaurado com sucesso.' });
    }

    // VALIDAÇÃO DOS DADOS
    if (!orderId) {
      return NextResponse.json({ message: 'Dados de atualização inválidos.' }, { status: 400 });
    }

    // Verifica se pedido existe
    const order = orderData.getAll().find((entry) => entry.id === orderId);
    if (!order) {
      return NextResponse.json({ message: 'Pedido não encontrado.' }, { status: 404 });
    }

    if (payload.role === 'seller' && order.userId !== payload.userId) {
      return NextResponse.json({ message: 'Você não pode atualizar pedidos de outros usuários.' }, { status: 403 });
    }

    // MODO EDIÇÃO: atualiza nome, itens, custos e preço
    if (editData) {
      if (payload.role === 'seller') {
        return NextResponse.json({ message: 'Vendedor não pode editar pedidos.' }, { status: 403 });
      }

      if (!editData.name?.trim()) {
        return NextResponse.json({ message: 'Nome do pedido é obrigatório.' }, { status: 400 });
      }
      if (!editData.items || editData.items.length === 0) {
        return NextResponse.json({ message: 'O pedido deve ter pelo menos um item.' }, { status: 400 });
      }

      orderData.update(orderId, {
        name: editData.name,
        items: editData.items,
        totalCost: editData.totalCost,
        totalPrice: editData.totalPrice,
        logoCost: editData.logoCost,
      });

      // Atualiza registro financeiro se pedido estiver concluído
      const saleRecord = financeData.getAll().find((record) => record.type === 'sale' && record.orderId === orderId);
      if (saleRecord) {
        financeData.update(saleRecord.id, { amount: editData.totalPrice, description: `Pedido: ${editData.name}` });
      }

      const updated = orderData.getAll().find((entry) => entry.id === orderId);
      return NextResponse.json({ order: updated || { ...order, ...editData } });
    }

    // MODO ENTREGA: marcar como entregue ou atualizar data de entrega
    if (delivered !== undefined || deliveryDate !== undefined) {
      const updates: Partial<Order> = {};
      if (delivered !== undefined) {
        updates.delivered = delivered;
        updates.deliveredAt = delivered ? new Date().toISOString() : undefined;
      }
      if (deliveryDate !== undefined) {
        updates.deliveryDate = deliveryDate;
      }
      orderData.update(orderId, updates);
      const updated = orderData.getAll().find((entry) => entry.id === orderId);
      const actor = userData.getById(payload.userId);
      if (delivered !== undefined) {
        logActivity(
          payload.userId,
          actor?.username || payload.userId,
          delivered ? 'update' : 'update',
          'order',
          delivered ? `Marcou pedido "${order.name}" como entregue` : `Desfez entrega do pedido "${order.name}"`,
          orderId,
        );
      }
      return NextResponse.json({ order: updated || { ...order, ...updates } });
    }

    // MODO STATUS: atualiza status do pedido
    if (!status) {
      return NextResponse.json({ message: 'Dados de atualização inválidos.' }, { status: 400 });
    }

    // CONTROLE DE PERMISSÕES POR ROLE
    // Seller só pode cancelar pedidos (não pode alterar status para outros valores)
    if (payload.role === 'seller' && status !== 'cancelled') {
      return NextResponse.json({ message: 'Vendedor só pode cancelar pedidos.' }, { status: 403 });
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
    const updater = userData.getById(payload.userId);
    logActivity(payload.userId, updater?.username || payload.userId, 'status_change', 'order', `Alterou status do pedido "${order.name}" para ${status}`, order.id);
    return NextResponse.json({ order: { ...order, status } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Erro interno ao atualizar pedido.' },
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
      return NextResponse.json({ message: 'orderId é obrigatório.' }, { status: 400 });
    }

    const order = orderData.getAll().find((entry) => entry.id === orderId);
    if (!order) {
      return NextResponse.json({ message: 'Pedido não encontrado.' }, { status: 404 });
    }

    if (payload.role === 'seller' && order.userId !== payload.userId) {
      return NextResponse.json({ message: 'Você não pode remover pedidos de outros usuários.' }, { status: 403 });
    }

    if (order.status !== 'cancelled') {
      return NextResponse.json({ message: 'Somente pedidos cancelados podem ser removidos.' }, { status: 400 });
    }

    orderData.delete(orderId);
    const deleter = userData.getById(payload.userId);
    logActivity(payload.userId, deleter?.username || payload.userId, 'delete', 'order', `Removeu pedido "${order.name}"`, orderId);

    const saleRecord = financeData.getAll().find((record) => record.type === 'sale' && record.orderId === orderId);
    if (saleRecord) {
      financeData.delete(saleRecord.id);
    }

    return NextResponse.json({ message: 'Pedido cancelado removido com sucesso.' });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Erro ao remover pedido.' },
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
