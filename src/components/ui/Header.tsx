'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Facebook, Menu, X, Home, Map, Bus, BusFront, ParkingCircle } from 'lucide-react';
import { useDrawer } from '../providers/DrawerProvider';
import LogoIcon from '../icons/LogoIcon';
import Link from 'next/link';

const drawerLinks = [
  { href: '/', icon: Home, label: 'Ana Sayfa' },
  { href: '/ulasim-rehberi', icon: Map, label: 'Ulaşım Rehberi' },
  { href: '/otobus-hatlari', icon: Bus, label: 'Otobüs Hatları' },
  { href: '/otobus-duraklari', icon: BusFront, label: 'Otobüs Durakları' },
  { href: '/otopark-ucretleri', icon: ParkingCircle, label: 'Otopark Ücretleri' },
];

const Header = () => {
  const { isOpen, toggle, close } = useDrawer();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close drawer on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const drawerContent = isOpen ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
        onClick={close}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <nav
        style={{ position: 'fixed', top: 0, left: 0, height: '100%', width: '288px', backgroundColor: '#fff', zIndex: 10000, boxShadow: '4px 0 25px rgba(0,0,0,0.15)' }}
        className="flex flex-col"
        aria-label="Ana menü"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <Link href="/" onClick={close} className="flex items-center gap-2">
            <LogoIcon className="h-6 w-6" ariaHidden color="#F26101" />
            <span className="font-medium text-brand-orange tracking-wide">HIZLI ULAŞIM</span>
          </Link>
          <button
            onClick={close}
            aria-label="Menüyü kapat"
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Links */}
        <div className="flex-1 overflow-y-auto py-2 flex flex-col">
          {drawerLinks.map(item => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`flex items-center gap-3 px-5 py-3.5 text-sm transition-colors ${
                  isActive
                    ? 'text-brand-orange bg-orange-50 font-semibold border-r-2 border-brand-orange'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-brand-soft-blue'
                }`}
              >
                <Icon size={20} strokeWidth={1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer — Facebook */}
        <div className="border-t border-gray-100 p-4">
          <a
            href="https://www.facebook.com/hizliulasim/"
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Facebook size={20} />
            <span>Facebook&apos;ta takip et</span>
          </a>
        </div>
      </nav>
    </div>
  ) : null;

  return (
    <>
      <div className=" top-0 left-0 w-full z-50">
        <div className="container mx-auto px-4 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              aria-label="Menüyü aç"
              className="p-1 text-gray-600 hover:text-brand-orange transition-colors"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Portal drawer to document.body so it's above everything */}
      {mounted && drawerContent && createPortal(drawerContent, document.body)}
    </>
  );
};

export default Header;