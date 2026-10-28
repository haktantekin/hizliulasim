export const bottomBarItems = [
  { kind: 'link', href: '/ulasim-rehberi', icon: 'map', label: 'Ulaşım Rehberi' },
  { kind: 'link', href: '/otobus-hatlari', icon: 'bus', label: 'Otobüs Hatları' },
  { kind: 'link', href: '/', icon: 'home', label: 'Ana Sayfa' },
  { kind: 'link', href: '/minibus-hatlari', icon: 'minibus', label: 'Minibüs Hatları' },
  { kind: 'drawer', intent: 'menu', icon: 'menu', label: 'Menü' },
] as const;

export type DrawerOpenIntent = 'menu';
