import { NextResponse } from 'next/server';
import { getInventoryState } from '../../lib/inventory';
import { requireRole } from '../../lib/auth';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin', 'seller']);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 },
    );
  }
  const inventory = getInventoryState();
  return NextResponse.json({ inventory });
}
