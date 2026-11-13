'use client';

import { LockKeyhole, LogIn } from 'lucide-react';

interface Props {
  onLogin: () => void;
  compact?: boolean;
}

export default function LiveFeatureLoginPrompt({ onLogin, compact = false }: Props) {
  return (
    <div className={`rounded-xl border border-blue-100 bg-blue-50/60 text-center ${compact ? 'p-3' : 'p-6'}`}>
      <LockKeyhole className={`${compact ? 'h-5 w-5' : 'h-8 w-8'} mx-auto text-brand-soft-blue`} />
      <p className={`${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'} font-medium text-gray-800`}>
        Canlı araç konumları üyelere açıktır.
      </p>
      {!compact && (
        <p className="mt-1 text-xs text-gray-500">
          Planlanan seferler ve durak bilgileri giriş yapmadan kullanılmaya devam eder.
        </p>
      )}
      <button
        type="button"
        onClick={onLogin}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-soft-blue px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-dark-blue"
      >
        <LogIn className="h-3.5 w-3.5" />
        Giriş yap veya üye ol
      </button>
    </div>
  );
}
