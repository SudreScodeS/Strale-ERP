'use client';

import { useState } from 'react';
import { PageHeader } from '../components/ui';
import { parseJwt } from '../lib/authClient';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [message, setMessage] = useState('');

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (response.ok) {
      window.localStorage.setItem('erp-token', data.token);
      const user = parseJwt(data.token);
      if (!user) {
        window.localStorage.removeItem('erp-token');
        setMessage('Sessão inválida após o login. Atualize a página e tente novamente.');
        return;
      }
      window.location.href = user.role === 'admin' ? '/' : '/sales';
    } else {
      setMessage(data.error || 'Falha ao autenticar.');
    }
  }

  return (
    <div>
      <PageHeader title="Login" description="Acesso básico ao sistema ERP. O token JWT é armazenado localmente para simular autenticação." />

      <form onSubmit={handleLogin} className="max-w-2xl rounded-3xl bg-white p-8 shadow-sm">
        <div className="grid gap-5">
          <label className="space-y-2 text-slate-700">
            <span>Usuário</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-slate-700">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            />
          </label>
          <button className="inline-flex h-12 items-center justify-center rounded-3xl bg-slate-900 px-6 text-white transition hover:bg-slate-700" type="submit">
            Entrar
          </button>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      </form>
    </div>
  );
}
