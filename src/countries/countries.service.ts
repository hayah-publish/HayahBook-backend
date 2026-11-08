import { Injectable } from '@nestjs/common';
import { COUNTRIES } from './countries.data';
import { I18nService } from '../i18n/i18n.service';
import { SupportedLanguage } from '../i18n/i18n.types';

export interface CountryResponse {
  id: string;
  displayName: string;
  name_ar: string;
  name_en: string;
  flagUrl: string;
}

@Injectable()
export class CountriesService {
  constructor(private readonly i18n: I18nService) {}

  findAll(lang?: SupportedLanguage, search?: string): CountryResponse[] {
    const currentLang = lang || this.i18n.getCurrentLanguage();
    let result = COUNTRIES.map((c) => ({
      id: c.id,
      displayName: currentLang === 'en' ? c.name_en : c.name_ar,
      name_ar: c.name_ar,
      name_en: c.name_en,
      flagUrl: c.flagUrl,
    }));

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name_ar.toLowerCase().includes(q) ||
          c.name_en.toLowerCase().includes(q),
      );
    }

    return result;
  }

  findById(id: string): CountryResponse | undefined {
    const currentLang = this.i18n.getCurrentLanguage();
    const c = COUNTRIES.find((item) => item.id.toLowerCase() === id.toLowerCase());
    if (!c) return undefined;
    return {
      id: c.id,
      displayName: currentLang === 'en' ? c.name_en : c.name_ar,
      name_ar: c.name_ar,
      name_en: c.name_en,
      flagUrl: c.flagUrl,
    };
  }

  resolveCountry(countryInput?: string | null) {
    return this.i18n.resolveCountry(countryInput);
  }

  formatCountry(countryValue?: string | null, lang?: SupportedLanguage): string | null {
    return this.i18n.formatCountry(countryValue, lang);
  }
}

