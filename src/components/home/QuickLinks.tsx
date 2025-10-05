"use client";

import { useCallback } from 'react';
import { quickLinksData } from '../../data/quickLinks';
import { useAppSelector } from '../../store/hooks';

const QuickLinks = () => {
  const city = useAppSelector((s) => s.city.name);
  const district = useAppSelector((s) => s.location.district);

  const onClick = useCallback((query: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Optionally, we could prefetch our API to warm results, but we just open Maps site
    // window.open to Google Maps with query in city
    e.preventDefault();
    const scope = district ? `${district} ${city}` : city;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(`${query} in ${scope}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [city, district]);

  return (
    <div className="w-full overflow-x-auto flex gap-2 mt-3 pb-3">
      {quickLinksData.map((item) => (
        <a
          key={item.id}
          href={`https://www.google.com/maps/search/${encodeURIComponent(`${item.query} in ${district ? `${district} ${city}` : city}`)}`}
          onClick={onClick(item.query)}
          className="bg-gray-100 text-brand-dark-blue p-2 px-4 rounded-full font-medium text-xs whitespace-nowrap hover:bg-gray-300 transition-colors"
        >
          {item.label}
        </a>
      ))}
    </div>
  );
};

export default QuickLinks;