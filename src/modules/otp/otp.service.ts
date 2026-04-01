import { Injectable, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import { OtpRepository } from '@modules/otp/otp.repository';
import { OtpType } from '@/generated/prisma/client';
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
   * 1. Invalidates previous OTPs of the same type
   * 2. Creates a new OTP with the code hashed (SHA-256)
   */
  async generate(userId: string, type: OtpType): Promise<OtpGenerationResult> {
    // Invalidate previous OTPs of this type
    await this.otpRepository.invalidateAllForUser(userId, type);

    // Generate 6-digit OTP code
    const code = this.generateSecureCode();

    // Hash the code before storing (defense in depth — if DB is compromised,
    // attacker can't read active OTPs)
    const hashedCode = this.hashOtp(code);

    // Calculate expiry (10 minutes)
    const expiresAt = new Date(
      Date.now() + OTP_CONSTANTS.EXPIRY_MINUTES * 60 * 1000,
    );

    // Save hashed OTP to database
    const otp = await this.otpRepository.create({
      code: hashedCode,
      type,
      userId,
      expiresAt,
    });

    // Return the plain code (for the email), NOT the hash
    return {
      code,
      expiresAt,
      otpId: otp.id,
    };
  }

  /**
   * Verify an OTP code and consume it (mark as used)
   *
   * This method:
   * 1. Finds the active OTP for this user and type
   * 2. Checks if it's expired
   * 3. Checks if max attempts exceeded
   * 4. Hashes the input and compares against stored hash
   * 5. Marks as used if valid (OTP is ALWAYS consumed on success)
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

    // Hash the input and compare against stored hash
    const hashedInput = this.hashOtp(code);
    if (otp.code !== hashedInput) {
      // Increment attempts
      await this.otpRepository.incrementAttempts(otp.id);

      const remainingAttempts = otp.maxAttempts - otp.attempts - 1;
      throw new BusinessException(
        ERROR_CODES.INVALID_OTP,
        `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Mark OTP as used (always consumed on success)
    await this.otpRepository.markAsUsed(otp.id);

    return {
      valid: true,
      userId: otp.userId,
      otpId: otp.id,
    };
  }

  /**
   * Hash an OTP code with SHA-256 for secure storage
   */
  private hashOtp(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
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
