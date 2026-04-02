import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReferenceCountryResponseDto } from '@modules/reference/dtos/reference-country-response.dto';
import { ReferenceCurrencyResponseDto } from '@modules/reference/dtos/reference-currency-response.dto';
import { ReferenceService } from '@modules/reference/reference.service';

@ApiTags('Reference')
@ApiBearerAuth()
@Controller('reference')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get('countries')
  @ApiOperation({
    summary: 'List active countries',
    description:
      'Return active country reference rows only for onboarding and profile forms.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active countries',
    type: ReferenceCountryResponseDto,
    isArray: true,
  })
  async getCountries(): Promise<ReferenceCountryResponseDto[]> {
    return this.referenceService.getCountries();
  }

  @Get('currencies')
  @ApiOperation({
    summary: 'List active currencies',
    description:
      'Return active currency reference rows only for workspace and onboarding flows.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active currencies',
    type: ReferenceCurrencyResponseDto,
    isArray: true,
  })
  async getCurrencies(): Promise<ReferenceCurrencyResponseDto[]> {
    return this.referenceService.getCurrencies();
  }
}
