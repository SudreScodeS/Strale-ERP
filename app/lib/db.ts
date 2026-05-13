// app/lib/db.ts
// Conexão com PostgreSQL usando pool de conexões
// Usa import dinâmico para evitar bundling no client-side do Next.js

// Singleton do pool de conexões
// Usa DATABASE_URL do ambiente para conectar ao PostgreSQL
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool: any = null;
let pgModule: typeof import('pg') | null = null;

async function getPg() {
  if (!pgModule) {
    try {
      pgModule = await import('pg');
    } catch {
      return null;
    }
  }
  return pgModule;
}

export async function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null; // Sem DATABASE_URL, retorna null (fallback para JSON)
  }

  if (!pool) {
    const pg = await getPg();
    if (!pg) return null;

    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err: Error) => {
      console.error('[PostgreSQL] Erro inesperado no pool:', err);
    });
  }

  return pool;
}

// Helper para executar queries
export async function query(text: string, params?: unknown[]) {
  const p = await getPool();
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

// Verifica se PostgreSQL está disponível (síncrono, checa env var)
export function isPostgresAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

// Fecha o pool (útil para testes e graceful shutdown)
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
