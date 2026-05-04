import { NextResponse } from 'next/server';
import { loadServerConfig, updateServerConfig } from '../../lib/config';
import { requireRole } from '../../lib/auth';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }
  const config = loadServerConfig();
  return NextResponse.json({ config });
}

export async function PATCH(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const body = await request.json();
  const updated = updateServerConfig(body);
  return NextResponse.json({ config: updated, message: 'Configurações atualizadas com sucesso.' });
}
