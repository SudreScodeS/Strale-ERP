import { productData, variableData, orderData, userData } from './data';
import { getFinanceSummary, getStockAlertsByLevel } from './business';

export function getDashboardSummary() {
  const products = productData.getAll();
  const variables = variableData.getAll();
  const orders = orderData.getAll();
  const users = userData.getAll();
  const finance = getFinanceSummary();
  const stockAlerts = getStockAlertsByLevel();
  const recentOrders = orders
    .slice(-5)
    .reverse()
    .map((order) => ({
      ...order,
      createdByName: users.find((user) => user.id === order.userId)?.username || order.userId,
    }));

  return {
    productsCount: products.length,
    variablesCount: variables.length,
    ordersCount: orders.length,
    totalSales: finance.totalSales,
    profit: finance.profit,
    lowStockCount: stockAlerts.critical.length,
    watchStockCount: stockAlerts.watch.length,
    recentOrders,
  };
}
