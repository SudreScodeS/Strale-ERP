'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { globalConfig } from '../../config/global';
import { ValidatedInput } from '../components/validated-field';
import { PageTitle } from '../components/PageTitle';
import { apiFetch } from '../lib/apiFetch';

// ==========================================
// VALIDATION SCHEMA
// ==========================================

const registerSchema = z.object({
  username: z
    .string()
    .min(1, 'Informe o nome de usuário')
    .min(3, 'Mínimo de 3 caracteres')
    .max(30, 'Máximo de 30 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Apenas letras, números e underline'),
  email: z
    .string()
    .min(1, 'Informe o e-mail')
    .email('E-mail inválido'),
  password: z
    .string()
    .min(1, 'Informe a senha')
    .min(6, 'Mínimo de 6 caracteres'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
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

  async function onSubmit(data: RegisterFormData) {
    setIsSubmitting(true);
    setMessage('');
    setIsSuccess(false);
    try {
      const response = await apiFetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (response.ok) {
        setMessage('Conta criada com sucesso! Faça login.');
        setIsSuccess(true);
        reset();
      } else {
        setMessage(result.message || 'Falha ao registrar.');
        setIsSuccess(false);
      }
    } catch {
      setMessage('Erro de conexão. Tente novamente.');
      setIsSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <PageTitle title="Cadastro" />
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate aria-label="Formulário de cadastro">
          <ValidatedInput
            label="Usuário"
            {...register('username')}
            error={errors.username}
            placeholder="Nome de usuário"
            autoComplete="username"
            hint="Letras, números e underline"
          />
          <ValidatedInput
            label="E-mail"
            type="email"
            {...register('email')}
            error={errors.email}
            placeholder="email@exemplo.com"
            autoComplete="email"
          />
          <ValidatedInput
            label="Senha"
            type="password"
            {...register('password')}
            error={errors.password}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
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
                Criando conta…
              </span>
            ) : 'Criar conta'}
          </button>
          {message && (
            <p
              role="alert"
              className="rounded-lg px-3 py-2 text-center text-xs"
              style={{
                background: isSuccess ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: isSuccess ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${isSuccess ? 'var(--success-border)' : 'var(--danger-border)'}`,
              }}
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
