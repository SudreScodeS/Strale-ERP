import { NextResponse } from 'next/server';
import { authenticate } from '../../../lib/auth';

export async function POST(request: Request) {
  const body = await request.json();
  const { username, password } = body as { username: string; password: string };

  if (!username || !password) {
    return NextResponse.json({ message: 'Dados de login incompletos.' }, { status: 400 });
  }

  const token = await authenticate(username, password);
  if (!token) {
    return NextResponse.json({ message: 'Usuário ou senha incorretos.' }, { status: 401 });
  }

  return NextResponse.json({ token });
}
