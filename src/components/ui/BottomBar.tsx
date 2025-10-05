'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, Map, FileText } from 'lucide-react';

const BottomBar = () => {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/',
      icon: Home
    },
    {
      href: '/harita',
      icon: Map
    },
    {
      href: '/kesfet',
      icon: Search
    },
    {
      href: '/blog',
      icon: FileText
    }
  ];

  return (
    <div className="fixed bottom-3 left-0 w-full">
      <nav className="flex justify-around items-center max-w-md w-[90%] mx-auto py-2 shadow-md bg-brand-dark-blue rounded-full">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;
          const isHome = item.href === '/';
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center transition-colors ${
                isHome 
                  ? `p-2 rounded-full ${isActive ? 'text-brand-green' : 'text-white hover:bg-brand-yellow'}`
                  : `p-1 rounded-full ${isActive ? 'text-brand-green ' : 'text-white hover:text-brand-soft-blue hover:bg-brand-light-blue'}`
              }`}
            >
              <IconComponent strokeWidth={1} size={isHome ? 25 : 25} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomBar;