import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@common/constants/app.constants';

export class BusinessException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>[],
  ) {
    super({ code, message, details }, status);
  }
}
