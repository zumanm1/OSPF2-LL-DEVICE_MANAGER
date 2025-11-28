import { DeviceType, Platform, Software, Protocol } from './types';

export const DEVICE_TYPE_OPTIONS = Object.values(DeviceType);
export const PLATFORM_OPTIONS = Object.values(Platform);
export const SOFTWARE_OPTIONS = Object.values(Software);
export const PROTOCOL_OPTIONS = Object.values(Protocol);

export const COUNTRIES = [
  // Africa
  { name: 'South Africa', code2: 'ZA', code3: 'ZAF', aliases: ['rsa', 'sa'] },
  { name: 'Lesotho', code2: 'LS', code3: 'LSO', aliases: ['les'] },
  { name: 'Democratic Republic of the Congo', code2: 'CD', code3: 'COD', aliases: ['drc', 'congo'] },
  { name: 'Tanzania', code2: 'TZ', code3: 'TZA', aliases: ['tz'] },
  { name: 'Kenya', code2: 'KE', code3: 'KEN', aliases: ['ke'] },
  { name: 'Ethiopia', code2: 'ET', code3: 'ETH', aliases: ['eth'] },
  { name: 'Egypt', code2: 'EG', code3: 'EGY', aliases: ['egy'] },
  { name: 'Nigeria', code2: 'NG', code3: 'NGA', aliases: ['ng'] },
  { name: 'Zimbabwe', code2: 'ZW', code3: 'ZWE', aliases: ['zim', 'zm', 'zimb'] },
  // Europe
  { name: 'United Kingdom', code2: 'GB', code3: 'GBR', aliases: ['uk', 'gbr'] },
  { name: 'France', code2: 'FR', code3: 'FRA', aliases: ['frnc'] },
  { name: 'Portugal', code2: 'PT', code3: 'PRT', aliases: ['pt'] },
  { name: 'Netherlands', code2: 'NL', code3: 'NLD', aliases: ['holland', 'nl'] },
  { name: 'Italy', code2: 'IT', code3: 'ITA', aliases: ['it'] },
  { name: 'Germany', code2: 'DE', code3: 'DEU', aliases: ['ger', 'deu'] },
  // Americas
  { name: 'United States', code2: 'US', code3: 'USA', aliases: ['america', 'usa'] },
  { name: 'Brazil', code2: 'BR', code3: 'BRA', aliases: ['brasil', 'bra'] },
  // Asia
  { name: 'Japan', code2: 'JP', code3: 'JPN', aliases: ['nihon', 'nippon'] },
];
