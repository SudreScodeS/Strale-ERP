'use client';

// ── ToolExecution.tsx — Visual card showing tool execution status ─

interface ToolExecutionProps {
  tool: string;
  status: 'running' | 'success' | 'error';
  params?: Record<string, unknown>;
  result?: { success: boolean; message: string };
}

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  create_quote: { label: 'Criando orçamento', icon: '📝' },
  update_order_status: { label: 'Atualizando pedido', icon: '📋' },
  create_product: { label: 'Criando produto', icon: '📦' },
  create_supplier: { label: 'Criando fornecedor', icon: '🏭' },
  generate_pdf_quote: { label: 'Gerando PDF', icon: '📄' },
  search_orders: { label: 'Buscando pedidos', icon: '🔍' },
  search_quotes: { label: 'Buscando orçamentos', icon: '🔍' },
  get_low_stock: { label: 'Verificando estoque', icon: '📊' },
  get_financial_summary: { label: 'Consultando financeiro', icon: '💰' },
  get_sales_report: { label: 'Gerando relatório', icon: '📈' },
  get_sales_summary: { label: 'Resumo de vendas', icon: '📊' },
  get_stock_alerts: { label: 'Alertas de estoque', icon: '⚠️' },
  get_recent_orders: { label: 'Pedidos recentes', icon: '🛒' },
  get_products: { label: 'Listando produtos', icon: '📦' },
  get_delivery_status: { label: 'Status de entregas', icon: '🚚' },
  get_quotes: { label: 'Consultando orçamentos', icon: '📋' },
  get_users: { label: 'Listando usuários', icon: '👥' },
  get_demand_forecast: { label: 'Previsão de demanda', icon: '📈' },
  get_suppliers: { label: 'Listando fornecedores', icon: '🏭' },
  calculate_price: { label: 'Calculando preço', icon: '💲' },
  get_system_summary: { label: 'Resumo do sistema', icon: '🖥️' },
};

export function ToolExecution({ tool, status, result }: ToolExecutionProps) {
  const info = TOOL_LABELS[tool] || { label: tool, icon: '🔧' };

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
          {status === 'error' && <span>✗</span>}
        </div>
        {result && !result.success && (
          <p className="mt-0.5 opacity-80 truncate">{result.message}</p>
        )}
      </div>
    </div>
  );
}
