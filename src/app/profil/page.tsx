'use client';

import { useAppSelector } from '@/store/hooks';
import { useLogout } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { User, Mail, LogOut } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function ProfilPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.user);
  const logoutMutation = useLogout();

  const username = user?.username;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    } else if (!isLoading && isAuthenticated && username) {
      router.replace(`/u/${username}`);
    }
  }, [isLoading, isAuthenticated, username, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-soft-blue mx-auto" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => router.replace('/'),
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Breadcrumb className="mb-6" items={[{ label: 'Profilim' }]} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center py-8 px-4 bg-gradient-to-b from-brand-light-blue/30 to-white">
          <div className="w-20 h-20 rounded-full bg-brand-soft-blue flex items-center justify-center mb-4">
            <User size={36} className="text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
        </div>

        {/* Info */}
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Mail size={18} className="text-gray-400" />
            <span>{user.email}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <LogOut size={18} />
            {logoutMutation.isPending ? 'Çıkış yapılıyor...' : 'Çıkış Yap'}
          </button>
        </div>
      </div>
    </div>
  );
}
