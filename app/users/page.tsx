'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';
import { useLayout, type SectionConfig } from '../components/layout-context';
import { DraggableSection, LayoutToolbar } from '../components/draggable-section';

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'seller';
  createdAt: string;
}

const PAGE_PATH = '/users';

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'user-list', visible: true, order: 0, colSpan: 1 },
  { id: 'user-form', visible: true, order: 1, colSpan: 1 },
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'seller'>('seller');
  const [message, setMessage] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const { getPageLayout } = useLayout();
  const sections = getPageLayout(PAGE_PATH, DEFAULT_SECTIONS);

  async function loadUsers() {
    const response = await fetch('/api/users', { cache: 'no-store', headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) setUsers(data.users || []);
    else setMessage(data.error || 'Falha ao carregar.');
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/users', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ username, email, password, role }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Usuario criado.');
      setUsername(''); setEmail(''); setPassword(''); setRole('seller');
      setUsers((prev) => [data.user, ...prev]);
    } else {
      setMessage(data.error || 'Falha ao criar.');
    }
  }

  async function handleUpdateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUserId) return;
    const response = await fetch('/api/users', {
      method: 'PATCH',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ id: editingUserId, username, email, password: password || undefined, role }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Usuario atualizado.');
      setEditingUserId(null); setUsername(''); setEmail(''); setPassword(''); setRole('seller');
      await loadUsers();
    } else {
      setMessage(data.error || 'Falha ao atualizar.');
    }
  }

  async function handleDeleteUser(user: UserItem) {
    if (!confirm(`Excluir ${user.username}?`)) return;
    const response = await fetch(`/api/users?id=${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Usuario excluido.');
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (editingUserId === user.id) { setEditingUserId(null); setUsername(''); setEmail(''); setPassword(''); }
    } else {
      setMessage(data.error || 'Falha ao excluir.');
    }
  }

  function handleStartEdit(user: UserItem) {
    setEditingUserId(user.id);
    setUsername(user.username);
    setEmail(user.email);
    setPassword('');
    setRole(user.role);
  }

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader title="Usuarios" description="Gerencie contas do sistema." />
        <LayoutToolbar pagePath={PAGE_PATH} />

        {message && (
          <div className="mb-4 rounded-lg px-4 py-2 text-xs" style={{
            background: message.includes('excluido') || message.includes('criado') || message.includes('atualizado') ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: message.includes('excluido') || message.includes('criado') || message.includes('atualizado') ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${message.includes('excluido') || message.includes('criado') || message.includes('atualizado') ? 'var(--success-border)' : 'var(--danger-border)'}`,
          }}>
            {message}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          {sections.map((section, index) => (
            <DraggableSection
              key={`${section.id}-${section.order}`}
              pagePath={PAGE_PATH}
              section={section}
              index={index}
              totalSections={sections.length}
            >
              {section.id === 'user-list' && (
                <div
                  className="rounded-xl p-5"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Cadastrados</h3>
                    <button
                      type="button"
                      onClick={() => void loadUsers()}
                      className="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
                      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    >
                      Atualizar
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {users.length === 0 ? (
                      <p className="py-6 text-center text-xs" style={{ color: 'var(--text-faint)' }}>Nenhum usuario.</p>
                    ) : (
                      users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between rounded-lg p-3"
                          style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.username}</p>
                            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{user.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)' }}
                            >
                              {user.role}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(user)}
                              className="rounded px-2 py-1 text-[10px] font-medium transition-colors"
                              style={{ background: 'var(--brand-blue-soft)', color: 'var(--brand-blue)' }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteUser(user)}
                              className="rounded px-2 py-1 text-[10px] font-medium transition-colors"
                              style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {section.id === 'user-form' && (
                <div
                  className="rounded-xl p-5"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {editingUserId ? 'Editar usuario' : 'Novo usuario'}
                  </h3>
                  <form className="mt-4 space-y-3" onSubmit={editingUserId ? handleUpdateUser : handleCreateUser}>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Usuario</label>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>E-mail</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Senha</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={editingUserId ? 'Deixe vazio para manter' : ''}
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Papel</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'admin' | 'seller')}
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      >
                        <option value="seller">Vendedor</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all"
                        style={{ background: 'var(--brand-blue)' }}
                        type="submit"
                      >
                        {editingUserId ? 'Salvar' : 'Criar'}
                      </button>
                      {editingUserId && (
                        <button
                          type="button"
                          onClick={() => { setEditingUserId(null); setUsername(''); setEmail(''); setPassword(''); setRole('seller'); }}
                          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </DraggableSection>
          ))}
        </section>
      </div>
    </ProtectedPage>
  );
}
