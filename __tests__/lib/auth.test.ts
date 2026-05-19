// @ts-nocheck

/**
 * Tests for app/lib/auth.ts
 * Covers: hashPassword, comparePassword, generateJWT, verifyJWT, requireAuth, requireRole
 */

// Mock dependencies
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('../../app/lib/data', () => ({
  userData: {
    getByUsername: jest.fn(),
  },
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { hashPassword, comparePassword, generateJWT, verifyJWT, requireAuth, requireRole } from '../../app/lib/auth';
import { User } from '../../types';

const mockUser: User = {
  id: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  password: '$2a$10$hashedpassword',
  role: 'admin',
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing';
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe('hashPassword', () => {
  it('should call bcrypt.hash with password and cost 10', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$10$hashed');
    const result = await hashPassword('mypassword');
    expect(bcrypt.hash).toHaveBeenCalledWith('mypassword', 10);
    expect(result).toBe('$2a$10$hashed');
  });
});

describe('comparePassword', () => {
  it('should return true when passwords match', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const result = await comparePassword('mypassword', '$2a$10$hashed');
    expect(result).toBe(true);
  });

  it('should return false when passwords do not match', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const result = await comparePassword('wrong', '$2a$10$hashed');
    expect(result).toBe(false);
  });
});

describe('generateJWT', () => {
  it('should call jwt.sign with user payload and secret', () => {
    (jwt.sign as jest.Mock).mockReturnValue('token123');
    const result = generateJWT(mockUser);
    expect(jwt.sign).toHaveBeenCalledWith(
      { id: mockUser.id, username: mockUser.username, role: mockUser.role },
      'test-secret-key-for-jwt-signing',
      { expiresIn: '1h' }
    );
    expect(result).toBe('token123');
  });

  it('should throw if JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;
    expect(() => generateJWT(mockUser)).toThrow('JWT_SECRET');
  });
});

describe('verifyJWT', () => {
  it('should return payload when token is valid', () => {
    const payload = { id: 'user-123', username: 'testuser', role: 'admin' };
    (jwt.verify as jest.Mock).mockReturnValue(payload);
    const result = verifyJWT('valid-token');
    expect(result).toEqual(payload);
  });

  it('should return null when token is invalid', () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid token');
    });
    const result = verifyJWT('invalid-token');
    expect(result).toBeNull();
  });

  it('should re-throw JWT_SECRET errors', () => {
    delete process.env.JWT_SECRET;
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('JWT_SECRET deve ser configurado');
    });
    expect(() => verifyJWT('token')).toThrow('JWT_SECRET');
  });
});

describe('requireAuth', () => {
  function makeRequest(authHeader?: string): Request {
    const headers = new Headers();
    if (authHeader) headers.set('authorization', authHeader);
    return new Request('http://localhost/api/test', { headers });
  }

  it('should throw Unauthorized if no authorization header', () => {
    expect(() => requireAuth(makeRequest())).toThrow('Unauthorized');
  });

  it('should throw Unauthorized if header is not Bearer format', () => {
    expect(() => requireAuth(makeRequest('Basic abc123'))).toThrow('Unauthorized');
  });

  it('should throw Unauthorized if token is invalid', () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid');
    });
    expect(() => requireAuth(makeRequest('Bearer invalid-token'))).toThrow('Unauthorized');
  });

  it('should return userId and role for valid token', () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      id: 'user-123',
      username: 'testuser',
      role: 'admin',
    });
    const result = requireAuth(makeRequest('Bearer valid-token'));
    expect(result).toEqual({ userId: 'user-123', role: 'admin' });
  });
});

describe('requireRole', () => {
  function makeRequest(authHeader?: string): Request {
    const headers = new Headers();
    if (authHeader) headers.set('authorization', authHeader);
    return new Request('http://localhost/api/test', { headers });
  }

  it('should return payload when user has required role', () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      id: 'user-123',
      username: 'testuser',
      role: 'admin',
    });
    const result = requireRole(makeRequest('Bearer valid-token'), ['admin']);
    expect(result.role).toBe('admin');
  });

  it('should throw Forbidden when user lacks required role', () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      id: 'user-123',
      username: 'seller1',
      role: 'seller',
    });
    expect(() => requireRole(makeRequest('Bearer valid-token'), ['admin'])).toThrow('Forbidden');
  });

  it('should allow multiple roles', () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      id: 'user-123',
      username: 'seller1',
      role: 'seller',
    });
    const result = requireRole(makeRequest('Bearer valid-token'), ['admin', 'seller']);
    expect(result.role).toBe('seller');
  });
});
