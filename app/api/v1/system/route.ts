// api/v1/system/route.ts
// V1 standardized system health endpoint.

import fs from 'fs';
import path from 'path';
import { productData, variableData, groupData, orderData } from '../../../lib/data';
import { getFinanceSummary, getStockAlertsByLevel } from '../../../lib/business';
import { getDemandForecastSummary } from '../../../lib/demand-forecast';
import { processQuestion } from '../../../lib/assistant';
import { ok, fromError } from '../../../lib/api-response';

interface ModuleCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

function checkDataFile(filename: string): ModuleCheck {
  const filePath = path.join(process.cwd(), 'data', filename);
  try {
    if (!fs.existsSync(filePath)) {
      return { name: filename, status: 'error', message: 'Arquivo não encontrado' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return { name: filename, status: 'ok', message: `${Array.isArray(data) ? data.length : 0} registros` };
  } catch (error) {
    return { name: filename, status: 'error', message: `Erro ao ler: ${error instanceof Error ? error.message : 'desconhecido'}` };
  }
}

export async function GET() {
  try {
    const checks: ModuleCheck[] = [];
    const startTime = Date.now();

    // Data files
    const dataFiles = ['products.json', 'variables.json', 'groups.json', 'orders.json', 'finance.json', 'users.json', 'suppliers.json', 'purchase-orders.json', 'invoices.json'];
    for (const file of dataFiles) {
      checks.push(checkDataFile(file));
    }

    // Data layer
    try {
      const products = productData.getAll();
      const variables = variableData.getAll();
      const orders = orderData.getAll();
      checks.push({ name: 'Data Layer', status: 'ok', message: `${products.length} produtos, ${variables.length} variáveis, ${orders.length} pedidos` });
    } catch (error) {
      checks.push({ name: 'Data Layer', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
    }

    // Finance
    try {
      const finance = getFinanceSummary();
      checks.push({ name: 'Financeiro', status: 'ok', message: `Vendas: R$ ${finance.totalSales.toFixed(2)}, Lucro: R$ ${finance.profit.toFixed(2)}` });
    } catch (error) {
      checks.push({ name: 'Financeiro', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
    }

    // Stock alerts
    try {
      const alerts = getStockAlertsByLevel();
      const status = alerts.critical.length > 0 ? 'warning' : 'ok';
      checks.push({ name: 'Estoque', status, message: `${alerts.critical.length} críticos, ${alerts.watch.length} em atenção` });
    } catch (error) {
      checks.push({ name: 'Estoque', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
    }

    // Demand forecast
    try {
      const forecast = getDemandForecastSummary();
      checks.push({ name: 'Previsão de Demanda', status: 'ok', message: `${forecast.totalVariablesAnalyzed} variáveis analisadas` });
    } catch (error) {
      checks.push({ name: 'Previsão de Demanda', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
    }

    // Assistant
    try {
      const response = processQuestion('ajuda');
      checks.push({ name: 'Assistente', status: response.answer.length > 0 ? 'ok' : 'warning', message: 'Motor de consultas funcional' });
    } catch (error) {
      checks.push({ name: 'Assistente', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
    }

    const errors = checks.filter((c) => c.status === 'error');
    const warnings = checks.filter((c) => c.status === 'warning');
    const overallStatus = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok';

    return ok({
      status: overallStatus,
      elapsedMs: Date.now() - startTime,
      summary: {
        total: checks.length,
        ok: checks.filter((c) => c.status === 'ok').length,
        warnings: warnings.length,
        errors: errors.length,
      },
      modules: checks,
    });
  } catch (error) {
    return fromError(error);
  }
}
