import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';
import { activityLogData } from '../../lib/data';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const logs = activityLogData.getAll().sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return NextResponse.json({ logs });
}

export async function DELETE(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const deleteAll = searchParams.get('deleteAll');
  const id = searchParams.get('id');

  if (deleteAll === 'true') {
    activityLogData.clearAll();
    return NextResponse.json({ success: true, message: 'Todos os logs foram removidos.' });
  }

  if (id) {
    const deleted = activityLogData.deleteById(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Log não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Log removido com sucesso.' });
  }

  return NextResponse.json(
    { error: 'Forneça um id ou deleteAll=true.' },
    { status: 400 },
  );
}
