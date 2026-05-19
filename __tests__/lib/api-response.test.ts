// @ts-nocheck

/**
 * Tests for app/lib/api-response.ts
 * Covers: ok, created, success, badRequest, unauthorized, forbidden, notFound, conflict, internalError, fromError, paginated
 *
 * Note: ok() spreads object data at the top level (not under a `data` key).
 *       Non-object data goes under `data`.
 */

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => {
      const status = init?.status ?? 200;
      return { body, status, headers: new Headers() };
    }),
  },
}));

import {
  ok,
  created,
  success,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError,
  fromError,
  paginated,
} from '../../app/lib/api-response';

describe('Success Responses', () => {
  describe('ok()', () => {
    it('should return 200 with data spread at top level', () => {
      const response = ok({ name: 'test' });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        name: 'test',
      });
    });

    it('should include message when provided', () => {
      const response = ok({ id: 1 }, 'Dados carregados.');
      expect(response.body).toMatchObject({
        success: true,
        message: 'Dados carregados.',
        id: 1,
      });
    });

    it('should wrap non-object data under data key', () => {
      const response = ok('string-value');
      expect(response.body).toMatchObject({
        success: true,
        data: 'string-value',
      });
    });

    it('should include meta with timestamp and requestId', () => {
      const response = ok({ id: 1 });
      expect(response.body).toMatchObject({
        success: true,
      });
      const meta = (response.body as { meta: { timestamp: string; requestId: string } }).meta;
      expect(meta.timestamp).toBeDefined();
      expect(meta.requestId).toMatch(/^req_/);
    });
  });

  describe('created()', () => {
    it('should return 201 with default message', () => {
      const response = created({ id: 'new-id' });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Recurso criado com sucesso.',
        id: 'new-id',
      });
    });

    it('should return 201 with custom message', () => {
      const response = created({ id: 'new-id' }, 'Produto criado.');
      expect(response.body).toMatchObject({
        message: 'Produto criado.',
      });
    });
  });

  describe('success()', () => {
    it('should return 200 with message', () => {
      const response = success('Recurso deletado.');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Recurso deletado.',
      });
    });
  });
});

describe('Error Responses', () => {
  describe('badRequest()', () => {
    it('should return 400 with error details', () => {
      const response = badRequest('Dados inválidos.', { name: ['Nome é obrigatório'] });
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Dados inválidos.',
        errorCode: 'BAD_REQUEST',
        details: { name: ['Nome é obrigatório'] },
      });
    });

    it('should return 400 without details', () => {
      const response = badRequest('Requisição inválida.');
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'BAD_REQUEST',
      });
      expect((response.body as { details?: unknown }).details).toBeUndefined();
    });
  });

  describe('unauthorized()', () => {
    it('should return 401 with default message', () => {
      const response = unauthorized();
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Não autenticado.',
        errorCode: 'UNAUTHORIZED',
      });
    });

    it('should return 401 with custom message', () => {
      const response = unauthorized('Token expirado.');
      expect(response.body).toMatchObject({
        message: 'Token expirado.',
      });
    });
  });

  describe('forbidden()', () => {
    it('should return 403 with default message', () => {
      const response = forbidden();
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Acesso negado.',
        errorCode: 'FORBIDDEN',
      });
    });
  });

  describe('notFound()', () => {
    it('should return 404 with default message', () => {
      const response = notFound();
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Recurso não encontrado.',
        errorCode: 'NOT_FOUND',
      });
    });
  });

  describe('conflict()', () => {
    it('should return 409 with custom message', () => {
      const response = conflict('Username já existe.');
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Username já existe.',
        errorCode: 'CONFLICT',
      });
    });
  });

  describe('internalError()', () => {
    it('should return 500 with default message', () => {
      const response = internalError();
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Erro interno do servidor.',
        errorCode: 'INTERNAL_ERROR',
      });
    });

    it('should return 500 with custom message', () => {
      const response = internalError('Database connection failed.');
      expect(response.body).toMatchObject({
        message: 'Database connection failed.',
      });
    });
  });
});

describe('fromError()', () => {
  it('should return 403 for Forbidden errors', () => {
    const response = fromError(new Error('Forbidden'));
    expect(response.status).toBe(403);
  });

  it('should return 401 for Unauthorized errors', () => {
    const response = fromError(new Error('Unauthorized'));
    expect(response.status).toBe(401);
  });

  it('should return 500 for generic errors', () => {
    const response = fromError(new Error('Something broke'));
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      message: 'Something broke',
    });
  });

  it('should return 500 for non-Error values', () => {
    const response = fromError('string error');
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      errorCode: 'INTERNAL_ERROR',
    });
  });
});

describe('paginated()', () => {
  it('should return 200 with pagination metadata', () => {
    const data = [{ id: '1' }, { id: '2' }];
    const response = paginated(data, 10, 1, 2);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data,
      meta: {
        page: 1,
        pageSize: 2,
        total: 10,
      },
    });
  });
});
