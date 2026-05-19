// api/v1/reports/faturamento/route.ts
// V1 standardized faturamento report endpoint.

import { orderData, productData, variableData, groupData } from '../../../../lib/data';
import { requireRole } from '../../../../lib/auth';
import { ok, fromError } from '../../../../lib/api-response';

interface ProductRevenue {
  productId: string;
  productName: string;
  totalSales: number;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageMargin: number;
  productMargin: number;
}

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);

    const orders = orderData.getAll().filter(o => o.status === 'completed');
    const products = productData.getAll();

    const revenueMap = new Map<string, {
      salesOrders: Set<string>;
      totalQuantity: number;
      totalRevenue: number;
      totalCost: number;
    }>();

    for (const order of orders) {
      for (const item of order.items) {
        const existing = revenueMap.get(item.productId);
        const itemRevenue = item.unitPrice * item.quantity;
        const itemCost = item.unitCost * item.quantity;

        if (existing) {
          existing.salesOrders.add(order.id);
          existing.totalQuantity += item.quantity;
          existing.totalRevenue += itemRevenue;
          existing.totalCost += itemCost;
        } else {
          revenueMap.set(item.productId, {
            salesOrders: new Set([order.id]),
            totalQuantity: item.quantity,
            totalRevenue: itemRevenue,
            totalCost: itemCost,
          });
        }
      }
    }

    const result: ProductRevenue[] = products.map(product => {
      const data = revenueMap.get(product.id);
      const totalRevenue = data?.totalRevenue ?? 0;
      const totalCost = data?.totalCost ?? 0;
      const totalProfit = totalRevenue - totalCost;
      const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      return {
        productId: product.id,
        productName: product.name,
        totalSales: data?.salesOrders.size ?? 0,
        totalQuantity: data?.totalQuantity ?? 0,
        totalRevenue,
        totalCost,
        totalProfit,
        averageMargin,
        productMargin: product?.profitMargin ?? 20,
      };
    });

    return ok({ products: result });
  } catch (error) {
    return fromError(error);
  }
}
