// types/dashboard.types.ts
// Dashboard domain: summary data and metric definitions.

/** Order as shown on the dashboard (simplified) */
export interface DashboardOrder {
  id: string;
  name: string;
  totalPrice: number;
  status: string;
  createdByName: string;
  createdAt: string;
}

/** Aggregated dashboard metrics */
export interface DashboardSummary {
  productsCount: number;
  variablesCount: number;
  ordersCount: number;
  totalSales: number;
  profit: number;
  lowStockCount: number;
  watchStockCount: number;
  recentOrders: DashboardOrder[];
  quotesPending?: number;
  quotesConverted?: number;
  quoteConversionRate?: number;
}
