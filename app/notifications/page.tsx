'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageHeader, setGlobalDirty } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import {
  ACTION_ICON_MAP, NOTIFICATION_ICON_MAP,
  IconSearch, IconTrash, IconRefresh, IconFilter, IconSort,
  IconOther,
} from '../components/icons';

// ==========================================
// TYPES
// ==========================================

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

interface NotificationSettings {
  orderCreated: boolean;
  orderStatusChanged: boolean;
  orderDelivered: boolean;
  quoteCreated: boolean;
  quoteStatusChanged: boolean;
  stockAlert: boolean;
  purchaseCreated: boolean;
  purchaseReceived: boolean;
  userLogin: boolean;
  financialRecord: boolean;
}

// ==========================================
// CONSTANTS
// ==========================================

const ACTION_COLORS: Record<string, string> = {
  create: '#10b981', update: '#3b82f6', delete: '#ef4444', convert: '#8b5cf6',
  send: '#06b6d4', status_change: '#f59e0b', login: '#6366f1', restore: '#8b5cf6', other: '#6b7280',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Criação', update: 'Edição', delete: 'Remoção', convert: 'Conversão',
  send: 'Envio', status_change: 'Status', login: 'Login', restore: 'Restauração', other: 'Outro',
};

const ENTITY_LABELS: Record<string, string> = {
  order: 'Pedido', quote: 'Orçamento', product: 'Produto', purchase: 'Compra',
  user: 'Usuário', config: 'Configuração', invoice: 'Nota Fiscal', supplier: 'Fornecedor', other: 'Outro',
};

const NOTIFICATION_ITEMS: { key: keyof NotificationSettings; label: string; description: string }[] = [
  { key: 'orderCreated', label: 'Novo Pedido', description: 'Quando um novo pedido é criado no sistema' },
  { key: 'orderStatusChanged', label: 'Status do Pedido', description: 'Quando o status de um pedido muda (pendente, concluído, cancelado)' },
  { key: 'orderDelivered', label: 'Entrega do Pedido', description: 'Quando um pedido é marcado como entregue' },
  { key: 'quoteCreated', label: 'Novo Orçamento', description: 'Quando um novo orçamento é criado' },
  { key: 'quoteStatusChanged', label: 'Status do Orçamento', description: 'Quando o status de um orçamento muda (enviado, aprovado, rejeitado)' },
  { key: 'stockAlert', label: 'Alerta de Estoque', description: 'Quando o estoque de uma variável atinge nível crítico ou de atenção' },
  { key: 'purchaseCreated', label: 'Nova Compra', description: 'Quando um pedido de compra é criado para reposição de estoque' },
  { key: 'purchaseReceived', label: 'Compra Recebida', description: 'Quando um pedido de compra é marcado como recebido' },
  { key: 'userLogin', label: 'Login de Usuário', description: 'Quando um usuário faz login no sistema' },
  { key: 'financialRecord', label: 'Registro Financeiro', description: 'Quando uma transação financeira é registrada (venda, despesa, compra)' },
];

// ==========================================
// TOGGLE COMPONENT
// ==========================================

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none"
      style={{
        background: enabled ? 'var(--brand)' : 'var(--border)',
      }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        style={{
          transform: enabled ? 'translateX(22px)' : 'translateX(2px)',
          marginTop: '2px',
        }}
      />
    </button>
  );
}

