'use client';

import { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, Snowflake, Zap } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setCity, setCityLoading } from '../../store/slices/citySlice';
import LogoIcon from '../icons/LogoIcon';
import Link from 'next/link';

const Header = () => {
  const dispatch = useAppDispatch();
  const { name: city, isLoading } = useAppSelector((s) => s.city);

  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchCity = async () => {
      try {
        dispatch(setCityLoading(true));
        const res = await fetch('/api/ip-location', { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        dispatch(setCity(data.city || 'İstanbul'));
      } catch {
        if (!mounted) return;
        dispatch(setCity('İstanbul'));
      } finally {
        if (mounted) dispatch(setCityLoading(false));
      }
    };
    fetchCity();
    return () => {
      mounted = false;
    };
  }, [dispatch]);

  // Weather: Open-Meteo (geocode city -> get current weather)
  useEffect(() => {
    let mounted = true;
    const fetchWeather = async () => {
      if (!city || isLoading) return;
      try {
        setWeatherLoading(true);
        // 1) Geocode city to coordinates
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`);
        const geo = await geoRes.json();
        const place = geo?.results?.[0];
        if (!place) {
          if (mounted) setWeather(null);
          return;
        }
        const { latitude, longitude } = place;
        // 2) Current weather
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`);
        const w = await wRes.json();
        const cw = w?.current_weather;
        if (mounted && cw && typeof cw.temperature === 'number') {
          setWeather({ temp: Math.round(cw.temperature), code: Number(cw.weathercode) });
        }
      } catch {
        if (mounted) setWeather(null);
      } finally {
        if (mounted) setWeatherLoading(false);
      }
    };
    fetchWeather();
    return () => {
      mounted = false;
    };
  }, [city, isLoading]);

  const getWeatherIcon = (code: number) => {
    // Very rough mapping for demo purposes
    if ([71, 73, 75, 77, 85, 86].includes(code)) return <Snowflake size={16} className="text-blue-400" />; // snow
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return <CloudRain size={16} className="text-blue-500" />; // rain
    if ([95, 96, 99].includes(code)) return <Zap size={16} className="text-yellow-500" />; // thunder
    if ([0, 1].includes(code)) return <Sun size={16} className="text-yellow-400" />; // clear
    return <Cloud size={16} className="text-gray-500" />; // default cloudy
  };

  return (
    <div className="fixed top-0 left-0 w-full z-50 border-b border-gray-100 bg-white">
      <div className="container mx-auto p-4 flex items-center justify-between">
        <Link href={'/'} className="font-black text-brand-dark-blue tracking-wide flex items-center gap-2">
          <LogoIcon className="h-6 w-6" ariaHidden />
          <span>HIZLI ULAŞIM</span>
        </Link>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          {city && <span className="font-medium">{city}</span>}
          {weatherLoading ? (
            <span className="text-gray-500">…</span>
          ) : weather ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100">
              {getWeatherIcon(weather.code)}
              <span>{weather.temp}°</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Header;