import Link from 'next/link';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { ArrowLeft, Home, MapPinOff } from 'lucide-react';

const CMS_404_ENDPOINT = 'https://cms.hizliulasim.com/wp-json/hizliulasim/v1/404-urls';

async function reportNotFound(path: string, referrer: string, userAgent: string) {
  try {
    await fetch(CMS_404_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, referrer, userAgent }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error('404 URL could not be reported:', error);
  }
}

export default async function NotFound() {
  const requestHeaders = await headers();
  const path = requestHeaders.get('x-hizliulasim-pathname') || '';
  const referrer = requestHeaders.get('referer') || '';
  const userAgent = requestHeaders.get('user-agent') || '';

  if (path) {
    after(() => reportNotFound(path, referrer, userAgent));
  }

  return (
    <main className="relative isolate flex min-h-[70vh] items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50 px-4 py-16">
      <div className="absolute left-1/2 top-1/2 -z-10 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200/30 blur-3xl" />
      <section className="w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-[0_24px_80px_-32px_rgba(30,64,175,0.35)] backdrop-blur sm:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#304269] ring-1 ring-blue-100">
          <MapPinOff className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.24em] text-[#304269]">404</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Bu sayfaya ulaşılamıyor</h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600">
          Aradığınız adres taşınmış, değiştirilmiş veya artık yayında olmayabilir.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#304269] px-5 py-3 font-semibold text-white transition hover:bg-[#243452] focus:outline-none focus:ring-2 focus:ring-[#304269] focus:ring-offset-2">
            <Home className="h-4 w-4" aria-hidden="true" />
            Ana sayfaya dön
          </Link>
          <Link href="/kategoriler" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kategorileri incele
          </Link>
        </div>
      </section>
    </main>
  );
}
