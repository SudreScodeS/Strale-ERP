'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';
import { getAuthHeaders } from '../lib/authClient';

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'seller';
  createdAt: string;
}

function UsersPageContent() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'seller'>('seller');
  const [message, setMessage] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  async function loadUsers() {
    const response = await fetch('/api/users', {
      cache: 'no-store',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (response.ok) {
      setUsers(data.users || []);
    } else {
      setMessage(data.error || 'Falha ao carregar usuários.');
    }
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
      setMessage(data.message || 'Usuário criado com sucesso.');
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('seller');
      setUsers((prev) => [data.user, ...prev]);
    } else {
      setMessage(data.error || 'Falha ao criar usuário.');
    }
  }

  async function handleStartEdit(user: UserItem) {
    setEditingUserId(user.id);
    setUsername(user.username);
    setEmail(user.email);
    setPassword('');
    setRole(user.role);
    setMessage(`Editando usuário ${user.username}.`);
  }

  function handleCancelEdit() {
    setEditingUserId(null);
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('seller');
    setMessage('');
  }

  async function handleUpdateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUserId) return;
    const response = await fetch('/api/users', {
      method: 'PATCH',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        id: editingUserId,
        username,
        email,
        password: password || undefined,
        role,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Falha ao atualizar usuário.');
      return;
    }
    setMessage(data.message || 'Usuário atualizado com sucesso.');
    handleCancelEdit();
    await loadUsers();
  }

  async function handleDeleteUser(user: UserItem) {
    if (!confirm(`Deseja realmente excluir o usuário ${user.username}?`)) return;
    setBusyUserId(user.id);
    const response = await fetch(`/api/users?id=${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    setBusyUserId(null);
    if (response.ok) {
      setMessage(data.message || 'Usuário excluído com sucesso.');
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      if (editingUserId === user.id) {
        handleCancelEdit();
      }
    } else {
      setMessage(data.error || 'Falha ao excluir usuário.');
    }
  }

  return (
    <div>
      <PageHeader title="Gestão de Usuários" description="Visualize usuários existentes e crie novas contas para vendedores ou administradores." />

      {message ? <div className="mb-6 rounded-3xl border border-slate-200 bg-emerald-50 p-4 text-slate-800">{message}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-semibold text-slate-900">Usuários cadastrados</h3>
              <button
                type="button"
                onClick={() => void loadUsers()}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Atualizar lista
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {users.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum usuário cadastrado ainda.</p>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="rounded-3xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{user.username}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{user.role}</span>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Criado em {new Date(user.createdAt).toLocaleString()}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleStartEdit(user)}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-700"
                      >
                        Atualizar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteUser(user)}
                        disabled={busyUserId === user.id || user.username === 'admin'}
                        className="rounded-2xl bg-rose-600 px-4 py-2 text-sm text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">{editingUserId ? 'Atualizar usuário' : 'Criar novo usuário'}</h3>
          <form className="mt-6 space-y-4" onSubmit={editingUserId ? handleUpdateUser : handleCreateUser}>
            <label className="block text-slate-700">
              Nome de usuário
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              />
            </label>
            <label className="block text-slate-700">
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              />
            </label>
            <label className="block text-slate-700">
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              />
            </label>
            <label className="block text-slate-700">
              Papel
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as 'admin' | 'seller')}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <option value="seller">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <button className="inline-flex h-12 items-center justify-center rounded-3xl bg-slate-900 px-6 text-white transition hover:bg-slate-700" type="submit">
              {editingUserId ? 'Salvar atualização' : 'Criar usuário'}
            </button>
            {editingUserId ? (
              <button
                className="ml-3 inline-flex h-12 items-center justify-center rounded-3xl border border-slate-200 px-6 text-slate-700 transition hover:bg-slate-100"
                type="button"
                onClick={handleCancelEdit}
              >
                Cancelar edição
              </button>
            ) : null}
          </form>
        </div>
      </section>
    </div>
  );
}

export default function UsersPage() {
  return (
    <ProtectedPage allowedRoles={['admin']}>
      <UsersPageContent />
    </ProtectedPage>
  );
}
