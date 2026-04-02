import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '@common/decorators/current-principal.decorator';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { MeOnboardingResponseDto } from '@modules/me/dtos/onboarding-response.dto';
import { MeProfileResponseDto } from '@modules/me/dtos/profile-response.dto';
import { UpdateOnboardingDto } from '@modules/me/dtos/update-onboarding.dto';
import { UpdateProfileDto } from '@modules/me/dtos/update-profile.dto';
import { MeService } from '@modules/me/me.service';

@ApiTags('Me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Return the authenticated user profile summary owned by UserProfile. This surface includes phone, countryCode, theme, and onboardingCompletedAt only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user profile',
    type: MeProfileResponseDto,
  })
  async getProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MeProfileResponseDto> {
    return this.meService.getProfile(principal.sub);
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'Update user-owned profile fields only. This route validates E.164 phone numbers, active countries, and theme values without mutating onboarding completion or workspace-scoped settings.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
    type: MeProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid phone, inactive country, or invalid theme value',
  })
  async updateProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateProfileDto,
  ): Promise<MeProfileResponseDto> {
    return this.meService.updateProfile(principal.sub, dto);
  }

  @Get('onboarding')
  @ApiOperation({
    summary: 'Get onboarding state',
    description:
      'Return onboarding completion state only. This surface exposes onboardingCompletedAt and needsOnboarding without leaking profile-owned phone, theme, or countryCode fields.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current onboarding state',
    type: MeOnboardingResponseDto,
  })
  async getOnboarding(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MeOnboardingResponseDto> {
    return this.meService.getOnboarding(principal.sub);
  }

  @Patch('onboarding')
  @ApiOperation({
    summary: 'Update onboarding state',
    description:
      'Update onboarding completion state only. Extra fields like phone, theme, or countryCode are rejected by request validation, and completion state is derived exclusively from onboardingCompletedAt.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Onboarding state updated successfully',
    type: MeOnboardingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid onboarding payload or forbidden extra fields',
  })
  async updateOnboarding(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateOnboardingDto,
  ): Promise<MeOnboardingResponseDto> {
    return this.meService.updateOnboarding(principal.sub, dto);
  }
}
