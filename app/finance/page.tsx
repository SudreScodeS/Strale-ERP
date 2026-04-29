'use client';

import { useEffect, useState } from 'react';
import { PageHeader, MetricCard } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { FinancialRecord } from '../../types';

export default function FinancePage() {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [profit, setProfit] = useState(0);
  const [message, setMessage] = useState('');

  async function loadFinance() {
    const response = await fetch('/api/finance', {
      cache: 'no-store',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Falha ao carregar financeiro.');
      return;
    }
    setRecords(data.records || []);
    setTotalSales(data.totalSales || 0);
    setTotalExpenses(data.totalExpenses || 0);
    setProfit(data.profit || 0);
    setMessage('');
  }

  useEffect(() => {
    void loadFinance();
  }, []);

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Financeiro" description="Visão financeira com vendas, despesas e lucro integrado ao fluxo de pedidos." />
        <div className="mb-5">
          <button
            type="button"
            onClick={() => void loadFinance()}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Atualizar financeiro
          </button>
        </div>
        {message ? <p className="mb-4 text-sm text-rose-600">{message}</p> : null}

        <div className="grid gap-6 md:grid-cols-3">
          <MetricCard title="Total vendido" value={`R$ ${totalSales.toFixed(2)}`} />
          <MetricCard title="Total gasto" value={`R$ ${totalExpenses.toFixed(2)}`} />
          <MetricCard title="Lucro" value={`R$ ${profit.toFixed(2)}`} />
        </div>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Histórico financeiro</h3>
          <div className="mt-6 space-y-4">
            {records.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum registro financeiro encontrado.</p>
            ) : (
              records.map((record) => (
                <div key={record.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{record.description || record.type.toUpperCase()}</p>
                      <p className="text-sm text-slate-500">Tipo: {record.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-900">R$ {record.amount.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{new Date(record.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </ProtectedPage>
  );
}
