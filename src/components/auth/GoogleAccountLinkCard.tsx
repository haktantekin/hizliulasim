'use client';

import { CheckCircle2, Link2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useGoogleLink } from '@/hooks/useAuth';
import GoogleSignInButton from './GoogleSignInButton';
import { getGoogleAccountLinkView, getGoogleLinkErrorMessage } from './google-account-link-state';

interface GoogleAccountLinkCardProps {
  linked: boolean;
}

export default function GoogleAccountLinkCard({ linked }: GoogleAccountLinkCardProps) {
  const [linkedLocally, setLinkedLocally] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { mutate, isPending } = useGoogleLink();

  const handleCredential = useCallback((credential: string) => {
    setError('');
    setSuccess('');
    mutate(credential, {
      onSuccess: () => {
        setLinkedLocally(true);
        setSuccess('Google hesabınız bağlandı. Artık Google ile giriş yapabilirsiniz.');
      },
      onError: (linkError) => setError(getGoogleLinkErrorMessage(linkError)),
    });
  }, [mutate]);

  const view = getGoogleAccountLinkView(linked || linkedLocally);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" aria-labelledby="google-account-link-title">
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${view.linked ? 'bg-green-50 text-green-600' : 'bg-brand-light-blue/40 text-brand-soft-blue'}`}>
          {view.linked ? <CheckCircle2 size={19} /> : <Link2 size={19} />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Hesap bağlantıları</p>
          <h2 id="google-account-link-title" className="mt-0.5 text-sm font-semibold text-gray-900">{view.title}</h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">{view.description}</p>
        </div>
      </div>

      <div className="px-5 py-4">
        {view.linked ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            <CheckCircle2 size={18} />
            Google ile giriş hazır
          </div>
        ) : (
          <div className="mx-auto max-w-sm">
            <GoogleSignInButton
              disabled={isPending}
              onCredential={handleCredential}
              onError={(message) => setError(getGoogleLinkErrorMessage(new Error(message)))}
            />
          </div>
        )}

        {success && (
          <p className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
            {success}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
