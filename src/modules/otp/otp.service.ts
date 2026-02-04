import { Injectable, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import { OtpRepository } from '@modules/otp/otp.repository';
import { OtpType, OtpCode } from '../../generated/prisma/client';
import { OTP_CONSTANTS, ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';

export interface OtpGenerationResult {
  code: string;
  expiresAt: Date;
  otpId: string;
}

export interface OtpVerificationResult {
  valid: boolean;
  userId: string;
  otpId: string;
}

@Injectable()
export class OtpService {
  constructor(private readonly otpRepository: OtpRepository) {}

  /**
   * Generate a new OTP code for a user
   *
   * This method:
   * 1. Checks rate limit (max 5 OTPs per hour)
   * 2. Checks cooldown (min 60s between requests)
   * 3. Invalidates previous OTPs of the same type
   * 4. Creates a new OTP
   */
  async generate(userId: string, type: OtpType): Promise<OtpGenerationResult> {
    // Check rate limit (5 OTPs per hour)
    await this.checkRateLimit(userId, type);

    // Check cooldown (60 seconds between requests)
    await this.checkCooldown(userId, type);

    // Invalidate previous OTPs of this type
    await this.otpRepository.invalidateAllForUser(userId, type);

    // Generate 6-digit OTP code
    const code = this.generateSecureCode();

    // Calculate expiry (10 minutes)
    const expiresAt = new Date(
      Date.now() + OTP_CONSTANTS.EXPIRY_MINUTES * 60 * 1000,
    );

    // Save OTP to database
    const otp = await this.otpRepository.create({
      code,
      type,
      userId,
      expiresAt,
    });

    return {
      code,
      expiresAt,
      otpId: otp.id,
    };
  }

  /**
   * Verify an OTP code
   *
   * This method:
   * 1. Finds the OTP by code, user, and type
   * 2. Checks if it's expired
   * 3. Checks if max attempts exceeded
   * 4. Increments attempts if invalid
   * 5. Marks as used if valid
   */
  async verify(
    code: string,
    userId: string,
    type: OtpType,
  ): Promise<OtpVerificationResult> {
    // Find the most recent active OTP for this user and type
    const otp = await this.otpRepository.findActiveOtp(userId, type);

    if (!otp) {
      throw new BusinessException(
        ERROR_CODES.INVALID_OTP,
        'Invalid or expired verification code',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if expired
    if (otp.expiresAt < new Date()) {
      throw new BusinessException(
        ERROR_CODES.OTP_EXPIRED,
        'Verification code has expired. Please request a new one.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if max attempts exceeded
    if (otp.attempts >= otp.maxAttempts) {
      throw new BusinessException(
        ERROR_CODES.OTP_MAX_ATTEMPTS,
        'Too many failed attempts. Please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Verify the code
    if (otp.code !== code) {
      // Increment attempts
      await this.otpRepository.incrementAttempts(otp.id);

      const remainingAttempts = otp.maxAttempts - otp.attempts - 1;
      throw new BusinessException(
        ERROR_CODES.INVALID_OTP,
        `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Mark OTP as used
    await this.otpRepository.markAsUsed(otp.id);

    return {
      valid: true,
      userId: otp.userId,
      otpId: otp.id,
    };
  }

  /**
   * Check if user has exceeded rate limit (5 OTPs per hour)
   */
  private async checkRateLimit(userId: string, type: OtpType): Promise<void> {
    const recentCount = await this.otpRepository.countRecentOtps(userId, type);

    if (recentCount >= OTP_CONSTANTS.RATE_LIMIT_PER_HOUR) {
      throw new BusinessException(
        ERROR_CODES.OTP_RATE_LIMITED,
        'Too many verification requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Check cooldown period (60 seconds between requests)
   */
  private async checkCooldown(userId: string, type: OtpType): Promise<void> {
    const mostRecent = await this.otpRepository.findMostRecent(userId, type);

    if (!mostRecent) {
      return; // No previous OTP, no cooldown needed
    }

    const cooldownEnd = new Date(
      mostRecent.createdAt.getTime() + OTP_CONSTANTS.COOLDOWN_SECONDS * 1000,
    );

    if (cooldownEnd > new Date()) {
      const remainingSeconds = Math.ceil(
        (cooldownEnd.getTime() - Date.now()) / 1000,
      );
      throw new BusinessException(
        ERROR_CODES.OTP_COOLDOWN,
        `Please wait ${remainingSeconds} seconds before requesting a new code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Generate a cryptographically secure 6-digit OTP code
   */
  private generateSecureCode(): string {
    // Generate random bytes and convert to a 6-digit number
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    const code = (randomNumber % 900000) + 100000; // Ensures 6 digits (100000-999999)
    return code.toString();
  }

  /**
   * Get OTP configuration (for use in email templates)
   */
  getExpiryMinutes(): number {
    return OTP_CONSTANTS.EXPIRY_MINUTES;
  }
}
