export const DATA_SOURCES = {
  iett: {
    name: 'İETT',
    url: 'https://iett.istanbul/',
    displayUrl: 'iett.istanbul',
    description: 'Otobüs hatları, duraklar, sefer bilgileri ve duyurular',
    official: true,
  },
  ibbOpenData: {
    name: 'İBB Açık Veri Portalı – İETT GTFS',
    url: 'https://data.ibb.gov.tr/dataset/iett-gtfs-verisi',
    displayUrl: 'data.ibb.gov.tr',
    description: 'Toplu taşıma rota planlama ve zaman çizelgesi verileri',
    official: true,
  },
  metroIstanbul: {
    name: 'Metro İstanbul',
    url: 'https://www.metro.istanbul/',
    displayUrl: 'metro.istanbul',
    description: 'Raylı sistem hatları, istasyonlar ve hizmet duyuruları',
    official: true,
  },
  ispark: {
    name: 'İSPARK',
    url: 'https://ispark.istanbul/',
    displayUrl: 'ispark.istanbul',
    description: 'Otopark konumu, kapasitesi, doluluk ve ücret bilgileri',
    official: true,
  },
  ibbMinibus: {
    name: 'İBB Minibüsüm Nerede?',
    url: 'https://application2.ibb.gov.tr/tulasim/MinibusumNerede.aspx',
    displayUrl: 'application2.ibb.gov.tr',
    description: 'Minibüs ve taksi dolmuş hatları ile güzergâh bilgileri',
    official: true,
  },
  ibbMinibusFare: {
    name: 'İBB Minibüs Ücret Tarifesi',
    url: 'https://application2.ibb.gov.tr/tulasim/ucrettarife.aspx',
    displayUrl: 'application2.ibb.gov.tr',
    description: 'Minibüs ve taksi dolmuş ücret tarifeleri',
    official: true,
  },
  ibbCityMap: {
    name: 'İBB Şehir Haritası',
    url: 'https://sehirharitasi.ibb.gov.tr/',
    displayUrl: 'sehirharitasi.ibb.gov.tr',
    description: 'İlçe sınırları ve güzergâh geometrileri',
    official: true,
  },
  openChargeMap: {
    name: 'Open Charge Map',
    url: 'https://openchargemap.org/',
    displayUrl: 'openchargemap.org',
    description: 'Topluluk tarafından sağlanan elektrikli araç şarj noktaları',
    official: false,
  },
  googleMaps: {
    name: 'Google Maps',
    url: 'https://maps.google.com/',
    displayUrl: 'maps.google.com',
    description: 'Harita, yer arama ve yol tarifi hizmetleri',
    official: false,
  },
  openStreetMap: {
    name: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org/copyright',
    displayUrl: 'openstreetmap.org',
    description: 'Açık harita altlığı ve coğrafi veriler',
    official: false,
  },
} as const;

export type DataSourceKey = keyof typeof DATA_SOURCES;

