import { 
  MapPin, 
  Clock, 
  Bus, 
  ParkingCircle, 
  Train, 
  Ship, 
  Car, 
  Fuel, 
  Calendar, 
} from 'lucide-react';

export const homeCardDatas = [
  { id: 1, label: 'Nasıl<br/>Giderim', href: '/blog/nasil-giderim', bgColor: 'bg-blue-100', textColor: 'text-blue-700', icon: MapPin },
  { id: 2, label: 'Saat<br/>Bilgileri', href: '/locations/otopark', bgColor: 'bg-gray-100', textColor: 'text-gray-700', icon: Clock },
  { id: 3, label: 'Otobüs<br/>Güzergahlari', href: '/blog/otobus-guzergahlari', bgColor: 'bg-red-100', textColor: 'text-red-700', icon: Bus },
  { id: 4, label: 'Otopark<br/>Ücretleri', href: '/blog/otopark-ucretleri', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700', icon: ParkingCircle },
  { id: 5, label: 'Metro/Tramvay<br/>Hatları', href: '/blog/metro-tramvay-hatlari', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700', icon: Train },
  { id: 6, label: 'Deniz<br/>Ulaşımı', href: '/blog/deniz-ulasimi', bgColor: 'bg-orange-100', textColor: 'text-orange-700', icon: Ship },
  { id: 7, label: 'Taksi<br/>Ücretleri', href: '/blog/taksi-ucretleri', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700', icon: Car },
  { id: 8, label: 'Ne Kadar<br/>Yakar', href: '/blog/ne-kadar-yakar', bgColor: 'bg-purple-100', textColor: 'text-purple-700', icon: Fuel },
  { id: 9, label: 'Etkinlikler', href: '/blog/etkinlikler', bgColor: 'bg-cyan-100', textColor: 'text-cyan-700', icon: Calendar },
];