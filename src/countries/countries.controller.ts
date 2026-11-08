import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { CountriesService, CountryResponse } from './countries.service';

@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getCountries(@Query('search') search?: string): CountryResponse[] {
    return this.countriesService.findAll(undefined, search);
  }
}

