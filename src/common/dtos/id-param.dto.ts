import { IsString, Length } from 'class-validator';

export class IdParamDto {
  @IsString()
  @Length(24, 24, { message: 'Invalid ID format' })
  id: string;
}
