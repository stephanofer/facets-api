import { Transform, type TransformFnParams } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({
    description: 'Visible workspace name shared across the product',
    example: 'Casa',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trimString)
  name?: string;
}
