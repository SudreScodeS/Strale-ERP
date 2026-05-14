// lib/finance.ts
// Regras de consulta para o módulo financeiro do ERP
// Permite separar lógica financeira das APIs e componentes de interface

import { financeData } from './data';

export function getFinancialRecords(fromDate?: string, toDate?: string) {
  let records = financeData.getAll();

  // Filter by date range if provided
  if (fromDate || toDate) {
    records = records.filter((item) => {
      const d = new Date(item.date);
      if (fromDate && d < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && d > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }

  const totalSales = records.filter((item) => item.type === 'sale').reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = records.filter((item) => item.type !== 'sale').reduce((sum, item) => sum + item.amount, 0);
  const profit = totalSales - totalExpenses;

  return { records, totalSales, totalExpenses, profit };
}