// ==========================================
// CONFIRM DIALOG COMPONENT
// ==========================================

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--danger)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ==========================================
// MAIN PAGE
// ==========================================

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'config'>('search');

  // Activity log state
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Delete confirmation state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: '', onConfirm: () => {} });

  // Notification settings state
  const [settings, setSettings] = useState<NotificationSettings>({
    orderCreated: true,
    orderStatusChanged: true,
    orderDelivered: true,
    quoteCreated: true,
    quoteStatusChanged: true,
    stockAlert: true,
    purchaseCreated: true,
    purchaseReceived: true,
    userLogin: false,
    financialRecord: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsMessageType, setSettingsMessageType] = useState<'success' | 'error'>('success');
  const [dirty, setDirty] = useState(false);
  const savedSettingsRef = useRef<string>('');

  // ==========================================
  // DATA LOADING
  // ==========================================

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch('/api/activity-logs', { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.logs) setLogs(data.logs);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function loadSettings() {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/config', { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.config?.notifications) {
        setSettings(data.config.notifications);
        savedSettingsRef.current = JSON.stringify(data.config.notifications);
        setDirty(false);
        setGlobalDirty(false);
      }
    } catch { /* ignore */ }
    setSettingsLoading(false);
  }

  // Track dirty state by comparing current settings with last saved
  useEffect(() => {
    if (!savedSettingsRef.current) return;
    const current = JSON.stringify(settings);
    const isDirty = current !== savedSettingsRef.current;
    setDirty(isDirty);
    setGlobalDirty(isDirty, {
      message: 'Você tem alterações não salvas nas configurações de notificação.',
      onSave: async () => {
        await handleSaveSettings();
      },
      onDiscard: () => {
        void loadSettings();
      },
    });
  }, [settings]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    void loadLogs();
    void loadSettings();
  }, []);

  // ==========================================
  // DELETE HANDLERS
  // ==========================================

  async function handleDeleteLog(id: string) {
    try {
      const res = await fetch(`/api/activity-logs?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setLogs(prev => prev.filter(l => l.id !== id));
      }
    } catch { /* ignore */ }
  }

  async function handleClearAll() {
    try {
      const res = await fetch('/api/activity-logs?deleteAll=true', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setLogs([]);
      }
    } catch { /* ignore */ }
  }

  function confirmDeleteLog(id: string, description: string) {
    setConfirmDialog({
      open: true,
      title: 'Remover log',
      message: `Tem certeza que deseja remover este registro?\n\n"${description}"`,
      confirmLabel: 'Remover',
      onConfirm: () => {
        void handleDeleteLog(id);
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }

  function confirmClearAll() {
    setConfirmDialog({
      open: true,
      title: 'Limpar todos os logs',
      message: `Tem certeza que deseja remover todos os ${logs.length} registros? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Limpar tudo',
      onConfirm: () => {
        void handleClearAll();
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }

  // ==========================================
  // SETTINGS SAVE
  // ==========================================

  async function handleSaveSettings() {
    setSettingsMessage('');
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ notifications: settings }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettingsMessage('Configurações de notificação salvas com sucesso!');
        setSettingsMessageType('success');
        savedSettingsRef.current = JSON.stringify(settings);
        setDirty(false);
        setGlobalDirty(false);
      } else {
        setSettingsMessage(data.error || 'Erro ao salvar configurações.');
        setSettingsMessageType('error');
      }
    } catch {
      setSettingsMessage('Erro ao conectar com o servidor.');
      setSettingsMessageType('error');
    }
  }

  function toggleSetting(key: keyof NotificationSettings) {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAll(enabled: boolean) {
    setSettings(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        (next as Record<string, boolean>)[key] = enabled;
      }
      return next;
    });
  }

  // ==========================================
  // FILTERED & SORTED LOGS
  // ==========================================

  const query = searchQuery.toLowerCase().trim();

  const filteredLogs = logs
    .filter(log => {
      if (filterAction !== 'all' && log.action !== filterAction) return false;
      if (filterEntity !== 'all' && log.entity !== filterEntity) return false;
      if (query) {
        const haystack = `${log.description} ${log.username} ${log.details || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });

  const groupedLogs: Record<string, ActivityLog[]> = {};
  filteredLogs.forEach(log => {
    const date = new Date(log.timestamp).toLocaleDateString('pt-BR');
    if (!groupedLogs[date]) groupedLogs[date] = [];
    groupedLogs[date].push(log);
  });

  const enabledCount = Object.values(settings).filter(Boolean).length;
  const totalCount = Object.values(settings).length;

  // Active filter count
  const activeFilterCount = [
    filterAction !== 'all',
    filterEntity !== 'all',
    searchQuery.trim() !== '',
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  function clearAllFilters() {
    setFilterAction('all');
    setFilterEntity('all');
    setSearchQuery('');
  }

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Notificações" description="Gerencie alertas e visualize o histórico de ações do sistema." />

        {/* Tab Toggle Bar */}
        <div
          className="mb-6 inline-flex gap-1 rounded-xl p-1"
          style={{ background: 'var(--surface-muted)' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: activeTab === 'search' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'search' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'search' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Buscar notificações
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: activeTab === 'config' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'config' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'config' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Configurar notificações
          </button>
        </div>

        {/* ==========================================
            TAB: BUSCAR NOTIFICAÇÕES
            ========================================== */}
        {activeTab === 'search' && (
          <div>
            {/* Filters */}
            <div
              className="mb-6 rounded-xl p-4"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
            >
              {/* Row 1: Search input */}
              <div className="mb-3">
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    <IconSearch size={14} />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar por descrição, usuário ou detalhes..."
                    className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
                    style={{
                      background: 'var(--surface-muted)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Selects and actions */}
              <div className="flex flex-wrap items-center gap-3">
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

                <select
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                </select>

                {/* Active filter badge */}
                {hasActiveFilters && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ background: 'var(--brand)', color: '#fff' }}
                  >
                    {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''} ativo{activeFilterCount > 1 ? 's' : ''}
                  </span>
                )}

                <div className="ml-auto flex items-center gap-2">
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                      style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      Limpar filtros
                    </button>
                  )}

                  <button
                    onClick={() => void loadLogs()}
                    className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    Atualizar
                  </button>

                  <button
                    onClick={confirmClearAll}
                    disabled={logs.length === 0}
                    className="rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40"
                    style={{ background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger, #ef4444)', border: '1px solid var(--danger, #ef4444)' }}
                  >
                    Limpar todos
                  </button>
                </div>
              </div>

              {/* Row 3: Record count */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''}
                  {hasActiveFilters && ` de ${logs.length} total`}
                </span>
              </div>
            </div>

            {/* Logs grouped by date */}
            {loading ? (
              <div className="py-16 text-center text-sm" style={{ color: 'var(--text-faint)' }}>
                Carregando...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: 'var(--text-faint)' }}>
                {logs.length === 0 ? 'Nenhuma atividade registrada.' : 'Nenhum resultado para os filtros aplicados.'}
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
                            className="group flex items-start gap-4 px-5 py-3.5 transition-colors"
                            style={{
                              borderBottom: i < dateLogs.length - 1 ? '1px solid var(--border)' : 'none',
                              background: 'var(--card-bg)',
                            }}
                          >
                            <span
                              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                              style={{ background: `${ACTION_COLORS[log.action] || '#6b7280'}12`, color: ACTION_COLORS[log.action] || '#6b7280' }}
                            >
                              {(() => { const Icon = ACTION_ICON_MAP[log.action] || IconOther; return <Icon size={15} />; })()}
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
                            <button
                              type="button"
                              onClick={() => confirmDeleteLog(log.id, log.description)}
                              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-60"
                              style={{ background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger, #ef4444)' }}
                              title="Remover este log"
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB: CONFIGURAR NOTIFICAÇÕES
            ========================================== */}
        {activeTab === 'config' && (
          <div>
            {/* Status message */}
            {settingsMessage && (
              <div
                className="mb-6 rounded-2xl p-4 text-sm font-medium"
                style={{
                  background: settingsMessageType === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color: settingsMessageType === 'success' ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${settingsMessageType === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
                }}
              >
                {settingsMessage}
              </div>
            )}

            {/* Header with bulk actions */}
            <div
              className="mb-6 flex items-center justify-between rounded-2xl p-5"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  Preferências de Notificação
                </h3>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {enabledCount} de {totalCount} notificações ativas
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAll(true)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  Ativar todas
                </button>
                <button
                  type="button"
                  onClick={() => toggleAll(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  Desativar todas
                </button>
              </div>
            </div>

            {/* Notification toggles */}
            <div
              className="overflow-hidden rounded-2xl"
              style={{ border: '1px solid var(--card-border)' }}
            >
              {NOTIFICATION_ITEMS.map((item, i) => {
                const NotifIcon = NOTIFICATION_ICON_MAP[item.key] || IconOther;
                return (
                <div
                  key={item.key}
                  className="flex items-center gap-4 px-5 py-4 transition-colors"
                  style={{
                    borderBottom: i < NOTIFICATION_ITEMS.length - 1 ? '1px solid var(--border)' : 'none',
                    background: 'var(--card-bg)',
                  }}
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                  >
                    <NotifIcon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.description}
                    </p>
                  </div>
                  <Toggle
                    enabled={settings[item.key]}
                    onChange={() => toggleSetting(item.key)}
                  />
                </div>
                );
              })}
            </div>

            {/* Save button */}
            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                onClick={() => void handleSaveSettings()}
                className="inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
                style={{ background: 'var(--brand)' }}
              >
                Salvar Configurações
              </button>
              <button
                type="button"
                onClick={() => void loadSettings()}
                className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium transition-colors"
                style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                Restaurar padrão
              </button>
            </div>
          </div>
        )}
        {/* Floating unsaved changes bar — portal to body for true fixed positioning */}
        {dirty && createPortal(
          <div
            className="fixed bottom-0 left-0 right-0 z-[90] flex items-center justify-center gap-4 px-6 py-3"
            style={{
              background: 'var(--card-bg)',
              borderTop: '2px solid var(--warning, #f59e0b)',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: 'var(--warning, #f59e0b)' }} />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: 'var(--warning, #f59e0b)' }} />
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Você tem alterações não salvas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadSettings()}
                className="rounded-lg px-4 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: 'var(--surface-muted)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveSettings()}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'var(--brand)' }}
              >
                Salvar agora
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* Confirmation Dialog */}
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        />
      </div>
    </ProtectedPage>
  );
}
