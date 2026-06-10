// =============================================================================
// EUROTRIPS — Auth Service
// Логіка: login, register, refresh token, logout
// Refresh Token зберігається в Redis (HttpOnly Cookie)
// =============================================================================

import bcrypt from 'bcrypt';
import { FastifyInstance } from 'fastify';
import { UserRole } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { config } from '../../config';
import { AppError } from '../../shared/utils/errors';
import type { JwtPayload, TokenPair, AuthUser } from './auth.types';
import type { LoginDto, RegisterDto } from './auth.schema';

const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 днів

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  // ── LOGIN ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto): Promise<{ user: AuthUser; tokens: TokenPair; refreshToken: string }> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        agentProfile: {
          select: {
            id: true,
            agentType: true,
            networkId: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AppError('INVALID_CREDENTIALS', 'Невірний email або пароль', 401);
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Невірний email або пароль', 401);
    }

    // Оновлюємо lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const authUser = this.toAuthUser(user);
    const tokens = await this.generateTokens(authUser);
    const refreshToken = await this.createRefreshToken(user.id);

    return { user: authUser, tokens, refreshToken };
  }

  // ── REGISTER ─────────────────────────────────────────────────────────────
  async register(dto: RegisterDto): Promise<{ user: AuthUser; tokens: TokenPair; refreshToken: string }> {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new AppError('EMAIL_TAKEN', 'Цей email вже зареєстрований', 409);
    }

    const passwordHash = await bcrypt.hash(dto.password, config.BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: (dto.role as UserRole) ?? UserRole.tourist,
        isActive: true,
      },
      include: { agentProfile: { select: { id: true, agentType: true, networkId: true } } },
    });

    const authUser = this.toAuthUser(user);
    const tokens = await this.generateTokens(authUser);
    const refreshToken = await this.createRefreshToken(user.id);

    return { user: authUser, tokens, refreshToken };
  }

  // ── REFRESH ──────────────────────────────────────────────────────────────
  async refresh(refreshToken: string): Promise<{ tokens: TokenPair; newRefreshToken: string }> {
    // Верифікуємо refresh token
    let payload: { sub: string };
    try {
      payload = this.app.jwt.verify<{ sub: string }>(refreshToken);
    } catch {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Недійсний або прострочений refresh token', 401);
    }

    // Перевіряємо чи є в Redis
    const redisKey = `${REFRESH_TOKEN_PREFIX}${payload.sub}`;
    const storedToken = await this.app.redis.get(redisKey);
    if (!storedToken || storedToken !== refreshToken) {
      throw new AppError('REFRESH_TOKEN_REVOKED', 'Refresh token відкликано', 401);
    }

    // Завантажуємо актуального юзера
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { agentProfile: { select: { id: true, agentType: true, networkId: true } } },
    });

    if (!user || !user.isActive) {
      throw new AppError('USER_NOT_FOUND', 'Користувача не знайдено або заблоковано', 401);
    }

    // Ротація refresh token (видаляємо старий, видаємо новий)
    await this.app.redis.del(redisKey);
    const authUser = this.toAuthUser(user);
    const tokens = await this.generateTokens(authUser);
    const newRefreshToken = await this.createRefreshToken(user.id);

    return { tokens, newRefreshToken };
  }

  // ── LOGOUT ───────────────────────────────────────────────────────────────
  // TC-AUTH-015: після logout старий access token має повертати 401
  async logout(userId: string): Promise<void> {
    // 1. Видаляємо refresh token
    await this.app.redis.del(`${REFRESH_TOKEN_PREFIX}${userId}`);
    // 2. Записуємо blacklist: всі токени видані ДО цього timestamp → недійсні
    //    TTL = 15хв (час життя access token)
    await this.app.redis.setex(
      `jwt:blacklist:${userId}`,
      15 * 60,
      String(Math.floor(Date.now() / 1000)) // поточний unix timestamp
    );
  }

  // ── ME ───────────────────────────────────────────────────────────────────
  async getMe(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { agentProfile: { select: { id: true, agentType: true, networkId: true } } },
    });

    if (!user || !user.isActive) {
      throw new AppError('USER_NOT_FOUND', 'Користувача не знайдено', 404);
    }

    return this.toAuthUser(user);
  }

  // ── CHANGE PASSWORD ──────────────────────────────────────────────────────
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('USER_NOT_FOUND', 'Користувача не знайдено', 404);

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AppError('INVALID_PASSWORD', 'Поточний пароль невірний', 400);
    }

    const newHash = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Виходимо з усіх пристроїв
    await this.logout(userId);
  }

  // ── PRIVATE HELPERS ──────────────────────────────────────────────────────

  private toAuthUser(user: any): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      agentId: user.agentProfile?.id ?? null,
      agentType: user.agentProfile?.agentType ?? null,
      networkId: user.agentProfile?.networkId ?? null,
    };
  }

  private async generateTokens(user: AuthUser): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      agentId: user.agentId,
      agentType: user.agentType,
      networkId: user.networkId,
    };

    const accessToken = this.app.jwt.sign(payload, {
      expiresIn: config.JWT_ACCESS_EXPIRES,
    });

    // access token живе 15хв = 900с
    return { accessToken, expiresIn: 15 * 60 };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const token = this.app.jwt.sign(
      { sub: userId },
      { expiresIn: config.JWT_REFRESH_EXPIRES, key: config.JWT_REFRESH_SECRET }
    );

    await this.app.redis.setex(
      `${REFRESH_TOKEN_PREFIX}${userId}`,
      REFRESH_TOKEN_TTL_SECONDS,
      token
    );

    return token;
  }
}
