export interface MetroLineColor {
  Color_R: number;
  Color_G: number;
  Color_B: number;
}

export interface MetroLine {
  Id: number;
  Name: string; // e.g. "M1A", "T1", "F1"
  Content: string;
  LongDescription: string;
  Color: MetroLineColor;
  FirstTime: string;
  LastTime: string;
  IsActive: boolean;
  FunctionalCode: string; // e.g. "M-M1A", "M-T01", "M-F01"
  Order: number;
  Stations?: MetroStation[];
}

export interface MetroStationDetailInfo {
  Escolator: number;
  Lift: number;
  BabyRoom: boolean;
  WC: boolean;
  Masjid: boolean;
  Latitude: string;
  Longitude: string;
}

export interface MetroStation {
  Id: number;
  Name: string;
  Description: string;
  LineId: number;
  LineName: string;
  Order: number;
  IsActive: boolean;
  FunctionalCode: string;
  DetailInfo: MetroStationDetailInfo;
}

export interface MetroRailwayGroup {
  Group: string; // "M", "T", "F", "TF"
  Name: string; // "Metro Hatları", "Tramvay Hatları" etc.
  Lines: Record<string, string>; // { "9": "M1A", "1": "M2", ... }
}

export interface MetroServiceStatus {
  LineId: number;
  LineName: string;
  Status: string;
  Description: string;
  IsActive: boolean;
}

export interface MetroAnnouncement {
  Id: number;
  Title: string;
  Content: string;
  StartDate: string;
  EndDate: string;
  LineId: number;
  LineName: string;
}

export interface MetroTicketPrice {
  Id: number;
  Title: string;
  Price: number;
  Description: string;
}

export interface MetroFaultyEquipment {
  Id: number;
  StationName: string;
  EquipmentType: string;
  Description: string;
  LineId: number;
  LineName: string;
}
