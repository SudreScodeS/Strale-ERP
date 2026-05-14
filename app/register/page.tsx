'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { globalConfig } from '../../config/global';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Conta criada. Faca login.');
      setUsername('');
      setEmail('');
      setPassword('');
    } else {
      setMessage(data.error || 'Falha ao registrar.');
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
            Criar conta de vendedor
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
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
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            Criar conta
          </button>
          {message && (
            <p className="text-center text-xs" style={{ color: message.includes('Falha') || message.includes('Erro') ? 'var(--danger)' : 'var(--success)' }}>
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
