import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { userData } from '../../../lib/data';
import { hashPassword } from '../../../lib/auth';

export async function POST(request: Request) {
  const body = await request.json();
  const { username, email, password } = body as { username: string; email: string; password: string };

  if (!username || !email || !password) {
    return NextResponse.json({ error: 'Dados de registro incompletos.' }, { status: 400 });
  }

  const existing = userData.getByUsername(username);
  if (existing) {
    return NextResponse.json({ error: 'Usuário já existe.' }, { status: 409 });
  }

  const hashedPassword = await hashPassword(password);
  userData.create({
    id: uuidv4(),
    username,
    email,
    password: hashedPassword,
    role: 'seller',
    createdAt: new Date(),
  });

  return NextResponse.json({ message: 'Cadastro realizado com sucesso.' });
}
