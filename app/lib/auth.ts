// lib/auth.ts
// Lógica de autenticação e autorização do ERP
// Arquitetura: Separar regras de segurança da lógica de negócio e das APIs
// Decisão de segurança: JWT stateless para escalabilidade, bcrypt para hash de senhas

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userData } from './data';
import { User } from '../../types';

// ==========================================
// CONFIGURAÇÕES DE SEGURANÇA
// ==========================================

// CHAVE SECRETA PARA ASSINATURA JWT
// CRÍTICO: Em produção, deve vir de variável de ambiente (process.env.JWT_SECRET)
// Nunca commitar chave real no código
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret === 'CHANGE_ME_SECRET') {
    throw new Error('JWT_SECRET deve ser configurado com um valor seguro antes de usar autenticacao.');
  }
  return secret;
}

// TEMPO DE EXPIRAÇÃO DOS TOKENS
// Define quanto tempo um usuário fica logado sem precisar renovar
const TOKEN_EXPIRATION = '1h';

// ==========================================
// UTILITÁRIOS DE SENHA
// ==========================================

// CRIPTOGRAFA SENHA PARA ARMAZENAMENTO SEGURO
// Usa bcrypt com custo 10 (balanceia segurança vs performance)
// Modificar: Para aumentar segurança, aumente o custo (ex: 12), mas afeta performance
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// VERIFICA SE SENHA DIGITADA CORRESPONDE À ARMAZENADA
// Usado durante login - compara hash da senha digitada com hash armazenado
export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

// ==========================================
// GERENCIAMENTO DE TOKENS JWT
// ==========================================

// GERA TOKEN JWT APÓS LOGIN BEM-SUCEDIDO
// Payload contém apenas dados essenciais: id, username, role
// Evita armazenar dados sensíveis no token (stateless)
export function generateJWT(user: User): string {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, getJwtSecret(), {
    expiresIn: TOKEN_EXPIRATION,
  });
}

// VALIDA TOKEN JWT RECEBIDO NAS REQUISIÇÕES
// Retorna payload se token válido, null se inválido/expirado
// Usado por middlewares de proteção de rotas
export function verifyJWT(token: string): { id: string; username: string; role: string } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { id: string; username: string; role: string };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('JWT_SECRET')) {
      throw error;
    }
    return null;
  }
}

// ==========================================
// FUNÇÕES DE AUTENTICAÇÃO
// ==========================================

// PROCESSO COMPLETO DE LOGIN
// 1. Busca usuário por username
// 2. Verifica senha
// 3. Retorna token JWT se válido
// Retorna null se usuário não existe ou senha incorreta
export async function authenticate(username: string, password: string): Promise<string | null> {
  const user = userData.getByUsername(username);
  if (!user) return null;
  const valid = await comparePassword(password, user.password);
  if (!valid) return null;
  return generateJWT(user);
}

// ==========================================
// MIDDLEWARES DE AUTORIZAÇÃO
// ==========================================

// MIDDLEWARE BÁSICO: VERIFICA SE USUÁRIO ESTÁ AUTENTICADO
// Usado em rotas que requerem login (qualquer usuário logado)
// Lança erro se não autenticado
function extractBearerToken(authHeader: string): string | null {
  const trimmed = authHeader.trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  return match ? match[1].trim() : null;
}

export function requireAuth(req: Request): { userId: string; role: string } {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) throw new Error('Unauthorized');
  const token = extractBearerToken(authHeader);
  if (!token) throw new Error('Unauthorized');
  const payload = verifyJWT(token);
  if (!payload) throw new Error('Unauthorized');
  return { userId: payload.id, role: payload.role };
}

// MIDDLEWARE AVANÇADO: VERIFICA AUTENTICAÇÃO + PERMISSÃO POR ROLE
// Usado em rotas administrativas (ex: apenas admin pode criar usuários)
// roles: array de roles permitidos (ex: ['admin'], ['admin', 'seller'])
export function requireRole(req: Request, roles: string[]) {
  const payload = requireAuth(req);
  if (!roles.includes(payload.role)) {
    throw new Error('Forbidden');
  }
  return payload;
}

// ==========================================
// NOTAS DE SEGURANÇA E MELHORIAS
// ==========================================

// MELHORIAS RECOMENDADAS:
// 1. Implementar refresh tokens para sessões longas
// 2. Adicionar rate limiting para prevenir ataques de força bruta
// 3. Implementar logout (blacklist de tokens)
// 4. Adicionar 2FA para contas admin
// 5. Logs de segurança (tentativas de login falhadas)
// 6. Validação de força de senha no cadastro
// 7. Implementar bloqueio de conta após múltiplas tentativas falhadas
