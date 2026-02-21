'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sun, Cloud, CloudRain, Snowflake, Zap, Facebook } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setCity, setCityLoading } from '../../store/slices/citySlice';
import LogoIcon from '../icons/LogoIcon';
import Link from 'next/link';

const Header = () => {
  const dispatch = useAppDispatch();
  const { name: city, isLoading } = useAppSelector((s) => s.city);

  const { data: detectedCity } = useQuery<string>({
    queryKey: ['detected-city'],
    queryFn: async () => {
      try {
        if ('geolocation' in navigator) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 300000,
            });
          });
          const res = await fetch(`/api/geocode/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
          const data = await res.json();
          return data.city || 'İstanbul';
        }
      } catch {
        // Browser geolocation failed, fallback to IP
      }
      try {
        const res = await fetch('/api/ip-location', { cache: 'no-store' });
        const data = await res.json();
        return data.city || 'İstanbul';
      } catch {
        return 'İstanbul';
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  useEffect(() => {
    if (detectedCity) {
      dispatch(setCity(detectedCity));
      dispatch(setCityLoading(false));
    }
  }, [detectedCity, dispatch]);

  const { data: weather, isLoading: weatherLoading } = useQuery<{ temp: number; code: number } | null>({
    queryKey: ['weather', city],
    queryFn: async () => {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`);
      const geo = await geoRes.json();
      const place = geo?.results?.[0];
      if (!place) return null;
      const { latitude, longitude } = place;
      const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`);
      const w = await wRes.json();
      const cw = w?.current_weather;
      if (cw && typeof cw.temperature === 'number') {
        return { temp: Math.round(cw.temperature), code: Number(cw.weathercode) };
      }
      return null;
    },
    enabled: !!city && !isLoading,
    staleTime: 1000 * 60 * 10,
  });

  const getWeatherIcon = (code: number) => {
    // Very rough mapping for demo purposes
    if ([71, 73, 75, 77, 85, 86].includes(code)) return <Snowflake size={16} className="text-blue-400" />; // snow
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return <CloudRain size={16} className="text-blue-500" />; // rain
    if ([95, 96, 99].includes(code)) return <Zap size={16} className="text-yellow-500" />; // thunder
    if ([0, 1].includes(code)) return <Sun size={16} className="text-yellow-400" />; // clear
    return <Cloud size={16} className="text-gray-500" />; // default cloudy
  };

  return (
    <div className="fixed top-0 left-0 w-full z-50 border-b border-brand-light-blue bg-white">
      <div className="container mx-auto p-4 flex items-center justify-between">
        <Link href={'/'} className="font-medium text-brand-dark-blue tracking-wide flex items-center gap-2">
          <LogoIcon className="h-6 w-6" ariaHidden color='#F26101' />
          <span className='text-brand-orange'>HIZLI ULAŞIM</span>
        </Link>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <a 
            href="https://www.facebook.com/hizliulasim/" 
            target="_blank" 
            rel="nofollow noopener noreferrer"
            className="flex items-center gap-1 hover:text-brand-orange transition-colors"
            aria-label="Facebook"
          >
            <Facebook size={20} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Header;