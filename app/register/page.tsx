'use client';

import { useState } from 'react';
import { PageHeader } from '../components/ui';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Registro criado com sucesso. Faça login em seguida.');
      setUsername('');
      setEmail('');
      setPassword('');
    } else {
      setMessage(data.error || 'Falha ao registrar.');
    }
  }

  return (
    <div>
      <PageHeader title="Cadastro" description="Crie novos vendedores. O administrador já está configurado no sistema." />

      <form onSubmit={handleRegister} className="max-w-2xl rounded-3xl bg-white p-8 shadow-sm">
        <div className="grid gap-5">
          <label className="space-y-2 text-slate-700">
            <span>Nome de usuário</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-slate-700">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            Criar conta
          </button>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      </form>
    </div>
  );
}
