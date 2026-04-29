import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';
import { getFinancialRecords } from '../../lib/finance';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const summary = getFinancialRecords();
  return NextResponse.json(summary);
}
