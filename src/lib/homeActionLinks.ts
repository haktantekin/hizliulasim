export type HomeActionIconKey = 'guide' | 'minibus' | 'train' | 'parking' | 'charging' | 'navigation';

export type HomeActionItem = {
  href: string;
  icon: HomeActionIconKey;
  label: string;
  description: string;
  gradient: string;
};

export const homeGuideItems = [
  {
    href: '/ulasim-rehberi',
    icon: 'guide',
    label: 'Ulaşım Rehberi',
    description: 'İstanbul ulaşım içerikleri',
    gradient: 'from-violet-600 to-indigo-700',
  },
  {
    href: '/minibus-hatlari',
    icon: 'minibus',
    label: 'Minibüs Hatları',
    description: 'İl ve ilçelere göre hatlar',
    gradient: 'from-cyan-600 to-teal-700',
  },
] as const satisfies readonly HomeActionItem[];

export const homeServiceItems = [
  {
    href: '/rayli-sistemler',
    icon: 'train',
    label: 'Raylı Sistemler',
    description: 'Metro, tramvay, füniküler',
    gradient: 'from-blue-600 to-blue-800',
  },
  {
    href: '/otopark-ucretleri',
    icon: 'parking',
    label: 'İSPARK OTOPARK',
    description: 'Anlık doluluk bilgileri',
    gradient: 'from-brand-soft-blue to-brand-dark-blue',
  },
  {
    href: '/sarj-istasyonlari',
    icon: 'charging',
    label: 'Şarj İstasyonları',
    description: 'Yakınımdaki elektrikli araç şarj noktaları',
    gradient: 'from-green-600 to-emerald-700',
  },
  {
    href: '/yol-tarifi',
    icon: 'navigation',
    label: 'Yol Tarifi',
    description: 'Toplu taşıma ile nereye, nasıl giderim?',
    gradient: 'from-brand-orange to-orange-600',
  },
] as const satisfies readonly HomeActionItem[];
