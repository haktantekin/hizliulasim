'use client';

import { useMemo, useState } from 'react';
import { Banknote, GraduationCap } from 'lucide-react';

import {
  defaultMinibusFareSelection,
  findMinibusFarePair,
  type MinibusFareTariff,
} from '@/lib/minibusFare';

function formatTry(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(`${value}T00:00:00+03:00`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}

export default function MinibusFareCalculator({
  tariff,
  sourceUrl,
  embedded = false,
}: {
  tariff: MinibusFareTariff;
  sourceUrl: string;
  embedded?: boolean;
}) {
  const initial = useMemo(() => defaultMinibusFareSelection(tariff), [tariff]);
  const [boarding, setBoarding] = useState(initial?.boarding ?? '');
  const [alighting, setAlighting] = useState(initial?.alighting ?? '');
  const stops = useMemo(() => {
    const values = new Set<string>();
    for (const entry of tariff.entries) {
      values.add(entry.boarding);
      values.add(entry.alighting);
    }
    return [...values];
  }, [tariff]);
  const selectedFare = useMemo(
    () => findMinibusFarePair(tariff.entries, boarding, alighting),
    [tariff, boarding, alighting],
  );

  return (
    <section aria-labelledby="minibus-fare-heading" className={`${embedded ? '' : 'mt-6 '}rounded-xl border border-emerald-200 bg-emerald-50/40 p-5`}>
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
          <Banknote size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 id="minibus-fare-heading" className="text-lg font-semibold text-gray-900">Minibüs ücret tarifesi</h2>
          <p className="text-xs text-gray-500">{tariff.lineCode} / {tariff.lineName}</p>
        </div>
      </div>

      {tariff.entries.length > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Biniş yeri
            <select
              value={boarding}
              onChange={(event) => setBoarding(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {stops.map((stop) => <option key={`boarding-${stop}`} value={stop}>{stop}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            İniş yeri
            <select
              value={alighting}
              onChange={(event) => setAlighting(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {stops.map((stop) => <option key={`alighting-${stop}`} value={stop}>{stop}</option>)}
            </select>
          </label>
        </div>
      )}

      {selectedFare ? (
        <div aria-live="polite" className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2 rounded-lg bg-white p-4">
          <div>
            <span className="block text-xs text-gray-500">Tam ücret</span>
            <strong className="text-2xl text-emerald-700">{formatTry(selectedFare.fareTry)}</strong>
          </div>
          <div>
            <span className="block text-xs text-gray-500">Tarife mesafesi</span>
            <strong className="text-base text-gray-900">{selectedFare.distanceKm.toLocaleString('tr-TR')} km</strong>
          </div>
        </div>
      ) : tariff.entries.length > 0 ? (
        <p aria-live="polite" className="mt-4 rounded-lg bg-white p-4 text-sm text-amber-800">
          Bu yön için resmî kaynakta tek ve doğrulanabilir bir ücret çifti bulunmuyor.
        </p>
      ) : null}

      {tariff.flatFares.length > 0 && (
        <details className="mt-4 rounded-lg bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-800">Sabit ücretli alt güzergâhlar</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {tariff.flatFares.map((fare) => (
              <li key={fare.label} className="flex justify-between gap-4 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-700">{fare.label}</span>
                <strong className="shrink-0 text-gray-900">{formatTry(fare.fareTry)}</strong>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600">
        {tariff.studentFareTry !== undefined && (
          <span className="inline-flex items-center gap-1.5"><GraduationCap size={15} aria-hidden="true" /> Öğrenci: <strong>{formatTry(tariff.studentFareTry)}</strong></span>
        )}
        {tariff.effectiveDate && <span>Geçerlilik: <strong>{formatDate(tariff.effectiveDate)}</strong></span>}
        {tariff.decisionDate && <span>Karar tarihi: <strong>{formatDate(tariff.decisionDate)}</strong></span>}
        {tariff.verifiedAt && <span>Son doğrulama: <strong>{formatDateTime(tariff.verifiedAt)}</strong></span>}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Kaynak:{' '}
        <a className="underline hover:text-emerald-700" href={sourceUrl} target="_blank" rel="noopener noreferrer">
          İBB ücret tarifesi
        </a>
      </p>
    </section>
  );
}
