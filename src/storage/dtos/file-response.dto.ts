import { ApiProperty } from '@nestjs/swagger';
import { FilePurpose } from '../../generated/prisma/client';

export class FileResponseDto {
  @ApiProperty({ example: 'cm8storage0001jn08abc12345' })
  id: string;

  @ApiProperty({
    example:
      'https://pub-xxx.r2.dev/avatars/550e8400-e29b-41d4-a716-446655440000.webp',
  })
  url: string;

  @ApiProperty({ example: 'image/webp' })
  mimeType: string;

  @ApiProperty({ example: 45200 })
  size: number;

  @ApiProperty({
    enum: FilePurpose,
    example: FilePurpose.AVATAR,
  })
  purpose: FilePurpose;
}
