"use client";

import { placeGroups } from "@/data/placeTypes";
import { useAppSelector } from "@/store/hooks";

const ExploreCategories = () => {
  const city = useAppSelector((s) => s.city.name);
  const district = useAppSelector((s) => s.location.district);
  const openMaps = (slug: string) => {
    const scope = district ? `${district} ${city}` : city;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(`${slug} in ${scope}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {placeGroups.map((group) => {
        const Icon = group.icon;
        return (
          <div key={group.title}>
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-brand-dark-blue">
              {Icon ? <Icon size={18} strokeWidth={1.5} /> : null}
              <span>{group.title}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {group.items.map((item) => (
                <button
                  key={item.slug}
                  onClick={() => openMaps(item.slug)}
                  className="text-left px-3  rounded-full"
                >
                  <div className="text-sm text-brand-dark-blue">{item.label}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExploreCategories;
