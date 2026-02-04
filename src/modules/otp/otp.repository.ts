import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { OtpCode, OtpType } from '../../generated/prisma/client';
import { OTP_CONSTANTS } from '@common/constants/app.constants';

export interface CreateOtpData {
  code: string;
  type: OtpType;
  userId: string;
  expiresAt: Date;
}

@Injectable()
export class OtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new OTP code
   */
  async create(data: CreateOtpData): Promise<OtpCode> {
    return this.prisma.otpCode.create({
      data: {
        code: data.code,
        type: data.type,
        userId: data.userId,
        expiresAt: data.expiresAt,
        maxAttempts: OTP_CONSTANTS.MAX_ATTEMPTS,
      },
    });
  }

  /**
   * Find an active (unused, not expired) OTP for a user and type
   */
  async findActiveOtp(userId: string, type: OtpType): Promise<OtpCode | null> {
    return this.prisma.otpCode.findFirst({
      where: {
        userId,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find OTP by code, user, and type (for verification)
   */
  async findByCodeAndUser(
    code: string,
    userId: string,
    type: OtpType,
  ): Promise<OtpCode | null> {
    return this.prisma.otpCode.findFirst({
      where: {
        code,
        userId,
        type,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Increment attempt count for an OTP
   */
  async incrementAttempts(id: string): Promise<OtpCode> {
    return this.prisma.otpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  /**
   * Mark OTP as used
   */
  async markAsUsed(id: string): Promise<OtpCode> {
    return this.prisma.otpCode.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  /**
   * Invalidate all OTPs of a specific type for a user
   * (used when generating a new OTP to invalidate previous ones)
   */
  async invalidateAllForUser(userId: string, type: OtpType): Promise<number> {
    const result = await this.prisma.otpCode.updateMany({
      where: {
        userId,
        type,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
    return result.count;
  }

  /**
   * Count OTPs created for a user in the last hour (for rate limiting)
   */
  async countRecentOtps(userId: string, type: OtpType): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.prisma.otpCode.count({
      where: {
        userId,
        type,
        createdAt: { gte: oneHourAgo },
      },
    });
  }

  /**
   * Get the most recent OTP for cooldown check
   */
  async findMostRecent(userId: string, type: OtpType): Promise<OtpCode | null> {
    return this.prisma.otpCode.findFirst({
      where: {
        userId,
        type,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete expired OTPs (for cleanup job)
   */
  async deleteExpired(): Promise<number> {
    const result = await this.prisma.otpCode.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
        createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // older than 24h
      },
    });
    return result.count;
  }
}
