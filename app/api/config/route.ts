import { NextResponse } from 'next/server';
import { globalConfig } from '../../../config/global';

export async function GET() {
  return NextResponse.json({ config: globalConfig });
}
