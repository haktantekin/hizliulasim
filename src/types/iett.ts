// IETT API response types

export interface IETTHat {
  SHATKODU: string;
  SHATADI: string;
  TARIFE: string;
  HAT_UZUNLUGU: number;
  SEFER_SURESI: number;
}

export interface IETTDurak {
  SDPICARETNO: string;
  SDURAKADI: string;
  KOORDINAT: string;
  ILCEADI: string;
  SPICARETNO: string;
  YKOORDINATI: number;
  XKOORDINATI: number;
  DURAKTIPI: string;
  ENGELLIKULLANIMI: string;
  AKPICARETNO: string;
  BOLESSION: string;
}

export interface IETTPlanlananSefer {
  SHATKODU: string;
  HATADI: string;
  SGUZERAH: string;
  SYON: string; // D = Departure, R = Return
  SGUNTIPI: string; // C = Weekday(Çalışma), CT = Saturday(Cumartesi), P = Sunday(Pazar)
  GUZERGAH_ISARETI: string | null;
  SSERVISTIPI: string;
  DT: string; // Departure time (HH:mm)
}

export interface IETTDuyuru {
  HESSION: string;
  HAT: string;
  TIP: string;
  DESSION: string;
  MESAJ: string;
  DUESSION: string;
  GUNCESSION: string;
}

export interface IETTHatOtoKonum {
  kapino: string;
  boylam: string;
  enlem: string;
  hatkodu: string;
  guzergahkodu: string;
  hatad: string;
  yon: string;
  son_konum_zamani: string;
  yakinDurakKodu: string;
}

export interface IETTGaraj {
  ID: string;
  SGARAJADI: string;
  SGARAJKODU: string;
  YKOORDINATI: number;
  XKOORDINATI: number;
}

export interface IETTFiloDurum {
  Operator: string;
  Garaj: string;
  KapiNo: string;
  Plaka: string;
  SonKonum: string;
  Enlem: number;
  Boylam: number;
  Hiz: number;
  Zamanlama: string;
}

// Minimal type for API response compatibility
export type VehicleLocation = IETTHatOtoKonum;

// Grouped schedule by direction and day type
export interface GroupedSchedule {
  direction: string;
  directionLabel: string;
  dayType: string;
  dayTypeLabel: string;
  times: string[];
  serviceType: string;
  routeCode: string;
}

// Bus route detail combined data
export interface BusRouteDetail {
  hat: IETTHat | null;
  seferler: IETTPlanlananSefer[];
  duyurular: IETTDuyuru[];
  konumlar: IETTHatOtoKonum[];
}
