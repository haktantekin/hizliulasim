import Link from 'next/link';
import { BookOpenText, BusFront, Navigation, ParkingCircle, TrainFront, Zap } from 'lucide-react';

import {
  homeGuideItems,
  homeServiceItems,
  type HomeActionIconKey,
} from '@/lib/homeActionLinks';

const icons: Record<HomeActionIconKey, typeof BookOpenText> = {
  guide: BookOpenText,
  minibus: BusFront,
  train: TrainFront,
  parking: ParkingCircle,
  charging: Zap,
  navigation: Navigation,
};

export default function HomeActionLinks({ group }: { group: 'guide' | 'services' }) {
  const items = group === 'guide' ? homeGuideItems : homeServiceItems;

  return (
    <nav aria-label={group === 'guide' ? 'Ulaşım rehberi bağlantıları' : 'Günlük ulaşım araçları'}>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = icons[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl bg-gradient-to-r ${item.gradient} p-4 text-white transition-opacity hover:opacity-90`}
            >
              <div className="flex items-center gap-3">
                <Icon aria-hidden className="h-7 w-7 flex-none" />
                <div>
                  <div className="text-sm font-bold">{item.label}</div>
                  <div className="text-[11px] text-white/80 sm:text-xs">{item.description}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
