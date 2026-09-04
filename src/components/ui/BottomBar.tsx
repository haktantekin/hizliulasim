'use client';

import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, Bus, Map, ParkingCircle, Menu, X, ExternalLink, UserPlus, LogIn, LogOut, Mail, TrainFront, Zap, Navigation, Accessibility } from 'lucide-react';
import { useDrawer } from '../providers/DrawerProvider';
import { useAppSelector } from '../../store/hooks';
import { useLogout } from '../../hooks/useAuth';
import LogoIcon from '../icons/LogoIcon';
import AuthModal from './AuthModal';
import DrawerSearchForm from './DrawerSearchForm';
import { bottomBarItems, shouldFocusDrawerSearch } from '../../lib/bottomBarNavigation';

const drawerLinks = [
  { href: '/', icon: Home, label: 'Ana Sayfa' },
  { href: '/ulasim-rehberi', icon: Map, label: 'Ulaşım Rehberi' },
  { href: '/otobus-hatlari', icon: Bus, label: 'Otobüs Hatları' },
  { href: '/yol-tarifi', icon: Navigation, label: 'Yol Tarifi' },
  { href: '/rayli-sistemler', icon: TrainFront, label: 'Raylı Sistemler' },
    { href: '/sarj-istasyonlari', icon: Zap, label: 'Şarj İstasyonları' },
  { href: '/otopark-ucretleri', icon: ParkingCircle, label: 'Otopark Ücretleri' },
  { href: '/engelsiz-erisim', icon: Accessibility, label: 'Engelsiz Erişim' },
  { href: '/iletisim', icon: Mail, label: 'İletişim' },
];

const legalLinks = [
  { href: '/kunye', label: 'Künye' },
  { href: '/gizlilik-politikasi', label: 'Gizlilik Politikası' },
  { href: '/cerez-politikasi', label: 'Çerez Politikası' },
];

const BottomBar = () => {
  const pathname = usePathname();
  const { isOpen: drawerOpen, open, close } = useDrawer();
  const [mounted, setMounted] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [focusDrawerSearch, setFocusDrawerSearch] = useState(false);

  const { user, isAuthenticated } = useAppSelector((state) => state.user);
  const logoutMutation = useLogout();

  useEffect(() => setMounted(true), []);

  // Close drawer on route change
  useEffect(() => { close(); }, [pathname, close]);

  useEffect(() => {
    if (!drawerOpen) setFocusDrawerSearch(false);
  }, [drawerOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const bottomBarIcons = {
    map: Map,
    bus: Bus,
    home: Home,
    search: Search,
    menu: Menu,
  } as const;

  const drawerContent = drawerOpen ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
        onClick={close}
        aria-hidden="true"
      />
      <nav
        style={{ position: 'fixed', top: 0, left: 0, height: '100%', width: '288px', backgroundColor: '#fff', zIndex: 10000, boxShadow: '4px 0 25px rgba(0,0,0,0.15)' }}
        className="flex flex-col"
        aria-label="Ana menü"
      >
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
        <div className="flex-1 overflow-y-auto py-2 flex flex-col">
          {drawerLinks.map(item => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Fragment key={item.href}>
                {item.href === '/' && <DrawerSearchForm autoFocus={focusDrawerSearch} />}
                <Link
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
              </Fragment>
            );
          })}
          <div className="border-t border-gray-100 mx-5 my-2" />
          <a
            href="https://www.facebook.com/hizliulasim/"
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="flex items-center gap-3 px-5 py-3.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ExternalLink size={20} />
            <span>Facebook&apos;ta takip et</span>
          </a>
          <div className="border-t border-gray-100 mx-5 my-2" />
          <div className="px-5 flex flex-wrap gap-x-4 gap-y-1">
            {legalLinks.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                {item.label}
              </Link>
            ))}
          </div>
          {!isAuthenticated && (
            <div className="flex gap-2 px-5 pt-4">
              <button
                onClick={() => { close(); setAuthTab('register'); setAuthModalOpen(true); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-orange text-white text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                <UserPlus size={16} />
                Üye Ol
              </button>
              <button
                onClick={() => { close(); setAuthTab('login'); setAuthModalOpen(true); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-brand-soft-blue text-brand-soft-blue text-sm font-medium hover:bg-brand-light-blue transition-colors"
              >
                <LogIn size={16} />
                Giriş Yap
              </button>
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 p-4 space-y-3">
          {isAuthenticated && user && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Merhaba, <span className="font-semibold">{user.name}</span></span>
              <button
                onClick={() => { logoutMutation.mutate(undefined); close(); }}
                disabled={logoutMutation.isPending}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                <LogOut size={16} />
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  ) : null;

  return (
    <>
      <div className={`fixed bottom-3 left-0 w-full transition-opacity duration-300 ${drawerOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <nav className="flex justify-around items-center max-w-md w-[90%] mx-auto py-2 border border-gray-200 shadow-none bg-white rounded-full">
          {bottomBarItems.map((item) => {
            const Icon = bottomBarIcons[item.icon];

            if (item.kind === 'link') {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center justify-center transition-colors p-1 rounded-full ${
                    isActive ? 'font-bold text-brand-orange' : 'text-gray-400 hover:text-brand-soft-blue hover:bg-brand-light-blue'
                  }`}
                >
                  <Icon strokeWidth={1} size={25} aria-hidden="true" />
                </Link>
              );
            }

            return (
              <button
                key={item.intent}
                type="button"
                onClick={() => {
                  setFocusDrawerSearch(shouldFocusDrawerSearch(item.intent));
                  open();
                }}
                aria-label={item.label}
                className="flex items-center justify-center transition-colors p-1 rounded-full text-gray-400 hover:text-brand-soft-blue hover:bg-brand-light-blue"
              >
                <Icon strokeWidth={1} size={25} aria-hidden="true" />
              </button>
            );
          })}
        </nav>
      </div>
      {mounted && drawerContent && createPortal(drawerContent, document.body)}
      {mounted && createPortal(
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authTab} />,
        document.body
      )}
    </>
  );
};

export default BottomBar;
