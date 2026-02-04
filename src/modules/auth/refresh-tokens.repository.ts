import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { RefreshToken } from '../../generated/prisma/client';

export interface CreateRefreshTokenData {
  token: string; // hashed token
  userId: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new refresh token record
   */
  async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    });
  }

  /**
   * Find a refresh token by its hashed value
   */
  async findByToken(hashedToken: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
    });
  }

  /**
   * Find a refresh token by ID
   */
  async findById(id: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { id },
    });
  }

  /**
   * Find all active tokens for a user
   */
  async findActiveByUserId(userId: string): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke a specific token
   */
  async revoke(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke a token by its hashed value
   */
  async revokeByToken(hashedToken: string): Promise<RefreshToken | null> {
    const token = await this.findByToken(hashedToken);
    if (!token) return null;

    return this.revoke(token.id);
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllForUser(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Delete expired tokens (cleanup job)
   */
  async deleteExpired(): Promise<{ count: number }> {
    return this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });
  }

  /**
   * Check if a token is valid (not expired and not revoked)
   */
  isTokenValid(token: RefreshToken): boolean {
    return !token.revokedAt && token.expiresAt > new Date();
  }
}
