import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/auth';
import { getProductAIReport } from '../../lib/product-ai';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unauthorized' },
      {
        status: error instanceof Error && error.message.startsWith('JWT_SECRET')
          ? 500
          : error instanceof Error && error.message === 'Forbidden'
            ? 403
            : 401,
      },
    );
  }

  return NextResponse.json({ report: getProductAIReport() });
}
