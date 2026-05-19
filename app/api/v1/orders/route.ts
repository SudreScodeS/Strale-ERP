// api/v1/orders/route.ts
// V1 standardized orders endpoint.

import { v4 as uuidv4 } from 'uuid';
import { Order, OrderItem } from '../../../../types';
import { finalizarPedido } from '../../../lib/business';
import { financeData, groupData, orderData, userData, variableData } from '../../../lib/data';
import { requireRole } from '../../../lib/auth';
import { logActivity } from '../../../lib/activity-logger';
import { ok, created, badRequest, forbidden, notFound, conflict, fromError } from '../../../lib/api-response';

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
      return { ok: false, message: `Selecione uma opção de ${group.name.toLowerCase()}.` };
    }
  }
  return { ok: true };
}

export async function GET(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    let orders = orderData.getAll();

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

    const visibleOrders = payload.role === 'admin'
      ? orders
      : orders.filter((order) => order.userId === payload.userId);

    const users = userData.getAll();
    const ordersWithCreator = visibleOrders.map((order) => ({
      ...order,
      createdByName: users.find((user) => user.id === order.userId)?.username || order.userId,
    }));

    return ok({ orders: ordersWithCreator });
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const body = await request.json();
    const { name, items, logoColors, deliveryDate } = body as { name?: string; items: OrderItem[]; logoColors: number; deliveryDate?: string };

    if (!items || items.length === 0) {
      return badRequest('Dados do pedido inválidos.');
    }

    if (!deliveryDate) {
      return badRequest('A data de entrega é obrigatória.');
    }

    for (const item of items) {
      const validation = validateGroupQuantities(item);
      if (!validation.ok) {
        return badRequest(validation.message || 'Quantidades por grupo inválidas.');
      }
    }

    const orderName = name?.trim() || `Pedido ${new Date().toLocaleString()}`;
    const { order, invoice } = finalizarPedido(payload.userId, orderName, items, logoColors, deliveryDate);
    const creator = userData.getById(payload.userId);
    logActivity(payload.userId, creator?.username || payload.userId, 'create', 'order', `Criou pedido "${orderName}"`, order.id, `Total: R$ ${order.totalPrice.toFixed(2)}`);

    return created({ order, invoice }, 'Pedido criado com sucesso.');
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const body = await request.json();
    const { orderId, action, status, editData, delivered, deliveryDate, restoreData } = body as {
      orderId?: string;
      action?: 'restore';
      status?: Order['status'];
      editData?: { name: string; items: OrderItem[]; totalCost: number; totalPrice: number; logoCost: number };
      delivered?: boolean;
      deliveryDate?: string;
      restoreData?: Order;
    };

    if (action === 'restore' && restoreData) {
      const existing = orderData.getAll().find((entry) => entry.id === restoreData.id);
      if (existing) return conflict('Pedido já existe.');
      orderData.create(restoreData);
      const restorer = userData.getById(payload.userId);
      logActivity(payload.userId, restorer?.username || payload.userId, 'restore', 'order', `Restaurou pedido "${restoreData.name}"`, restoreData.id);
      return ok({ order: restoreData }, 'Pedido restaurado com sucesso.');
    }

    if (!orderId) return badRequest('Dados de atualização inválidos.');

    const order = orderData.getAll().find((entry) => entry.id === orderId);
    if (!order) return notFound('Pedido não encontrado.');

    if (payload.role === 'seller' && order.userId !== payload.userId) {
      return forbidden('Você não pode atualizar pedidos de outros usuários.');
    }

    if (editData) {
      if (payload.role === 'seller') return forbidden('Vendedor não pode editar pedidos.');
      if (!editData.name?.trim()) return badRequest('Nome do pedido é obrigatório.');
      if (!editData.items || editData.items.length === 0) return badRequest('O pedido deve ter pelo menos um item.');

      orderData.update(orderId, { name: editData.name, items: editData.items, totalCost: editData.totalCost, totalPrice: editData.totalPrice, logoCost: editData.logoCost });
      const saleRecord = financeData.getAll().find((record) => record.type === 'sale' && record.orderId === orderId);
      if (saleRecord) financeData.update(saleRecord.id, { amount: editData.totalPrice, description: `Pedido: ${editData.name}` });
      const updated = orderData.getAll().find((entry) => entry.id === orderId);
      return ok({ order: updated || { ...order, ...editData } });
    }

    if (delivered !== undefined || deliveryDate !== undefined) {
      const updates: Partial<Order> = {};
      if (delivered !== undefined) {
        updates.delivered = delivered;
        updates.deliveredAt = delivered ? new Date().toISOString() : undefined;
      }
      if (deliveryDate !== undefined) updates.deliveryDate = deliveryDate;
      orderData.update(orderId, updates);
      const updated = orderData.getAll().find((entry) => entry.id === orderId);
      const actor = userData.getById(payload.userId);
      if (delivered !== undefined) {
        logActivity(payload.userId, actor?.username || payload.userId, 'update', 'order', delivered ? `Marcou pedido "${order.name}" como entregue` : `Desfez entrega do pedido "${order.name}"`, orderId);
      }
      return ok({ order: updated || { ...order, ...updates } });
    }

    if (!status) return badRequest('Dados de atualização inválidos.');
    if (payload.role === 'seller' && status !== 'cancelled') return forbidden('Vendedor só pode cancelar pedidos.');

    const previousStatus = order.status;
    const saleRecord = financeData.getAll().find((record) => record.type === 'sale' && record.orderId === orderId);

    if (previousStatus !== status) {
      if (previousStatus === 'completed' && status !== 'completed') applyStock(order, 'increase');
      if (previousStatus !== 'completed' && status === 'completed') {
        const stockCheck = hasEnoughStock(order);
        if (!stockCheck.ok) {
          return conflict(`Estoque insuficiente. Variável: ${stockCheck.missingVariableId}. Necessário: ${stockCheck.needed}. Disponível: ${stockCheck.available}.`);
        }
        applyStock(order, 'decrease');
      }
    }

    orderData.update(orderId, { status });

    if (previousStatus !== status) {
      if (status === 'completed' && !saleRecord) {
        financeData.create({ id: uuidv4(), type: 'sale', amount: order.totalPrice, description: `Pedido: ${order.name}`, date: new Date(), orderId: order.id });
      }
      if (status !== 'completed' && saleRecord) financeData.delete(saleRecord.id);
    }

    const updater = userData.getById(payload.userId);
    logActivity(payload.userId, updater?.username || payload.userId, 'status_change', 'order', `Alterou status do pedido "${order.name}" para ${status}`, order.id);
    return ok({ order: { ...order, status } });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = requireRole(request, ['admin', 'seller']);
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    if (!orderId) return badRequest('orderId é obrigatório.');

    const order = orderData.getAll().find((entry) => entry.id === orderId);
    if (!order) return notFound('Pedido não encontrado.');
    if (payload.role === 'seller' && order.userId !== payload.userId) return forbidden('Você não pode remover pedidos de outros usuários.');
    if (order.status !== 'cancelled') return badRequest('Somente pedidos cancelados podem ser removidos.');

    orderData.delete(orderId);
    const deleter = userData.getById(payload.userId);
    logActivity(payload.userId, deleter?.username || payload.userId, 'delete', 'order', `Removeu pedido "${order.name}"`, orderId);

    const saleRecord = financeData.getAll().find((record) => record.type === 'sale' && record.orderId === orderId);
    if (saleRecord) financeData.delete(saleRecord.id);

    return ok({ message: 'Pedido cancelado removido com sucesso.' });
  } catch (error) {
    return fromError(error);
  }
}
