export const ISTANBUL_DISTRICTS = [
  'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
  'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
  'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
  'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
  'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
  'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
  'Ümraniye', 'Üsküdar', 'Zeytinburnu',
] as const;

export type DistrictCandidate = {
  name: string;
  addressComponents: Array<{
    longName: string;
    types: string[];
  }>;
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .trim()
    .toLowerCase();
}

export function getVerifiedDistricts(city: string): readonly string[] | null {
  return normalize(city) === 'istanbul' ? ISTANBUL_DISTRICTS : null;
}

export function resolveDistricts(
  city: string,
  candidates: DistrictCandidate[],
): string[] {
  const verifiedDistricts = getVerifiedDistricts(city);
  if (verifiedDistricts) {
    return [...verifiedDistricts];
  }

  const cityName = normalize(city);
  const districts = new Map<string, string>();

  for (const candidate of candidates) {
    const district = candidate.addressComponents.find((component) =>
      component.types.includes('administrative_area_level_2')
    )?.longName.trim();
    const province = candidate.addressComponents.find((component) =>
      component.types.includes('administrative_area_level_1')
    )?.longName.trim();

    if (
      !district
      || !province
      || normalize(province) !== cityName
      || normalize(district) === cityName
    ) {
      continue;
    }

    districts.set(normalize(district), district);
  }

  return [...districts.values()].sort((first, second) =>
    first.localeCompare(second, 'tr')
  );
}
