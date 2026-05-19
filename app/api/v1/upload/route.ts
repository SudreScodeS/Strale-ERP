import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

// ==========================================
// FILE UPLOAD API ENDPOINT
// POST /api/v1/upload — Upload a file
// DELETE /api/v1/upload?key=... — Delete a file
// ==========================================

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

/**
 * Ensure the upload directory exists
 */
async function ensureUploadDir(): Promise<void> {
  try {
    await stat(UPLOAD_DIR);
  } catch {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * POST /api/v1/upload
 * Upload a file and return its URL
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Tamanho máximo: ${MAX_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo de arquivo não permitido: ${file.type}` },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    await ensureUploadDir();

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'bin';
    const key = `${randomUUID()}.${ext}`;
    const filePath = join(UPLOAD_DIR, key);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Return the public URL
    const url = `/uploads/${key}`;

    return NextResponse.json({
      url,
      key,
      size: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar upload' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/upload?key=...
 * Delete an uploaded file
 */
export async function DELETE(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Chave do arquivo não fornecida' },
        { status: 400 }
      );
    }

    // Sanitize key — prevent path traversal
    const sanitizedKey = key.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(UPLOAD_DIR, sanitizedKey);

    try {
      await stat(filePath);
      await unlink(filePath);
    } catch {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Upload] Delete error:', error);
    return NextResponse.json(
      { error: 'Erro interno ao deletar arquivo' },
      { status: 500 }
    );
  }
}
