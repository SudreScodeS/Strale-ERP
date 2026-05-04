// app/api/system/route.ts
// Endpoint de saúde do sistema — verifica integridade de todos os módulos
// GET /api/system → status completo de todos os componentes locais

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { productData, variableData, groupData, orderData, financeData, userData, supplierData, purchaseOrderData, fraudLogData } from '../../lib/data';
import { getFinanceSummary, getStockAlertsByLevel } from '../../lib/business';
import { getDemandForecastSummary } from '../../lib/demand-forecast';
import { getFraudSummary } from '../../lib/fraud-detection';
import { processQuestion } from '../../lib/assistant';

interface ModuleCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  data?: unknown;
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
  const checks: ModuleCheck[] = [];
  const startTime = Date.now();

  // 1. Verificar arquivos de dados
  const dataFiles = ['products.json', 'variables.json', 'groups.json', 'orders.json', 'finance.json', 'users.json', 'suppliers.json', 'purchase-orders.json', 'invoices.json', 'fraud-logs.json'];
  for (const file of dataFiles) {
    checks.push(checkDataFile(file));
  }

  // 2. Verificar módulo de dados
  try {
    const products = productData.getAll();
    const variables = variableData.getAll();
    const orders = orderData.getAll();
    checks.push({ name: 'Data Layer', status: 'ok', message: `${products.length} produtos, ${variables.length} variáveis, ${orders.length} pedidos` });
  } catch (error) {
    checks.push({ name: 'Data Layer', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
  }

  // 3. Verificar módulo financeiro
  try {
    const finance = getFinanceSummary();
    checks.push({ name: 'Financeiro', status: 'ok', message: `Vendas: R$ ${finance.totalSales.toFixed(2)}, Lucro: R$ ${finance.profit.toFixed(2)}` });
  } catch (error) {
    checks.push({ name: 'Financeiro', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
  }

  // 4. Verificar alertas de estoque
  try {
    const alerts = getStockAlertsByLevel();
    const status = alerts.critical.length > 0 ? 'warning' : 'ok';
    checks.push({ name: 'Estoque', status, message: `${alerts.critical.length} críticos, ${alerts.watch.length} em atenção` });
  } catch (error) {
    checks.push({ name: 'Estoque', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
  }

  // 5. Verificar previsão de demanda
  try {
    const forecast = getDemandForecastSummary();
    checks.push({ name: 'Previsão de Demanda', status: 'ok', message: `${forecast.totalVariablesAnalyzed} variáveis analisadas, ${forecast.criticalRisk.length} riscos` });
  } catch (error) {
    checks.push({ name: 'Previsão de Demanda', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
  }

  // 6. Verificar detecção de fraude
  try {
    const fraud = getFraudSummary();
    checks.push({ name: 'Detecção de Fraude', status: 'ok', message: `${fraud.totalAnalyzed} analisados, ${fraud.flaggedTotal} sinalizados` });
  } catch (error) {
    checks.push({ name: 'Detecção de Fraude', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
  }

  // 7. Verificar assistente
  try {
    const response = processQuestion('ajuda');
    const status = response.answer.length > 0 ? 'ok' : 'warning';
    checks.push({ name: 'Assistente', status, message: 'Motor de consultas funcional' });
  } catch (error) {
    checks.push({ name: 'Assistente', status: 'error', message: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` });
  }

  // 8. Verificar sharp (análise de imagem)
  try {
    await import('sharp');
    checks.push({ name: 'Análise de Imagem (sharp)', status: 'ok', message: 'Biblioteca disponível' });
  } catch {
    checks.push({ name: 'Análise de Imagem (sharp)', status: 'warning', message: 'sharp não disponível — análise de logo pode não funcionar' });
  }

  // Resumo geral
  const errors = checks.filter(c => c.status === 'error');
  const warnings = checks.filter(c => c.status === 'warning');
  const overallStatus = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok';

  const elapsed = Date.now() - startTime;

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    elapsedMs: elapsed,
    summary: {
      total: checks.length,
      ok: checks.filter(c => c.status === 'ok').length,
      warnings: warnings.length,
      errors: errors.length,
    },
    modules: checks,
    config: {
      externalDependencies: {
        googleVision: !!process.env.GOOGLE_VISION_API_KEY || !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      },
      note: 'Sistema 100% funcional sem dependências externas. Google Vision é opcional.',
    },
  });
}
