import { Injectable } from '@nestjs/common';
import {
  UsersRepository,
  UserWithoutPassword,
  CreateUserData,
} from '@modules/users/users.repository';
import { User, UserStatus } from '../../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Create a new user
   */
  async create(data: CreateUserData): Promise<User> {
    return this.usersRepository.create(data);
  }

  /**
   * Find a user by ID (returns null if not found or deleted)
   */
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  /**
   * Check if an email is already registered
   */
  async emailExists(email: string): Promise<boolean> {
    return this.usersRepository.emailExists(email);
  }

  /**
   * Mark user's email as verified and activate account
   */
  async verifyEmail(userId: string): Promise<User> {
    return this.usersRepository.markEmailVerified(userId);
  }

  /**
   * Update user's password
   */
  async updatePassword(userId: string, hashedPassword: string): Promise<User> {
    return this.usersRepository.updatePassword(userId, hashedPassword);
  }

  /**
   * Get user without password field (for responses)
   */
  excludePassword(user: User): UserWithoutPassword {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Check if user status allows login
   */
  canLogin(user: User): { allowed: boolean; reason?: string } {
    switch (user.status) {
      case UserStatus.PENDING_VERIFICATION:
        return { allowed: false, reason: 'EMAIL_NOT_VERIFIED' };
      case UserStatus.SUSPENDED:
        return { allowed: false, reason: 'ACCOUNT_SUSPENDED' };
      case UserStatus.DELETED:
        return { allowed: false, reason: 'ACCOUNT_DELETED' };
      case UserStatus.ACTIVE:
        return { allowed: true };
      default:
        return { allowed: false, reason: 'UNKNOWN_STATUS' };
    }
  }
}
