import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { User, UserStatus, Prisma } from '../../generated/prisma/client';

export type UserWithoutPassword = Omit<User, 'password'>;

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user
   */
  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        status: UserStatus.PENDING_VERIFICATION,
        emailVerified: false,
      },
    });
  }

  /**
   * Find a user by their unique ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
  }

  /**
   * Find a user by email (case-insensitive)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  /**
   * Check if an email is already registered
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!user;
  }

  /**
   * Update user's email verification status
   */
  async markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
      },
    });
  }

  /**
   * Update user's password
   */
  async updatePassword(userId: string, hashedPassword: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  /**
   * Update user's status
   */
  async updateStatus(userId: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }

  /**
   * Soft delete a user
   */
  async softDelete(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: UserStatus.DELETED,
      },
    });
  }

  /**
   * Update user profile fields
   */
  async update(userId: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
