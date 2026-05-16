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
