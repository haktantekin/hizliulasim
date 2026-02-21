'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, Map, FileText, Compass } from 'lucide-react';
import { AccessibilityWidget } from '@haktantekin/noblock';

const BottomBar = () => {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/',
      icon: Home,
      label: 'Ana Sayfa'
    },
    {
      href: '/harita',
      icon: Map,
      label: 'Harita'
    },
    {
      href: '/gezi',
      icon: Compass,
      label: 'Gezi Rotaları'
    },
    {
      href: '/kesfet',
      icon: Search,
      label: 'Keşfet'
    },
    {
      href: '/kategoriler',
      icon: FileText,
      label: 'Blog'
    }
  ];

  return (
    <div className="fixed bottom-3 left-0 w-full">
      <nav className="flex justify-around items-center max-w-md w-[90%] mx-auto py-2 shadow-md border-[0.4px] border-gray bg-white rounded-full">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;
          const isHome = item.href === '/';
          
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center justify-center transition-colors ${
                isHome 
                  ? `p-2 rounded-full ${isActive ? 'font-bold text-brand-orange' : 'text-gray-400 hover:bg-brand-yellow'}`
                  : `p-1 rounded-full ${isActive ? 'font-bold text-brand-orange' : 'text-gray-400 hover:text-brand-soft-blue hover:bg-brand-light-blue'}`
              }`}
            >
              <IconComponent strokeWidth={1} size={isHome ? 25 : 25} aria-hidden="true" />
            </Link>
          );
        })}
       
      </nav>
    </div>
  );
};

export default BottomBar;