// app/lib/db.ts
// Conexão com PostgreSQL usando pool de conexões
// Fornece uma instância compartilhada do pool para todo o sistema

import { Pool } from 'pg';

// Singleton do pool de conexões
// Usa DATABASE_URL do ambiente para conectar ao PostgreSQL
let pool: Pool | null = null;

export function getPool(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null; // Sem DATABASE_URL, retorna null (fallback para JSON)
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 20, // Máximo de conexões no pool
      idleTimeoutMillis: 30000, // Timeout para conexões idle
      connectionTimeoutMillis: 5000, // Timeout para estabelecer conexão
    });

    // Log de erros do pool
    pool.on('error', (err) => {
      console.error('[PostgreSQL] Erro inesperado no pool:', err);
    });
  }

  return pool;
}

// Helper para executar queries
export async function query(text: string, params?: unknown[]) {
  const p = getPool();
  if (!p) {
    throw new Error('PostgreSQL não configurado. Defina DATABASE_URL no .env.local');
  }
  const start = Date.now();
  const result = await p.query(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_DB === 'true') {
    console.log('[PostgreSQL] Query executada', { text: text.substring(0, 80), duration, rows: result.rowCount });
  }
  return result;
}

// Verifica se PostgreSQL está disponível
export function isPostgresAvailable(): boolean {
  return getPool() !== null;
}

// Fecha o pool (útil para testes e graceful shutdown)
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
