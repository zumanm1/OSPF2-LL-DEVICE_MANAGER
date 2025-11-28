
export enum Protocol {
  SSH = 'SSH',
  Telnet = 'Telnet',
}

export enum DeviceType {
  PE = 'PE',
  P = 'P',
  RR = 'RR',
  MANAGEMENT = 'Management'
}

export enum Platform {
  ISR4000 = 'ISR4000',
  ASR9903 = 'ASR9903',
  C3725 = '3725',
}

export enum Software {
  IOS = 'IOS',
  IOS_XE = 'IOS XE',
  IOS_XR = 'IOS XR',
}

export interface Device {
  id: string;
  deviceName: string;
  ipAddress: string;
  protocol: Protocol;
  port: number;
  username?: string;   // Optional - inherited from jumphost settings
  password?: string;   // Optional - inherited from jumphost settings
  country: string;
  deviceType: DeviceType;
  platform: Platform;
  software: Software;
  tags: string[];
}