export interface ISPARKPark {
  parkID: number;
  parkName: string;
  lat: string;
  lng: string;
  capacity: number;
  emptyCapacity: number;
  workHours: string;
  parkType: string;
  freeTime: number;
  district: string;
  isOpen: number;
}

export interface ISPARKParkDetay {
  locationName: string;
  parkID: number;
  parkName: string;
  lat: string;
  lng: string;
  capacity: number;
  emptyCapacity: number;
  updateDate: string;
  workHours: string;
  parkType: string;
  freeTime: number;
  monthlyFee: number;
  tariff: string;
  district: string;
  address: string;
  areaPolygon: string;
}
