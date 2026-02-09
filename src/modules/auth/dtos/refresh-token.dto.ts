import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO for refresh token operations
 *
 * The refreshToken field is optional because:
 * - Web clients: send refresh token via HttpOnly cookie (more secure against XSS)
 * - Mobile/native clients: send refresh token in the request body (stored in device Secure Storage)
 */
export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token received during login or previous refresh. Required for mobile clients. Web clients can omit this and use the HttpOnly cookie instead.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Refresh token is required' })
  refreshToken?: string;
}
