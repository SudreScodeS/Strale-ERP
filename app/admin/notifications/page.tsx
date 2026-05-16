'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui';
import { ProtectedPage } from '../../components/protected';
import { getAuthHeaders } from '../../lib/authClient';

interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  entity: string;
  entityId?: string;
  description: string;
  details?: string;
}

const ACTION_ICONS: Record<string, string> = {
  create: '➕', update: '✏️', delete: '🗑️', convert: '🔄',
  send: '📤', status_change: '🔁', login: '🔑', other: '📌',
};

const ACTION_COLORS: Record<string, string> = {
  create: '#10b981', update: '#3b82f6', delete: '#ef4444', convert: '#8b5cf6',
  send: '#06b6d4', status_change: '#f59e0b', login: '#6366f1', other: '#6b7280',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Criação', update: 'Edição', delete: 'Remoção', convert: 'Conversão',
  send: 'Envio', status_change: 'Status', login: 'Login', other: 'Outro',
};

const ENTITY_LABELS: Record<string, string> = {
  order: 'Pedido', quote: 'Orçamento', product: 'Produto', purchase: 'Compra',
  user: 'Usuário', config: 'Configuração', invoice: 'Nota Fiscal', supplier: 'Fornecedor', other: 'Outro',
};

export default function NotificationsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch('/api/activity-logs', { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.logs) setLogs(data.logs);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterEntity !== 'all' && log.entity !== filterEntity) return false;
    return true;
  });

  // Group logs by date
  const groupedLogs: Record<string, ActivityLog[]> = {};
  filteredLogs.forEach(log => {
    const date = new Date(log.timestamp).toLocaleDateString('pt-BR');
    if (!groupedLogs[date]) groupedLogs[date] = [];
    groupedLogs[date].push(log);
  });

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Notificações" description="Histórico completo de ações realizadas no sistema." />

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="all">Todas as ações</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="all">Todos os tipos</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <button
            onClick={() => void loadLogs()}
            className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Atualizar
          </button>

          <span className="ml-auto text-xs" style={{ color: 'var(--text-faint)' }}>
            {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Logs grouped by date */}
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-faint)' }}>
            Carregando...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-faint)' }}>
            Nenhuma atividade registrada.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedLogs).map(([date, dateLogs]) => (
              <div key={date}>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                  {date}
                </h3>
                <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
                  {dateLogs.map((log, i) => {
                    const timeStr = new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-4 px-5 py-3.5 transition-colors"
                        style={{
                          borderBottom: i < dateLogs.length - 1 ? '1px solid var(--border)' : 'none',
                          background: 'var(--card-bg)',
                        }}
                      >
                        <span
                          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm"
                          style={{ background: `${ACTION_COLORS[log.action] || '#6b7280'}12`, color: ACTION_COLORS[log.action] || '#6b7280' }}
                        >
                          {ACTION_ICONS[log.action] || '📌'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            <span className="font-semibold">{log.username}</span>
                            {' · '}
                            {log.description}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text-faint)' }}>
                            <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ background: `${ACTION_COLORS[log.action] || '#6b7280'}12`, color: ACTION_COLORS[log.action] || '#6b7280' }}>
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                            <span className="rounded px-1.5 py-0.5 text-xs" style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)' }}>
                              {ENTITY_LABELS[log.entity] || log.entity}
                            </span>
                            <span>{timeStr}</span>
                            {log.details && <span>· {log.details}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
