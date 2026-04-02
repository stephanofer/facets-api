import { Injectable } from '@nestjs/common';
import { ReferenceCountryResponseDto } from '@modules/reference/dtos/reference-country-response.dto';
import { ReferenceCurrencyResponseDto } from '@modules/reference/dtos/reference-currency-response.dto';
import { ReferenceRepository } from '@modules/reference/reference.repository';

@Injectable()
export class ReferenceService {
  constructor(private readonly referenceRepository: ReferenceRepository) {}

  async getCountries(): Promise<ReferenceCountryResponseDto[]> {
    const countries = await this.referenceRepository.findActiveCountries();

    return countries.map((country) => ({
      code: country.code,
      name: country.name,
      callingCode: country.callingCode,
      defaultCurrencyCode: country.defaultCurrencyCode,
      defaultLocale: country.defaultLocale,
    }));
  }

  async getCurrencies(): Promise<ReferenceCurrencyResponseDto[]> {
    const currencies = await this.referenceRepository.findActiveCurrencies();

    return currencies.map((currency) => ({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimalScale: currency.decimalScale,
    }));
  }
}
