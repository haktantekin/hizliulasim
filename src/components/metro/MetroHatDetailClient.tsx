'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { MetroLine, MetroStation, MetroAnnouncement } from '@/types/metro';
import {
  Loader2, Clock, CircleDot, AlertTriangle, Megaphone,
  MapPin,
} from 'lucide-react';

function colorToCSS(color: MetroLine['Color']): string {
  if (!color) return '#6B7280';
  if (typeof color === 'string') return color;
  return `rgb(${color.Color_R},${color.Color_G},${color.Color_B})`;
}

const StationMap = dynamic(() => import('./StationMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[350px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
      <MapPin className="w-8 h-8 text-gray-300" />
    </div>
  ),
});

interface Props {
  hatKodu: string;
}

function normalizeText(value: string): string {
  return value
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C');
}

function hasLineMetadata(announcement: MetroAnnouncement): boolean {
  const hasLineId = typeof announcement.LineId === 'number' && announcement.LineId > 0;
  const hasLineName = Boolean((announcement.LineName || '').trim());
  return hasLineId || hasLineName;
}

function matchesLine(announcement: MetroAnnouncement, lineId: number, lineCode: string): boolean {
  if (announcement.LineId === lineId) return true;

  const normalizedCode = normalizeText(lineCode);
  const fields = [announcement.LineName, announcement.Title, announcement.Content]
    .filter(Boolean)
    .map(v => normalizeText(v as string));

  return fields.some(value => value.includes(normalizedCode));
}

function toPlainText(value: string): string {
  const withoutTags = value.replace(/<[^>]*>/g, ' ');
  if (typeof document === 'undefined') {
    return withoutTags.replace(/\s+/g, ' ').trim();
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = withoutTags;
  return textarea.value.replace(/\s+/g, ' ').trim();
}

export default function MetroHatDetailClient({ hatKodu }: Props) {
  const [line, setLine] = useState<MetroLine | null>(null);
  const [stations, setStations] = useState<MetroStation[]>([]);
  const [announcements, setAnnouncements] = useState<MetroAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<'stations' | 'announcements'>('stations');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setError(false);

        // First fetch all lines to find this line's data
        const linesRes = await fetch('/api/metro');
        if (!linesRes.ok) throw new Error('Lines API error');
        const linesData = await linesRes.json();
        const allLines: MetroLine[] = Array.isArray(linesData) ? linesData : [];
        const found = allLines.find(
          l => (l.Name || '').toUpperCase() === hatKodu.toUpperCase()
        );

        if (!found) {
          if (!cancelled) setError(true);
          return;
        }

        if (!cancelled) setLine(found);

        // Fetch stations, announcements in parallel
        const [stationsRes, announcementsRes] = await Promise.all([
          fetch(`/api/metro/istasyonlar?hatId=${found.Id}`),
          fetch('/api/metro/duyurular'),
        ]);

        const stationsData = stationsRes.ok ? await stationsRes.json() : [];
        const announcementsData = announcementsRes.ok ? await announcementsRes.json() : [];

        if (cancelled) return;

        setStations(
          (Array.isArray(stationsData) ? stationsData : []).sort(
            (a: MetroStation, b: MetroStation) => (a.Order ?? 0) - (b.Order ?? 0)
          )
        );

        // Some Metro API responses omit LineId/LineName. In that case, keep announcements visible.
        const allAnn: MetroAnnouncement[] = Array.isArray(announcementsData) ? announcementsData : [];
        const hasAnyLineMetadata = allAnn.some(hasLineMetadata);

        setAnnouncements(
          hasAnyLineMetadata
            ? allAnn.filter(a => matchesLine(a, found.Id, hatKodu))
            : allAnn
        );
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [hatKodu]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Hat bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (error || !line) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Hat bilgisi bulunamadı.</p>
        <p className="text-sm text-red-500 mt-1">Lütfen daha sonra tekrar deneyin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Line info card */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-4 h-4 rounded-full flex-none"
            style={{ backgroundColor: colorToCSS(line.Color) }}
          />
          <span className="font-bold text-gray-800 text-lg">{line.Name}</span>
          <span className="text-gray-600">{line.LongDescription}</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ml-auto ${
              line.IsActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}
          >
            {line.IsActive ? 'Aktif' : 'Kapalı'}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          {line.FirstTime && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              İlk sefer: {line.FirstTime}
            </div>
          )}
          {line.LastTime && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Son sefer: {line.LastTime}
            </div>
          )}
          <div className="flex items-center gap-1">
            <CircleDot className="w-4 h-4" />
            {stations.length} İstasyon
          </div>
        </div>
      </div>

      {/* Map */}
      {stations.length > 0 && (
        <StationMap stations={stations} lineColor={colorToCSS(line.Color)} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { key: 'stations' as const, label: 'İstasyonlar', icon: CircleDot },
          { key: 'announcements' as const, label: 'Duyurular', icon: Megaphone },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-brand-soft-blue shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.key === 'announcements' && announcements.length > 0 && (
              <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {announcements.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'stations' && (
        <div className="space-y-1">
          {stations.map((station, i) => (
            <div
              key={station.Id}
              className="flex items-center gap-3 p-3 bg-white border border-gray-50 rounded-lg"
            >
              <div className="flex flex-col items-center">
                <div
                  className="w-3 h-3 rounded-full border-2"
                  style={{ borderColor: colorToCSS(line.Color) }}
                />
                {i < stations.length - 1 && (
                  <div
                    className="w-0.5 h-4 mt-0.5"
                    style={{ backgroundColor: colorToCSS(line.Color) }}
                  />
                )}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-800">{station.Description || station.Name}</span>
              </div>
              <span className="text-xs text-gray-400">{i + 1}</span>
            </div>
          ))}

          {stations.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              İstasyon bilgisi henüz mevcut değil.
            </div>
          )}
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="space-y-2">
          {announcements.map(ann => (
            <div
              key={ann.Id}
              className="bg-orange-50 border border-orange-100 rounded-xl p-4"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500 flex-none mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-800">{toPlainText(ann.Title || '')}</p>
                  {ann.Content && (
                    <p className="text-xs text-orange-600 mt-1 line-clamp-3">
                      {toPlainText(ann.Content)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {announcements.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Şu an aktif duyuru bulunmuyor.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
