import { DeviceType, Platform, Software, Protocol } from './types';

export const DEVICE_TYPE_OPTIONS = Object.values(DeviceType);
export const PLATFORM_OPTIONS = Object.values(Platform);
export const SOFTWARE_OPTIONS = Object.values(Software);
export const PROTOCOL_OPTIONS = Object.values(Protocol);

export const COUNTRIES = [
  { name: 'United Kingdom', code2: 'GB', code3: 'GBR', aliases: ['uk', 'gbr'] },
  { name: 'United States', code2: 'US', code3: 'USA', aliases: ['america', 'usa'] },
  { name: 'Germany', code2: 'DE', code3: 'DEU', aliases: ['ger', 'deu'] },
  { name: 'Brazil', code2: 'BR', code3: 'BRA', aliases: ['brasil', 'bra'] },
  { name: 'Zimbabwe', code2: 'ZW', code3: 'ZWE', aliases: ['zim', 'zm', 'zimb'] },
  { name: 'France', code2: 'FR', code3: 'FRA', aliases: ['frnc'] },
  { name: 'Japan', code2: 'JP', code3: 'JPN', aliases: ['nihon', 'nippon'] },
];
