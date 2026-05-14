'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { globalConfig } from '../../config/global';
import { parseJwt } from '../lib/authClient';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const t = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
    setTheme(t);
    const observer = new MutationObserver(() => {
      const nt = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nt);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

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
        setMessage('Sessao invalida. Tente novamente.');
        return;
      }
      window.location.href = user.role === 'admin' ? '/' : '/sales';
    } else {
      setMessage(data.error || 'Falha ao autenticar.');
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Image
            src={theme === 'light' ? '/LogoCE.svg' : '/LogoE.svg'}
            alt="Elitium"
            width={200}
            height={88}
            className="h-auto w-48"
            priority
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Faca login para continuar
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Usuario
            </label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
            />
          </div>
          <button
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all"
            style={{ background: 'var(--brand)' }}
            type="submit"
          >
            Entrar
          </button>
          {message && (
            <p className="text-center text-xs" style={{ color: 'var(--danger)' }}>
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
