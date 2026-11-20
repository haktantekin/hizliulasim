'use client';

import { useEffect, useState } from 'react';
import { Send, Loader2, CheckCircle } from 'lucide-react';

const COOLDOWN_STORAGE_KEY = 'hu-contact-cooldown-until';

type FormData = {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

type ContactFormProps = {
  variant?: 'default' | 'compact';
};

export default function ContactForm({ variant = 'default' }: ContactFormProps) {
  const compact = variant === 'compact';
  const [form, setForm] = useState<FormData>({
    name: '', email: '', subject: '', message: '', website: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    const updateCooldown = () => {
      try {
        const cooldownUntil = Number(window.localStorage.getItem(COOLDOWN_STORAGE_KEY) || 0);
        const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
        setCooldownSeconds(remaining);
        if (remaining === 0) window.localStorage.removeItem(COOLDOWN_STORAGE_KEY);
      } catch {
        // The server-side cookie still enforces the cooldown when storage is unavailable.
      }
    };

    updateCooldown();
    const interval = window.setInterval(updateCooldown, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const startCooldown = (seconds: number) => {
    const safeSeconds = Math.max(1, Math.ceil(seconds));
    try {
      window.localStorage.setItem(
        COOLDOWN_STORAGE_KEY,
        String(Date.now() + safeSeconds * 1_000),
      );
    } catch {
      // Keep the in-page timer even if browser storage is disabled.
    }
    setCooldownSeconds(safeSeconds);
  };

  const formatCooldown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => null);
      const retryAfter = Number(data?.retryAfterSeconds || res.headers.get('retry-after') || 0);

      if (!res.ok) {
        if (retryAfter > 0) startCooldown(retryAfter);
        throw new Error(data?.message || 'Mesajınız gönderilemedi');
      }

      startCooldown(retryAfter || 300);
      setStatus('sent');
      setForm({ name: '', email: '', subject: '', message: '', website: '' });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Bir hata oluştu');
    }
  };

  if (status === 'sent') {
    return (
      <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-5' : 'py-12'}`}>
        <CheckCircle className={`text-brand-green ${compact ? 'mb-2 h-8 w-8' : 'mb-4 h-12 w-12'}`} />
        <h3 className={`font-semibold ${compact ? 'mb-1 text-base' : 'mb-2 text-lg'}`}>
          Mesajınız Gönderildi!
        </h3>
        <p className={`text-gray-600 ${compact ? 'mb-2 text-xs' : 'mb-4 text-sm'}`}>
          En kısa sürede size dönüş yapacağız.
        </p>
        {cooldownSeconds > 0 ? (
          <p className="text-gray-500 text-xs" aria-live="polite">
            Yeni mesaj gönderebilmek için {formatCooldown(cooldownSeconds)} bekleyin.
          </p>
        ) : (
          <button
            onClick={() => setStatus('idle')}
            className="px-6 py-2 rounded-lg bg-brand-dark-blue text-white text-sm hover:opacity-90 transition-opacity"
          >
            Yeni Mesaj Gönder
          </button>
        )}
      </div>
    );
  }

  const fieldClassName = compact
    ? 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition-colors focus:border-brand-soft-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/20'
    : 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark-blue focus:border-transparent transition-colors';
  const labelClassName = compact
    ? 'sr-only'
    : 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-2.5' : 'space-y-4'}>
      <div className={compact ? 'grid grid-cols-2 gap-2 lg:grid-cols-3' : 'space-y-4'}>
        <div>
          <label htmlFor="name" className={labelClassName}>
            Ad Soyad <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            value={form.name}
            onChange={handleChange}
            placeholder="Ad soyad"
            className={fieldClassName}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClassName}>
            E-posta <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            required
            maxLength={200}
            value={form.email}
            onChange={handleChange}
            placeholder="E-posta adresi"
            className={fieldClassName}
          />
        </div>

        <div className={compact ? 'col-span-2 lg:col-span-1' : undefined}>
          <label htmlFor="subject" className={labelClassName}>
            Konu <span className="text-red-500">*</span>
          </label>
          <select
            id="subject"
            name="subject"
            required
            value={form.subject}
            onChange={handleChange}
            className={fieldClassName}
          >
            <option value="">Konu seçin</option>
            <option value="Genel Bilgi">Genel Bilgi</option>
            <option value="Öneri">Öneri</option>
            <option value="Hata Bildirimi">Hata Bildirimi</option>
            <option value="İş Birliği">İş Birliği</option>
            <option value="Reklam">Reklam</option>
            <option value="Diğer">Diğer</option>
          </select>
        </div>
      </div>

      <div className={compact ? 'flex flex-col gap-2 sm:flex-row sm:items-end' : undefined}>
        <div className={compact ? 'min-w-0 flex-1' : undefined}>
          <label htmlFor="message" className={labelClassName}>
            Mesajınız <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            required
            minLength={10}
            maxLength={5000}
            rows={compact ? 2 : 5}
            value={form.message}
            onChange={handleChange}
            placeholder="Mesajınızı yazın..."
            className={`${fieldClassName} resize-y`}
          />
        </div>

        <button
          type="submit"
          disabled={status === 'sending' || cooldownSeconds > 0}
          className={compact
            ? 'inline-flex h-10 w-auto self-end items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-dark-blue px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60'
            : 'w-full flex items-center justify-center gap-2 bg-brand-dark-blue text-white py-3 rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-60 transition-opacity'}
        >
          {status === 'sending' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gönderiliyor...
            </>
          ) : cooldownSeconds > 0 ? (
            <>Bekleyin {formatCooldown(cooldownSeconds)}</>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Gönder
            </>
          )}
        </button>
      </div>

      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Web siteniz</label>
        <input
          type="text"
          id="website"
          name="website"
          value={form.website}
          onChange={handleChange}
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      {status === 'error' && (
        <p className={`text-red-600 ${compact ? 'text-xs' : 'text-sm'}`} role="alert">{errorMsg}</p>
      )}
    </form>
  );
}
