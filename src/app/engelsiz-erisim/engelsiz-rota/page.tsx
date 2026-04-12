'use client';

import { useState, useCallback } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import AutocompleteInput from '@/components/maps/AutocompleteInput';
import { ArrowRight, Loader2, Navigation, Clock, Footprints } from 'lucide-react';

interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  travelMode: string;
  transitDetails?: {
    lineName: string;
    vehicleType: string;
    departureStop: string;
    arrivalStop: string;
    numStops: number;
  };
}

interface RouteResult {
  summary: string;
  distance: string;
  duration: string;
  steps: RouteStep[];
  mapUrl: string;
}

export default function EngelsizRotaPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);

  const handleSearch = useCallback(async () => {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    setRoute(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_KEY;
      // Use transit mode with wheelchair accessible preference
      const params = new URLSearchParams({
        origin,
        destination,
        mode: 'transit',
        transit_routing_preference: 'less_walking',
        language: 'tr',
        key: apiKey || '',
      });

      const res = await fetch(`/api/maps/accessible-route?${params}`);
      if (!res.ok) throw new Error('Rota hesaplanamadı');
      const data = await res.json();
      setRoute(data);
    } catch {
      setError('Erişilebilir rota hesaplanamadı. Lütfen farklı adresler deneyin.');
    } finally {
      setLoading(false);
    }
  }, [origin, destination]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  // Build Google Maps URL for wheelchair-friendly directions
  const getGoogleMapsUrl = () => {
    if (!origin || !destination) return '#';
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">♿</span>
          <h1 className="text-xl font-bold text-gray-900">Engelsiz Rota</h1>
        </div>
        <p className="text-sm text-gray-500">
          Tekerlekli sandalye dostu güzergah planlama.
          Az yürüme mesafeli toplu taşıma rotaları ve yaya yönlendirmeleri.
        </p>
      </div>

      <Breadcrumb
        className="mb-4 -mt-2"
        items={[
          { label: 'Engelsiz Erişim', href: '/engelsiz-erisim' },
          { label: 'Engelsiz Rota' },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <AutocompleteInput
          placeholder="Nereden? (başlangıç noktası)"
          value={origin}
          onChange={setOrigin}
          onSelect={setOrigin}
        />
        <AutocompleteInput
          placeholder="Nereye gitmek istiyorsun?"
          value={destination}
          onChange={setDestination}
          onSelect={setDestination}
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!origin || !destination || loading}
            className="flex items-center gap-2 px-4 py-2 bg-brand-dark-blue text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
            Engelsiz Rota Bul
          </button>
          {origin && destination && (
            <a
              href={getGoogleMapsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-soft-blue underline"
            >
              Google Maps&apos;te aç
            </a>
          )}
        </div>
      </form>

      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700 mb-6">
        <p className="font-semibold mb-1">💡 İpuçları</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Toplu taşıma rotaları az yürüme mesafesi tercihiyle hesaplanır</li>
          <li>Metro ve metrobüs istasyonlarının çoğunda asansör bulunmaktadır</li>
          <li>Alçak tabanlı otobüs kullanan hatları durak detaylarından kontrol edebilirsiniz</li>
          <li>Rota alternatifleri için Google Maps uygulamasını kullanmanızı öneririz</li>
        </ul>
      </div>

      {error && (
        <div className="text-center py-8 text-red-500">{error}</div>
      )}

      {route && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-gray-700">
                <Footprints size={16} />
                <span className="font-medium">{route.distance}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-700">
                <Clock size={16} />
                <span className="font-medium">{route.duration}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {route.steps.map((step, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 bg-white border border-gray-100 rounded-lg"
              >
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    step.travelMode === 'TRANSIT' ? 'bg-blue-500' : 'bg-green-500'
                  }`}>
                    {i + 1}
                  </div>
                  {i < route.steps.length - 1 && (
                    <div className="w-0.5 h-full bg-gray-200 mt-1" />
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className="text-sm text-gray-800"
                    dangerouslySetInnerHTML={{ __html: step.instruction }}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {step.distance} • {step.duration}
                  </div>
                  {step.transitDetails && (
                    <div className="mt-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded inline-block">
                      🚌 {step.transitDetails.lineName} — {step.transitDetails.numStops} durak
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Embedded map */}
          {route.mapUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <iframe
                src={route.mapUrl}
                width="100%"
                height="350"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Engelsiz Rota Haritası"
              />
            </div>
          )}
        </div>
      )}

      {!route && !loading && !error && (
        <div className="text-center py-12 text-gray-400">
          <span className="text-4xl block mb-3">🗺️</span>
          <p>Başlangıç ve varış noktası girerek engelsiz rota arayın.</p>
        </div>
      )}
    </div>
  );
}
