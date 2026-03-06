const mockSend = jest.fn();
const mockS3Client = jest.fn().mockImplementation(() => ({
  send: mockSend,
}));
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  class PutObjectCommand {
    constructor(public readonly input: unknown) {}
  }

  class DeleteObjectCommand {
    constructor(public readonly input: unknown) {}
  }

  class GetObjectCommand {
    constructor(public readonly input: unknown) {}
  }

  return {
    S3Client: mockS3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { ConfigService } from '@config/config.service';
import { R2StorageProvider } from '@storage/providers/r2-storage.provider';

describe('R2StorageProvider', () => {
  const configService = {
    storage: {
      endpoint: 'https://account-id.r2.cloudflarestorage.com',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      publicBucket: 'facets-public',
      privateBucket: 'facets-private',
      publicUrl: 'https://cdn.facets.test',
    },
  } as ConfigService;

  beforeEach(() => {
    mockSend.mockReset();
    mockS3Client.mockClear();
    mockGetSignedUrl.mockReset();
  });

  it('should initialize the S3 client with the configured R2 endpoint and credentials', () => {
    new R2StorageProvider(configService);

    expect(mockS3Client).toHaveBeenCalledWith({
      region: 'auto',
      endpoint: 'https://account-id.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key',
      },
    });
  });

  it('should upload objects with the default cache control header', async () => {
    const provider = new R2StorageProvider(configService);

    await provider.upload({
      bucket: 'facets-public',
      key: 'avatars/file.webp',
      body: Buffer.from('image'),
      mimeType: 'image/webp',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: 'facets-public',
          Key: 'avatars/file.webp',
          Body: Buffer.from('image'),
          ContentType: 'image/webp',
          CacheControl: 'max-age=31536000, immutable',
        },
      }),
    );
  });

  it('should honor an explicit cache control header when provided', async () => {
    const provider = new R2StorageProvider(configService);

    await provider.upload({
      bucket: 'facets-public',
      key: 'avatars/file.webp',
      body: Buffer.from('image'),
      mimeType: 'image/webp',
      cacheControl: 'no-store',
    });

    const [[command]] = mockSend.mock.calls as [
      [{ input: { CacheControl?: string } }],
    ];

    expect(command.input.CacheControl).toBe('no-store');
  });

  it('should delete objects from the configured bucket', async () => {
    const provider = new R2StorageProvider(configService);

    await provider.delete('facets-private', 'receipts/file.pdf');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: 'facets-private',
          Key: 'receipts/file.pdf',
        },
      }),
    );
  });

  it('should generate presigned urls using the sdk presigner', async () => {
    const provider = new R2StorageProvider(configService);

    mockGetSignedUrl.mockResolvedValue('https://signed.facets.test/file.pdf');

    await expect(
      provider.getPresignedUrl('facets-private', 'receipts/file.pdf', 900),
    ).resolves.toBe('https://signed.facets.test/file.pdf');

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        send: mockSend,
      }),
      expect.objectContaining({
        input: {
          Bucket: 'facets-private',
          Key: 'receipts/file.pdf',
        },
      }),
      { expiresIn: 900 },
    );
  });

  it('should fail fast when required credentials are missing', () => {
    const invalidConfig = {
      storage: {
        ...configService.storage,
        accessKeyId: undefined,
      },
    } as ConfigService;

    expect(() => new R2StorageProvider(invalidConfig)).toThrow(
      'Missing required storage configuration: R2_ACCESS_KEY_ID',
    );
  });

  it('should fail fast when the secret access key is missing', () => {
    const invalidConfig = {
      storage: {
        ...configService.storage,
        secretAccessKey: undefined,
      },
    } as ConfigService;

    expect(() => new R2StorageProvider(invalidConfig)).toThrow(
      'Missing required storage configuration: R2_SECRET_ACCESS_KEY',
    );
  });
});
