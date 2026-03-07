import { HttpStatus, Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_CODES } from '@common/constants/app.constants';
import { PrismaService } from '@database/prisma.service';
import {
  File as StoredFile,
  FilePurpose,
  Prisma,
  User,
  UserStatus,
} from '../../generated/prisma/client';

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

  /**
   * Find the active avatar file for a user profile
   */
  async findAvatarByUserId(userId: string): Promise<StoredFile | null> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: {
        avatarFile: true,
      },
    });

    if (!profile?.avatarFile || profile.avatarFile.deletedAt) {
      return null;
    }

    return profile.avatarFile;
  }

  /**
   * Replace the current avatar atomically and soft-delete the previous file
   */
  async replaceAvatar(
    userId: string,
    newAvatarFileId: string,
  ): Promise<StoredFile> {
    return this.prisma.$transaction(
      async (tx) => {
        const newAvatar = await tx.file.findFirst({
          where: {
            id: newAvatarFileId,
            userId,
            purpose: FilePurpose.AVATAR,
            deletedAt: null,
          },
        });

        if (!newAvatar) {
          throw new BusinessException(
            ERROR_CODES.AVATAR_FILE_NOT_FOUND,
            'Avatar file not found for user',
            HttpStatus.NOT_FOUND,
          );
        }

        const currentProfile = await tx.userProfile.findUnique({
          where: { userId },
          select: { avatarFileId: true },
        });

        await tx.userProfile.upsert({
          where: { userId },
          create: {
            userId,
            avatarFileId: newAvatarFileId,
          },
          update: {
            avatarFileId: newAvatarFileId,
          },
        });

        if (
          currentProfile?.avatarFileId &&
          currentProfile.avatarFileId !== newAvatarFileId
        ) {
          await tx.file.update({
            where: { id: currentProfile.avatarFileId },
            data: {
              deletedAt: new Date(),
            },
          });
        }

        return newAvatar;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /**
   * Remove the current avatar association and soft-delete the file if present
   */
  async removeAvatar(userId: string): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const profile = await tx.userProfile.findUnique({
          where: { userId },
          select: { avatarFileId: true },
        });

        if (!profile?.avatarFileId) {
          return;
        }

        await tx.userProfile.update({
          where: { userId },
          data: {
            avatarFileId: null,
          },
        });

        await tx.file.update({
          where: { id: profile.avatarFileId },
          data: {
            deletedAt: new Date(),
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}
