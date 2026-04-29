import { NextResponse } from 'next/server';
import { getDashboardSummary } from '../../lib/dashboard';

export async function GET() {
  const summary = getDashboardSummary();
  return NextResponse.json({ summary });
}
