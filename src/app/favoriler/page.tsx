'use client';

import { useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { useUpdateFavorite } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Bus, ParkingCircle, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';

type Tab = 'otobusler' | 'otoparklar';

export default function FavorilerPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, favorites } = useAppSelector((state) => state.user);
  const updateFavorite = useUpdateFavorite();
  const [tab, setTab] = useState<Tab>('otobusler');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-soft-blue mx-auto" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const handleRemove = (type: 'routes' | 'places', id: string) => {
    updateFavorite.mutate({ type, action: 'remove', item: { id } });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Breadcrumb className="mb-6" items={[{ label: 'Favorilerim' }]} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('otobusler')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === 'otobusler'
                ? 'text-brand-orange border-b-2 border-brand-orange'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bus size={16} />
            Favori Otobüsler
          </button>
          <button
            onClick={() => setTab('otoparklar')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === 'otoparklar'
                ? 'text-brand-orange border-b-2 border-brand-orange'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ParkingCircle size={16} />
            Otoparklar
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {tab === 'otobusler' && (
            <div>
              {favorites.routes.length === 0 ? (
                <div className="text-center py-8">
                  <Bus size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">Henüz favori otobüs hattı eklenmemiş.</p>
                  <Link
                    href="/otobus-hatlari"
                    className="inline-block mt-3 text-sm text-brand-orange hover:text-orange-600 transition-colors"
                  >
                    Otobüs hatlarına göz at →
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {favorites.routes.map((route) => (
                    <li
                      key={route.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <Link
                        href={`/otobus-hatlari/${route.id}`}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <span className="flex-shrink-0 w-16 h-8 rounded-lg bg-brand-soft-blue text-white text-xs font-bold flex items-center justify-center">
                          {route.id}
                        </span>
                        <span className="text-sm text-gray-700 truncate">
                          {route.name || `Hat ${route.id}`}
                        </span>
                        <ExternalLink size={14} className="flex-shrink-0 text-gray-400" />
                      </Link>
                      <button
                        onClick={() => handleRemove('routes', route.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Favorilerden kaldır"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'otoparklar' && (
            <div>
              {favorites.places.length === 0 ? (
                <div className="text-center py-8">
                  <ParkingCircle size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">Henüz favori otopark eklenmemiş.</p>
                  <Link
                    href="/otopark-ucretleri"
                    className="inline-block mt-3 text-sm text-brand-orange hover:text-orange-600 transition-colors"
                  >
                    Otoparkları keşfet →
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {favorites.places.map((place) => (
                    <li
                      key={place.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <ParkingCircle size={18} className="flex-shrink-0 text-brand-soft-blue" />
                        <span className="text-sm text-gray-700 truncate">
                          {place.name || `Otopark #${place.id}`}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemove('places', place.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Favorilerden kaldır"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
