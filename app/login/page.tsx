'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { globalConfig } from '../../config/global';
import { parseJwt } from '../lib/authClient';
import { ValidatedInput } from '../components/validated-field';
import { PageTitle } from '../components/PageTitle';

// ==========================================
// VALIDATION SCHEMA
// ==========================================

const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Informe o nome de usuário')
    .min(3, 'Mínimo de 3 caracteres'),
  password: z
    .string()
    .min(1, 'Informe a senha')
    .min(4, 'Mínimo de 4 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      username: 'admin',
      password: 'admin123',
    },
  });

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

  async function onSubmit(data: LoginFormData) {
    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (response.ok) {
        window.localStorage.setItem('erp-token', result.token);
        const user = parseJwt(result.token);
        if (!user) {
          window.localStorage.removeItem('erp-token');
          setMessage('Sessão inválida. Tente novamente.');
          return;
        }
        window.location.href = user.role === 'admin' ? '/' : '/sales';
      } else {
        setMessage(result.error || 'Falha ao autenticar.');
      }
    } catch {
      setMessage('Erro de conexão. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <PageTitle title="Login" />
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
            Faça login para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate aria-label="Formulário de login">
          <ValidatedInput
            label="Usuário"
            {...register('username')}
            error={errors.username}
            placeholder="Seu usuário"
            autoComplete="username"
          />
          <ValidatedInput
            label="Senha"
            type="password"
            {...register('password')}
            error={errors.password}
            placeholder="Sua senha"
            autoComplete="current-password"
          />
          <button
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--brand)' }}
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Entrando…
              </span>
            ) : 'Entrar'}
          </button>
          {message && (
            <p role="alert" className="rounded-lg px-3 py-2 text-center text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
