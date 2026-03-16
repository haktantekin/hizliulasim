'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setAvatar } from '@/store/slices/userSlice';
import { User, MessageSquare, Bus, ParkingCircle, Camera, Loader2, LogIn } from 'lucide-react';
import Link from 'next/link';
import AuthModal from '@/components/ui/AuthModal';


interface ProfileUser {
  id: number;
  name: string;
  username: string;
  avatar_url?: string;
  registered_date?: string;
}

interface ProfileComment {
  id: number;
  content: string;
  date: string;
  post_id: number;
  post_title: string;
  post_slug: string;
}

interface ProfileFavoriteItem {
  id: string;
  name?: string;
}

interface ProfileData {
  user: ProfileUser;
  comments: ProfileComment[];
  favorites?: {
    routes: ProfileFavoriteItem[];
    places: ProfileFavoriteItem[];
  };
}

type Tab = 'yorumlar' | 'favori-otobusler' | 'otoparklar';

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading: authLoading, user: currentUser, favorites: reduxFavorites } = useAppSelector((state) => state.user);

  const [tab, setTab] = useState<Tab>('yorumlar');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    if (!username) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/auth/profile/${encodeURIComponent(username)}`, {
          credentials: 'include',
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.message || 'Profil yüklenemedi');
          return;
        }

        setProfile(data);
      } catch {
        setError('Profil yüklenirken bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-soft-blue mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (!profile) return null;

  const { user: profileUser, comments = [], favorites: profileFavorites } = profile;

  // Kendi profilimizde Redux'tan güncel favorileri kullan
  const displayFavorites = isOwnProfile ? reduxFavorites : profileFavorites;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Sadece JPG, PNG ve WebP dosyaları kabul edilir');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Dosya boyutu en fazla 2MB olabilir');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Yükleme başarısız');
        return;
      }

      setProfile((prev) =>
        prev ? { ...prev, user: { ...prev.user, avatar_url: data.avatar_url } } : prev
      );
      dispatch(setAvatar(data.avatar_url));
    } catch {
      setError('Yükleme sırasında bir hata oluştu');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="flex flex-col items-center py-8 px-4 bg-gradient-to-b from-brand-light-blue/30 to-white">
          <div className="relative">
            {isAuthenticated && profileUser.avatar_url ? (
              <img
                src={profileUser.avatar_url}
                alt={profileUser.name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-soft-blue flex items-center justify-center">
                <User size={36} className="text-white" strokeWidth={1.5} />
              </div>
            )}
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-orange text-white flex items-center justify-center shadow-md hover:bg-orange-600 transition-colors disabled:opacity-50"
                aria-label="Profil resmi değiştir"
              >
                {uploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
              </button>
            )}
            {isOwnProfile && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
                aria-label="Profil resmi yükle"
              />
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-4">{profileUser.name}</h1>
          <p className="text-sm text-gray-500 mt-1">@{profileUser.username}</p>
          {profileUser.registered_date && (
            <p className="text-xs text-gray-400 mt-1">
              {new Date(profileUser.registered_date).toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
              })} tarihinden beri üye
            </p>
          )}
        </div>
      </div>

      {/* Guest: Login prompt */}
      {!isAuthenticated ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex flex-col items-center py-12 px-4 text-center">
            <LogIn size={32} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Üye detaylarını görmek için oturum açın.</p>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-orange hover:bg-orange-600 transition-colors"
            >
              <LogIn size={16} />
              Üye Girişi
            </button>
            <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setTab('yorumlar')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  tab === 'yorumlar'
                    ? 'text-brand-orange border-b-2 border-brand-orange'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare size={16} />
                Yorumlar
              </button>
              <button
                onClick={() => setTab('favori-otobusler')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  tab === 'favori-otobusler'
                    ? 'text-brand-orange border-b-2 border-brand-orange'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Bus size={16} />
                Otobüsler
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

            {/* Tab Content */}
            <div className="p-4">
              {tab === 'yorumlar' && (
                <div>
                  {comments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Henüz yorum yapılmamış.</p>
                  ) : (
                    <ul className="space-y-4">
                      {comments.map((comment) => (
                        <li key={comment.id} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                          <a
                            href={`/${comment.post_slug}`}
                            className="text-sm font-medium text-brand-soft-blue hover:text-brand-orange transition-colors"
                          >
                            {comment.post_title}
                          </a>
                          <p
                            className="text-sm text-gray-600 mt-1 line-clamp-3"
                            dangerouslySetInnerHTML={{ __html: comment.content }}
                          />
                          <time className="text-xs text-gray-400 mt-1 block">
                            {new Date(comment.date).toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </time>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === 'favori-otobusler' && (
                <div>
                  {!displayFavorites?.routes?.length ? (
                    <div className="text-sm text-gray-400 text-center py-8">
                      <Bus size={32} className="mx-auto mb-2 text-gray-300" />
                      <p>Henüz favori otobüs hattı eklenmemiş.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {displayFavorites.routes.map((route) => (
                        <li key={route.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          <Link href={`/otobus-hatlari/${route.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                            <span className="flex-shrink-0 w-16 h-8 rounded-lg bg-brand-soft-blue text-white text-xs font-bold flex items-center justify-center">
                              {route.id}
                            </span>
                            <span className="text-sm text-gray-700 truncate">{route.name || `Hat ${route.id}`}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === 'otoparklar' && (
                <div>
                  {!displayFavorites?.places?.length ? (
                    <div className="text-sm text-gray-400 text-center py-8">
                      <ParkingCircle size={32} className="mx-auto mb-2 text-gray-300" />
                      <p>Henüz favori otopark eklenmemiş.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {displayFavorites.places.map((place) => (
                        <li key={place.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          <ParkingCircle size={18} className="flex-shrink-0 text-brand-soft-blue" />
                          <span className="text-sm text-gray-700 truncate">{place.name || `Otopark #${place.id}`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
