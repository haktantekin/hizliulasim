'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { IETTDurak } from '@/types/iett';
import { MapPin } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import DurakHatlarClient from '@/components/bus/DurakHatlarClient';
import Link from 'next/link';

const DurakMap = dynamic(() => import('./DurakMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
      <MapPin className="w-8 h-8 text-gray-300" />
    </div>
  ),
});

interface Props {
  durakKodu: string;
}

export default function DurakDetayClient({ durakKodu }: Props) {
  const [durak, setDurak] = useState<IETTDurak | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/iett/durak?kod=${durakKodu}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error('fetch failed');
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setDurak(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [durakKodu]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="py-6 border-b border-gray-200 mb-6">
          <div className="bg-gray-100 rounded h-6 w-64 mb-2" />
          <div className="bg-gray-100 rounded h-4 w-40" />
        </div>
        <div className="bg-gray-100 rounded-xl h-[300px]" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-2xl font-bold text-gray-700 mb-2">Durak Bilgisi Alınamadı</h2>
        <p className="text-gray-500">
          İETT API&apos;sine bağlanılamadı. Lütfen daha sonra tekrar deneyin.
        </p>
        <Link
          href="/otobus-hatlari"
          className="inline-block mt-6 px-6 py-3 bg-brand-soft-blue text-white rounded-lg hover:bg-brand-dark-blue transition-colors"
        >
          Otobüs Hatlarına Dön
        </Link>
      </div>
    );
  }

  if (!durak) {
    return (
      <div className="text-center py-16">
        <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-2xl font-bold text-gray-700 mb-2">Durak Bulunamadı</h2>
        <p className="text-gray-500">
          <span className="font-mono">{durakKodu}</span> kodlu durak bulunamadı.
        </p>
        <Link
          href="/otobus-hatlari"
          className="inline-block mt-6 px-6 py-3 bg-brand-soft-blue text-white rounded-lg hover:bg-brand-dark-blue transition-colors"
        >
          Otobüs Hatlarına Dön
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="py-6 border-b border-gray-200 mb-6">
        <div className="flex items-start gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 mb-1">{durak.SDURAKADI} - {durak.ILCEADI && <span>{durak.ILCEADI}</span>}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              {durak.DURAKTIPI && <span>Tip: {durak.DURAKTIPI}</span>}
              {durak.ENGELLIKULLANIMI === 'E' && (
                <span className="text-green-600">♿ Engelli erişimi var</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Breadcrumb
        className="mb-4"
        items={[
          { label: 'Otobüs Durakları', href: '/otobus-duraklari' },
          { label: durak.SDURAKADI },
        ]}
      />

      {/* Durak Haritası */}
      {durak.YKOORDINATI && durak.XKOORDINATI && (
        <div className="mb-6">
          <DurakMap
            lat={durak.YKOORDINATI}
            lng={durak.XKOORDINATI}
            durakAdi={durak.SDURAKADI}
          />
        </div>
      )}

      {/* Geçen Hatlar */}
      <DurakHatlarClient durakKodu={durakKodu} durakAdi={durak.SDURAKADI} />
    </>
  );
}
