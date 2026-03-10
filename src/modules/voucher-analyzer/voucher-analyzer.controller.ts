import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { AnalyzeVoucherUploadDto } from '@modules/voucher-analyzer/dtos/analyze-voucher-upload.dto';
import { VoucherAnalysisResponseDto } from '@modules/voucher-analyzer/dtos/voucher-analysis-response.dto';
import { VoucherAnalyzerService } from '@modules/voucher-analyzer/voucher-analyzer.service';
import {
  createFileValidators,
  TRANSIENT_UPLOAD_PURPOSES,
} from '@storage/config/file-purpose.config';

@ApiTags('Voucher Analyzer')
@ApiBearerAuth()
@Controller('voucher-analyzer')
export class VoucherAnalyzerController {
  constructor(
    private readonly voucherAnalyzerService: VoucherAnalyzerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Analyze voucher image',
    description:
      'Analyze an uploaded voucher image and return structured extraction data or a NOT_VOUCHER outcome.',
  })
  @ApiBody({ type: AnalyzeVoucherUploadDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Voucher analysis completed successfully',
    type: VoucherAnalysisResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Invalid file type or invalid file content',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async analyze(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      createFileValidators(TRANSIENT_UPLOAD_PURPOSES.VOUCHER_ANALYSIS),
    )
    file: Express.Multer.File,
    @Req() request: Request & { id?: string },
  ): Promise<VoucherAnalysisResponseDto> {
    return this.voucherAnalyzerService.analyze(user.sub, file, request.id);
  }
}
