import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';
import { getFinancialRecords } from '../../lib/finance';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get('fromDate') || undefined;
  const toDate = searchParams.get('toDate') || undefined;

  const summary = getFinancialRecords(fromDate, toDate);
  return NextResponse.json(summary);
}
