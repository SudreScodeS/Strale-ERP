// app/components/protected.tsx
// Componente de proteção de rotas baseado em autenticação e roles
// Garante que apenas usuários autorizados acessem páginas específicas
// Arquitetura: Client-side protection com redirect automático

"use client";

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, TokenPayload } from '../lib/authClient';

// ==========================================
// TIPOS E INTERFACES
// ==========================================

// PROPS DO COMPONENTE PROTECTEDPAGE
interface ProtectedPageProps {
  children: ReactNode;                    // Conteúdo a ser protegido
  allowedRoles: TokenPayload['role'][];   // Roles que podem acessar (ex: ['admin'], ['admin', 'seller'])
  redirectTo?: string;                    // Página para redirecionar se não autenticado (padrão: /login)
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

// COMPONENTE DE PROTEÇÃO DE ROTAS
// Verifica autenticação e permissões antes de renderizar conteúdo
// Processo:
// 1. Verifica se usuário está logado
// 2. Verifica se role do usuário está na lista de permitidos
// 3. Redireciona ou mostra loading até validação completa
export function ProtectedPage({ children, allowedRoles, redirectTo = '/login' }: ProtectedPageProps) {
  // Estado que controla se conteúdo pode ser mostrado
  const [authorized, setAuthorized] = useState(false);

  // Hook do Next.js para navegação programática
  const router = useRouter();

  // EFEITO QUE EXECUTA VALIDAÇÃO AO MONTAR COMPONENTE
  useEffect(() => {
    // Busca usuário atual do localStorage/token
    const user = getCurrentUser();

    // USUÁRIO NÃO LOGADO
    if (!user) {
      // Redireciona para página de login (ou página especificada)
      router.replace(redirectTo);
      return;
    }

    // USUÁRIO LOGADO MAS SEM PERMISSÃO
    if (!allowedRoles.includes(user.role)) {
      // Redireciona para página padrão do usuário (sales para sellers)
      router.replace('/sales');
      return;
    }

    // USUÁRIO AUTORIZADO - permite renderizar conteúdo
    setAuthorized(true);
  }, [allowedRoles, redirectTo, router]);

  // ENQUANTO VALIDAÇÃO ACONTECE, MOSTRA LOADING
  // Previne flash de conteúdo não autorizado
  if (!authorized) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center text-slate-700 shadow-sm">
        Validando sessão...
      </div>
    );
  }

  // USUÁRIO AUTORIZADO - renderiza conteúdo protegido
  return <>{children}</>;
}

// ==========================================
// EXEMPLO DE USO
// ==========================================

/*
<Página Admin - apenas admin acessa>
<ProtectedPage allowedRoles={['admin']}>
  <AdminDashboard />
</ProtectedPage>

<Página de Vendas - admin e seller acessam>
<ProtectedPage allowedRoles={['admin', 'seller']}>
  <SalesPage />
</ProtectedPage>

<Página Customizada - redirect específico>
<ProtectedPage allowedRoles={['seller']} redirectTo="/unauthorized">
  <SellerTools />
</ProtectedPage>
*/

// ==========================================
// NOTAS DE SEGURANÇA E PERFORMANCE
// ==========================================

// SEGURANÇA:
// - Proteção client-side: complemento à proteção server-side das APIs
// - Não substitui validação server-side (sempre validar nas APIs também)
// - Token pode ser manipulado no client, mas server valida

// PERFORMANCE:
// - Executa apenas uma vez ao montar componente
// - Loading state previne renderização desnecessária
// - useEffect com dependências corretas evita re-execuções

// LIMITAÇÕES:
// - Client-side only: não protege contra acesso direto à URL
// - Depende de JavaScript: usuários sem JS veem loading infinito
// - Não protege APIs: sempre usar middlewares server-side também
