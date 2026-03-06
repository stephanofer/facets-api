export interface UploadParams {
  bucket: string;
  key: string;
  body: Buffer;
  mimeType: string;
  cacheControl?: string;
}

export interface StorageProvider {
  upload(params: UploadParams): Promise<void>;
  delete(bucket: string, key: string): Promise<void>;
  getPresignedUrl(
    bucket: string,
    key: string,
    expiresInSeconds: number,
  ): Promise<string>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
