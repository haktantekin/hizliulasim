export type DrawerIconKey =
  | 'home'
  | 'map'
  | 'bus'
  | 'minibus'
  | 'navigation'
  | 'train'
  | 'charging'
  | 'parking'
  | 'accessibility'
  | 'mail';

type DrawerNavigationItem = {
  href: string;
  icon: DrawerIconKey;
  label: string;
};

export const headerDrawerItems = [
  { href: '/', icon: 'home', label: 'Ana Sayfa' },
  { href: '/ulasim-rehberi', icon: 'map', label: 'Ulaşım Rehberi' },
  { href: '/otobus-hatlari', icon: 'bus', label: 'Otobüs Hatları' },
  { href: '/minibus-hatlari', icon: 'minibus', label: 'Minibüs Hatları' },
  { href: '/yol-tarifi', icon: 'navigation', label: 'Yol Tarifi' },
  { href: '/sarj-istasyonlari', icon: 'charging', label: 'Şarj İstasyonları' },
  { href: '/otopark-ucretleri', icon: 'parking', label: 'Otopark Ücretleri' },
  { href: '/engelsiz-erisim', icon: 'accessibility', label: 'Engelsiz Erişim' },
  { href: '/iletisim', icon: 'mail', label: 'İletişim' },
] as const satisfies readonly DrawerNavigationItem[];

export const bottomDrawerItems = [
  { href: '/', icon: 'home', label: 'Ana Sayfa' },
  { href: '/ulasim-rehberi', icon: 'map', label: 'Ulaşım Rehberi' },
  { href: '/otobus-hatlari', icon: 'bus', label: 'Otobüs Hatları' },
  { href: '/minibus-hatlari', icon: 'minibus', label: 'Minibüs Hatları' },
  { href: '/yol-tarifi', icon: 'navigation', label: 'Yol Tarifi' },
  { href: '/rayli-sistemler', icon: 'train', label: 'Raylı Sistemler' },
  { href: '/sarj-istasyonlari', icon: 'charging', label: 'Şarj İstasyonları' },
  { href: '/otopark-ucretleri', icon: 'parking', label: 'Otopark Ücretleri' },
  { href: '/engelsiz-erisim', icon: 'accessibility', label: 'Engelsiz Erişim' },
  { href: '/iletisim', icon: 'mail', label: 'İletişim' },
] as const satisfies readonly DrawerNavigationItem[];
