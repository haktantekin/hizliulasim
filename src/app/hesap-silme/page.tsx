'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Database, LogIn, ShieldCheck, Trash2, UserX } from 'lucide-react';
import AuthModal from '@/components/ui/AuthModal';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { useDeleteAccount } from '@/hooks/useAuth';
import { useAppSelector } from '@/store/hooks';
import { ACCOUNT_DELETION_CONFIRMATION } from '@/services/auth';

export default function AccountDeletionPage() {
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.user);
  const deleteMutation = useDeleteAccount();
  const [confirmation, setConfirmation] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const canDelete = confirmation === ACCOUNT_DELETION_CONFIRMATION && !deleteMutation.isPending;

  const handleDelete = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canDelete) return;

    deleteMutation.mutate(confirmation, {
      onSuccess: () => {
        setDeleted(true);
        setConfirmation('');
      },
    });
  };

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <Breadcrumb className="mb-6" items={[{ label: 'Hesap ve Verilerin Silinmesi' }]} />

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-b from-red-50 to-white px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <UserX size={28} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Hesap ve Verilerin Silinmesi</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-600">
            Hızlı Ulaşım hesabınızı uygulama içinden kalıcı olarak silebilirsiniz. Bu işlem geri alınamaz.
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <Database className="mb-2 text-brand-soft-blue" size={20} aria-hidden="true" />
              <h2 className="text-sm font-semibold text-gray-900">Silinen veriler</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Profil, e-posta, kullanıcı adı, favoriler, tercihler, yorumlar, özel profil resmi ve Google hesap bağlantısı silinir.
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <ShieldCheck className="mb-2 text-brand-soft-blue" size={20} aria-hidden="true" />
              <h2 className="text-sm font-semibold text-gray-900">Talep doğrulaması</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Silme işlemi yalnızca aktif hesabınızla giriş yaptıktan ve aşağıdaki onay metnini eksiksiz yazdıktan sonra başlatılır.
              </p>
            </div>
          </div>

          {deleted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center" role="status">
              <CheckCircle2 className="mx-auto text-emerald-600" size={28} aria-hidden="true" />
              <h2 className="mt-2 font-semibold text-emerald-900">Hesabınız silindi</h2>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                Hesabınız ve hesabınızla ilişkili uygulama verileri kalıcı olarak silindi. Oturumunuz kapatıldı.
              </p>
              <Link href="/" className="mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
                Ana sayfaya dön
              </Link>
            </div>
          ) : isLoading ? (
            <div className="py-8 text-center" aria-label="Oturum kontrol ediliyor">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-brand-soft-blue" />
            </div>
          ) : !isAuthenticated ? (
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-5 text-center">
              <LogIn className="mx-auto text-brand-orange" size={26} aria-hidden="true" />
              <h2 className="mt-2 font-semibold text-gray-900">Önce hesabınıza giriş yapın</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Silinecek hesabı doğrulayabilmemiz için üyelik hesabınızla oturum açmanız gerekir.
              </p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
              >
                <LogIn size={17} aria-hidden="true" />
                Giriş Yap
              </button>
            </div>
          ) : (
            <form onSubmit={handleDelete} className="rounded-xl border border-red-200 bg-red-50/50 p-5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 flex-none text-red-600" size={21} aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-red-900">Kalıcı silme onayı</h2>
                  <p className="mt-1 text-sm leading-6 text-red-800">
                    Devam etmek için <strong>{ACCOUNT_DELETION_CONFIRMATION}</strong> yazın.
                  </p>
                </div>
              </div>

              <label htmlFor="account-deletion-confirmation" className="mt-4 block text-sm font-medium text-gray-800">
                Onay metni
              </label>
              <input
                id="account-deletion-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200"
                placeholder={ACCOUNT_DELETION_CONFIRMATION}
              />

              {deleteMutation.isError && (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  {deleteMutation.error instanceof Error
                    ? deleteMutation.error.message
                    : 'Hesap silinemedi. Lütfen tekrar deneyin.'}
                </p>
              )}

              <button
                type="submit"
                disabled={!canDelete}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={18} aria-hidden="true" />
                {deleteMutation.isPending ? 'Hesap siliniyor...' : 'Hesabımı Kalıcı Olarak Sil'}
              </button>
            </form>
          )}

          <p className="text-center text-xs leading-5 text-gray-500">
            Veri işleme ayrıntıları için <Link href="/gizlilik-politikasi" className="font-medium text-brand-soft-blue hover:underline">Gizlilik Politikası</Link> sayfasını inceleyebilirsiniz.
          </p>
        </div>
      </section>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab="login" />
    </main>
  );
}
