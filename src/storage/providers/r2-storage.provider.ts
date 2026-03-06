import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@config/config.service';
import {
  StorageProvider,
  UploadParams,
} from '@storage/interfaces/storage-provider.interface';

@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor(private readonly configService: ConfigService) {
    const storageConfig = this.configService.storage;

    this.client = new S3Client({
      region: 'auto',
      endpoint: storageConfig.endpoint,
      credentials: {
        accessKeyId: this.getRequiredStorageValue(
          storageConfig.accessKeyId,
          'R2_ACCESS_KEY_ID',
        ),
        secretAccessKey: this.getRequiredStorageValue(
          storageConfig.secretAccessKey,
          'R2_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async upload(params: UploadParams): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.mimeType,
        CacheControl: params.cacheControl ?? 'max-age=31536000, immutable',
      }),
    );
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  async getPresignedUrl(
    bucket: string,
    key: string,
    expiresInSeconds: number,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  private getRequiredStorageValue(
    value: string | undefined,
    key: string,
  ): string {
    if (!value) {
      throw new Error(`Missing required storage configuration: ${key}`);
    }

    return value;
  }
}
