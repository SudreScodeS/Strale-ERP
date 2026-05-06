'use client';

import { useEffect, useState } from 'react';
import { PageHeader, MetricCard } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';

interface FinancialRecord {
  id: string;
  type: 'sale' | 'purchase' | 'expense';
  amount: number;
  description: string;
  date: string;
}

export default function FinancePage() {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [profit, setProfit] = useState(0);
  const [error, setError] = useState('');

  const PAGE_PATH = '/finance';
  const DEFAULT_SECTIONS: SectionConfig[] = [
    { id: 'finance-metrics', visible: true, order: 0, colSpan: 2 },
    { id: 'finance-table', visible: true, order: 1, colSpan: 2 },
  ];
  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  async function loadFinance() {
    const response = await fetch('/api/finance', { cache: 'no-store', headers: getAuthHeaders() });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Falha ao carregar financeiro.');
      return;
    }
    setRecords(data.records || []);
    setTotalSales(data.totalSales || 0);
    setTotalExpenses(data.totalExpenses || 0);
    setProfit(data.profit || 0);
    setError('');
  }

  useEffect(() => {
    void loadFinance();
  }, []);

  const typeLabel: Record<string, string> = { sale: 'Venda', purchase: 'Compra', expense: 'Despesa' };
  const typeColor: Record<string, string> = {
    sale: 'var(--success)',
    purchase: 'var(--info)',
    expense: 'var(--danger)',
  };

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Financeiro" description="Vendas, despesas e lucro." />
        <LayoutToolbar pagePath={PAGE_PATH} />
          <DraggableSection pagePath={PAGE_PATH} section={sections[0]} index={0} totalSections={sections.length} className="sm:col-span-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard title="Receita" value={`R$ ${totalSales.toFixed(2)}`} />
              <MetricCard title="Despesas" value={`R$ ${totalExpenses.toFixed(2)}`} />
              <MetricCard title="Lucro" value={`R$ ${profit.toFixed(2)}`} />
            </div>
          </DraggableSection>
        </div>

        <DraggableSection pagePath={PAGE_PATH} section={sections[1]} index={1} totalSections={sections.length}>
        <section
          className="mt-6 rounded-xl p-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Historico</h3>
          <div className="mt-3 divide-y" style={{ borderColor: 'var(--border)' }}>
            {records.length === 0 ? (
              <p className="py-6 text-center text-xs" style={{ color: 'var(--text-faint)' }}>
                Nenhum registro.
              </p>
            ) : (
              records.map((record) => (
                <div key={record.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {record.description || typeLabel[record.type]}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      {new Date(record.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'var(--surface-muted)', color: typeColor[record.type] || 'var(--text-muted)' }}
                    >
                      {typeLabel[record.type] || record.type}
                    </span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      R$ {record.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        </DraggableSection>
      </div>
    </ProtectedPage>
  );
}
