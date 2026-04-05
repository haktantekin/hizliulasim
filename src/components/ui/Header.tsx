'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Facebook, Menu, X, Home, Map, Bus, ParkingCircle, LogIn, User, LogOut, Mail, Zap } from 'lucide-react';
import { useDrawer } from '../providers/DrawerProvider';
import { useAppSelector } from '../../store/hooks';
import { useLogout } from '../../hooks/useAuth';
import LogoIcon from '../icons/LogoIcon';
import Link from 'next/link';
import AuthModal from './AuthModal';

const drawerLinks = [
  { href: '/', icon: Home, label: 'Ana Sayfa' },
  { href: '/ulasim-rehberi', icon: Map, label: 'Ulaşım Rehberi' },
  { href: '/otobus-hatlari', icon: Bus, label: 'Otobüs Hatları' },
  { href: '/sarj-istasyonlari', icon: Zap, label: 'Şarj İstasyonları' },
  { href: '/otopark-ucretleri', icon: ParkingCircle, label: 'Otopark Ücretleri' },
  { href: '/iletisim', icon: Mail, label: 'İletişim' },
];

const legalLinks = [
  { href: '/kunye', label: 'Künye' },
  { href: '/gizlilik-politikasi', label: 'Gizlilik Politikası' },
  { href: '/cerez-politikasi', label: 'Çerez Politikası' },
];

const Header = () => {
  const { isOpen, toggle, close } = useDrawer();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated } = useAppSelector((state) => state.user);
  const logoutMutation = useLogout();

  useEffect(() => setMounted(true), []);

  // Close drawer on route change
  useEffect(() => {
    close();
    setUserMenuOpen(false);
  }, [pathname, close]);

  // Close user menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    logoutMutation.mutate(undefined);
    setUserMenuOpen(false);
  };

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

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 space-y-3">
          <a
            href="https://www.facebook.com/hizliulasim/"
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Facebook size={20} />
            <span>Facebook&apos;ta takip et</span>
          </a>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
            {legalLinks.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
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

          {/* Auth UI */}
          <div className="flex items-center">
            {isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-brand-orange/30 transition-all"
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-orange text-white flex items-center justify-center text-xs font-semibold">
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-[100]">
                    <Link
                      href={user.username ? `/u/${user.username}` : '/profil'}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User size={16} />
                      <span>Profil</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={16} />
                      <span>Çıkış Yap</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-brand-orange hover:bg-orange-50 transition-colors"
              >
                <LogIn size={18} />
                <span className="hidden sm:inline">Üye Girişi</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Portal drawer to document.body so it's above everything */}
      {mounted && drawerContent && createPortal(drawerContent, document.body)}

      {/* Auth Modal */}
      {mounted && createPortal(
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />,
        document.body
      )}
    </>
  );
};

export default Header;