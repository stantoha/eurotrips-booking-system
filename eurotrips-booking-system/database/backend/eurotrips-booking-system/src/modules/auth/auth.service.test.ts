// =============================================================================
// EUROTRIPS — Auth Service Unit Tests
// Запуск: npm test
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole } from '@prisma/client';

// ── Моки ──────────────────────────────────────────────────────────────────
vi.mock('../../shared/database/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

import prisma from '../../shared/database/prisma';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AppError } from '../../shared/utils/errors';

// ── Фікстури ──────────────────────────────────────────────────────────────
const mockUser = {
  id: 'user-001',
  email: 'test@eurotrips.ua',
  passwordHash: '$2b$12$hashedpassword',
  role: UserRole.manager,
  firstName: 'Тест',
  lastName: 'Юзер',
  phone: null,
  isActive: true,
  lastLoginAt: null,
  agentProfile: null,
};

const mockApp = {
  jwt: {
    sign: vi.fn().mockReturnValue('mock_token'),
    verify: vi.fn().mockReturnValue({ sub: 'user-001' }),
  },
  redis: {
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue('mock_refresh_token'),
    del: vi.fn().mockResolvedValue(1),
  },
  log: { info: vi.fn(), error: vi.fn() },
} as any;

// ── Tests ──────────────────────────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(mockApp);
  });

  // ── Login ────────────────────────────────────────────────────────────────
  describe('login()', () => {
    it('має повертати токени при правильних даних', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser as any);

      const result = await service.login({
        email: 'test@eurotrips.ua',
        password: 'Password123',
      });

      expect(result.user.email).toBe('test@eurotrips.ua');
      expect(result.tokens.accessToken).toBe('mock_token');
      expect(result.refreshToken).toBe('mock_token');
    });

    it('має кидати 401 якщо юзер не знайдений', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'notexist@eurotrips.ua', password: '123456' })
      ).rejects.toThrow(AppError);

      await expect(
        service.login({ email: 'notexist@eurotrips.ua', password: '123456' })
      ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
    });

    it('має кидати 401 якщо пароль невірний', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

      await expect(
        service.login({ email: 'test@eurotrips.ua', password: 'wrong' })
      ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
    });

    it('має кидати 401 якщо юзер заблокований (isActive: false)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(
        service.login({ email: 'test@eurotrips.ua', password: 'Password123' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  // ── Register ─────────────────────────────────────────────────────────────
  describe('register()', () => {
    it('має створювати нового юзера і повертати токени', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(bcrypt.hash).mockResolvedValueOnce('$2b$12$hashed' as never);
      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser as any);

      const result = await service.register({
        email: 'new@eurotrips.ua',
        password: 'Password123',
        firstName: 'Новий',
        lastName: 'Юзер',
      });

      expect(result.user).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalledOnce();
    });

    it('має кидати 409 якщо email вже існує', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

      await expect(
        service.register({
          email: 'test@eurotrips.ua',
          password: 'Password123',
          firstName: 'Тест',
          lastName: 'Юзер',
        })
      ).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_TAKEN' });
    });
  });

  // ── Refresh ───────────────────────────────────────────────────────────────
  describe('refresh()', () => {
    it('має повертати нові токени при валідному refresh token', async () => {
      mockApp.jwt.verify.mockReturnValueOnce({ sub: 'user-001' });
      mockApp.redis.get.mockResolvedValueOnce('mock_refresh_token');
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

      const result = await service.refresh('mock_refresh_token');

      expect(result.tokens.accessToken).toBe('mock_token');
      expect(mockApp.redis.del).toHaveBeenCalledWith('refresh_token:user-001');
    });

    it('має кидати 401 якщо refresh token невалідний', async () => {
      mockApp.jwt.verify.mockImplementationOnce(() => {
        throw new Error('invalid token');
      });

      await expect(service.refresh('invalid')).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('має кидати 401 якщо refresh token відсутній у Redis', async () => {
      mockApp.jwt.verify.mockReturnValueOnce({ sub: 'user-001' });
      mockApp.redis.get.mockResolvedValueOnce(null);

      await expect(service.refresh('token_not_in_redis')).rejects.toMatchObject({
        statusCode: 401,
        code: 'REFRESH_TOKEN_REVOKED',
      });
    });
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  describe('logout()', () => {
    it('має видаляти refresh token з Redis', async () => {
      await service.logout('user-001');

      expect(mockApp.redis.del).toHaveBeenCalledWith('refresh_token:user-001');
    });
  });
});
