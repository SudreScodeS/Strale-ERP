// lib/finance.ts
// Regras de consulta para o módulo financeiro do ERP
// Permite separar lógica financeira das APIs e componentes de interface

import { financeData } from './data';

export function getFinancialRecords() {
  const records = financeData.getAll();
  const totalSales = records.filter((item) => item.type === 'sale').reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = records.filter((item) => item.type !== 'sale').reduce((sum, item) => sum + item.amount, 0);
  const profit = totalSales - totalExpenses;

  return { records, totalSales, totalExpenses, profit };
}
