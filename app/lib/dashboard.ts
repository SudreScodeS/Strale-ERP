import { productData, variableData, orderData, userData, quoteData } from './data';
import { getFinanceSummary, getStockAlertsByLevel, getOrcamentosStats } from './business';

export function getDashboardSummary() {
  const products = productData.getAll();
  const variables = variableData.getAll();
  const orders = orderData.getAll();
  const users = userData.getAll();
  const finance = getFinanceSummary();
  const stockAlerts = getStockAlertsByLevel();
  const quoteStats = getOrcamentosStats();
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
    quotesPending: quoteStats.draft + quoteStats.sent,
    quotesConverted: quoteStats.converted,
    quoteConversionRate: quoteStats.conversionRate,
  };
}
