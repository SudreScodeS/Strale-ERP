import { NextResponse } from 'next/server';
import { getDashboardSummary } from '../../lib/dashboard';
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
  const summary = getDashboardSummary();
  return NextResponse.json({ summary });
}
