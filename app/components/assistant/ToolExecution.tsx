'use client';

// ── ToolExecution.tsx — Visual card showing tool execution status ─

interface ToolExecutionProps {
  tool: string;
  status: 'running' | 'success' | 'error';
  params?: Record<string, unknown>;
  result?: { success: boolean; message: string };
}

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  create_quote: { label: 'Criando orçamento', icon: 'doc' },
  update_order_status: { label: 'Atualizando pedido', icon: 'list' },
  create_product: { label: 'Criando produto', icon: 'pkg' },
  create_supplier: { label: 'Criando fornecedor', icon: 'factory' },
  generate_pdf_quote: { label: 'Gerando PDF', icon: 'file' },
  search_orders: { label: 'Buscando pedidos', icon: 'search' },
  search_quotes: { label: 'Buscando orçamentos', icon: 'search' },
  get_low_stock: { label: 'Verificando estoque', icon: 'chart' },
  get_financial_summary: { label: 'Consultando financeiro', icon: 'money' },
  get_sales_report: { label: 'Gerando relatório', icon: 'trend' },
  get_sales_summary: { label: 'Resumo de vendas', icon: 'chart' },
  get_stock_alerts: { label: 'Alertas de estoque', icon: 'alert' },
  get_recent_orders: { label: 'Pedidos recentes', icon: 'cart' },
  get_products: { label: 'Listando produtos', icon: 'pkg' },
  get_delivery_status: { label: 'Status de entregas', icon: 'truck' },
  get_quotes: { label: 'Consultando orçamentos', icon: 'list' },
  get_users: { label: 'Listando usuários', icon: 'users' },
  get_demand_forecast: { label: 'Previsão de demanda', icon: 'trend' },
  get_suppliers: { label: 'Listando fornecedores', icon: 'factory' },
  calculate_price: { label: 'Calculando preço', icon: 'dollar' },
  get_system_summary: { label: 'Resumo do sistema', icon: 'monitor' },
};

export function ToolExecution({ tool, status, result }: ToolExecutionProps) {
  const info = TOOL_LABELS[tool] || { label: tool, icon: 'tool' };

  const statusColors = {
    running: { bg: 'var(--info-bg)', border: 'var(--info-border)', text: 'var(--info)' },
    success: { bg: 'var(--success-bg)', border: 'var(--success-border)', text: 'var(--success)' },
    error: { bg: 'var(--danger-bg)', border: 'var(--danger-border)', text: 'var(--danger)' },
  };

  const colors = statusColors[status];

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs transition-all"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
      }}
    >
      <span className="flex-shrink-0 text-base">{info.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{info.label}</span>
          {status === 'running' && (
            <span className="flex gap-0.5">
              <span className="h-1 w-1 rounded-full animate-bounce" style={{ background: colors.text, animationDelay: '0ms' }} />
              <span className="h-1 w-1 rounded-full animate-bounce" style={{ background: colors.text, animationDelay: '150ms' }} />
              <span className="h-1 w-1 rounded-full animate-bounce" style={{ background: colors.text, animationDelay: '300ms' }} />
            </span>
          )}
          {status === 'success' && <span>✓</span>}
          {status === 'error' && <span>×</span>}
        </div>
        {result && !result.success && (
          <p className="mt-0.5 opacity-80 truncate">{result.message}</p>
        )}
      </div>
    </div>
  );
}
