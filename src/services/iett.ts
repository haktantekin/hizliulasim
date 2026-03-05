import type {
  IETTHat,
  IETTPlanlananSefer,
  IETTDuyuru,
  IETTHatOtoKonum,
  IETTDurak,
  IETTGaraj,
  IETTDurakDetay,
} from '@/types/iett';

// IETT SOAP API Endpoints
const ENDPOINTS = {
  hatDurakGuzergah: 'https://api.ibb.gov.tr/iett/UlasimAnaVeri/HatDurakGuzergah.asmx',
  planlananSeferSaati: 'https://api.ibb.gov.tr/iett/UlasimAnaVeri/PlanlananSeferSaati.asmx',
  duyurular: 'https://api.ibb.gov.tr/iett/UlasimDinamikVeri/Duyurular.asmx',
  seferGerceklesme: 'https://api.ibb.gov.tr/iett/FiloDurum/SeferGerceklesme.asmx',
  ibb: 'https://api.ibb.gov.tr/iett/ibb/ibb.asmx',
} as const;

const NAMESPACE = 'http://tempuri.org/';

/**
 * Build a SOAP envelope for IETT API calls
 */
function buildSoapEnvelope(method: string, params: Record<string, string> = {}): string {
  const paramXml = Object.entries(params)
    .map(([key, value]) => `<tem:${key}>${escapeXml(value)}</tem:${key}>`)
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${NAMESPACE}"><soap:Body><tem:${method}>${paramXml}</tem:${method}></soap:Body></soap:Envelope>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Call IETT SOAP API and parse JSON response
 */
async function callSoapMethod<T>(
  endpoint: string,
  method: string,
  params: Record<string, string> = {},
  timeoutMs = 15000,
  revalidateSeconds = 300
): Promise<T[]> {
  const body = buildSoapEnvelope(method, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}${method}`,
      },
      body,
      signal: controller.signal,
      next: { revalidate: revalidateSeconds },
    });

    if (!response.ok) {
      throw new Error(`IETT API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();

    // Extract JSON result from SOAP XML response
    const resultTag = `${method}Result`;
    const startTag = `<${resultTag}>`;
    const endTag = `</${resultTag}>`;
    const startIdx = xml.indexOf(startTag);
    const endIdx = xml.indexOf(endTag);

    if (startIdx === -1 || endIdx === -1) {
      return [];
    }

    const jsonStr = xml
      .substring(startIdx + startTag.length, endIdx)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    if (!jsonStr || jsonStr === 'null') {
      return [];
    }

    return JSON.parse(jsonStr) as T[];
  } finally {
    clearTimeout(timer);
  }
}

// ==========================================
// HAT - DURAK - GÜZERGAH METHODS
// ==========================================

/**
 * Get bus line info. If hatKodu is empty, returns all lines.
 */
export async function getHat(hatKodu: string = ''): Promise<IETTHat[]> {
  return callSoapMethod<IETTHat>(
    ENDPOINTS.hatDurakGuzergah,
    'GetHat_json',
    hatKodu ? { HatKodu: hatKodu } : {},
    15000,
    hatKodu ? 300 : 3600 // Single hat: 5 min, all hats: 1 hour
  );
}

/**
 * Get stop info by stop code
 */
export async function getDurak(durakKodu: string = ''): Promise<IETTDurak[]> {
  return callSoapMethod<IETTDurak>(
    ENDPOINTS.hatDurakGuzergah,
    'GetDurak_json',
    durakKodu ? { DurakKodu: durakKodu } : {}
  );
}

/**
 * Get garage info
 */
export async function getGaraj(): Promise<IETTGaraj[]> {
  return callSoapMethod<IETTGaraj>(
    ENDPOINTS.hatDurakGuzergah,
    'GetGaraj_json'
  );
}

// ==========================================
// PLANLANAN SEFER SAATİ METHODS
// ==========================================

/**
 * Get planned departure times for a bus line
 */
export async function getPlanlananSeferSaati(hatKodu: string): Promise<IETTPlanlananSefer[]> {
  return callSoapMethod<IETTPlanlananSefer>(
    ENDPOINTS.planlananSeferSaati,
    'GetPlanlananSeferSaati_json',
    { HatKodu: hatKodu }
  );
}

// ==========================================
// DUYURULAR METHODS
// ==========================================

/**
 * Get announcements. If hatKodu provided, returns only for that line.
 */
export async function getDuyurular(hatKodu?: string): Promise<IETTDuyuru[]> {
  const all = await callSoapMethod<IETTDuyuru>(
    ENDPOINTS.duyurular,
    'GetDuyurular_json'
  );
  if (hatKodu) {
    return all.filter(
      (d) => d.HAT?.toUpperCase().includes(hatKodu.toUpperCase())
    );
  }
  return all;
}

// ==========================================
// SEFER GERÇEKLEŞME / FİLO DURUM METHODS
// ==========================================

/**
 * Get real-time vehicle locations for a bus line
 */
export async function getHatOtoKonum(hatKodu: string): Promise<IETTHatOtoKonum[]> {
  return callSoapMethod<IETTHatOtoKonum>(
    ENDPOINTS.seferGerceklesme,
    'GetHatOtoKonum_json',
    { HatKodu: hatKodu }
  );
}

// ==========================================
// DURAK DETAY (XML API) METHODS
// ==========================================

/**
 * Parse XML <Table> elements from DurakDetay_GYY response into IETTDurakDetay[]
 */
function parseDurakDetayXml(xml: string): IETTDurakDetay[] {
  const results: IETTDurakDetay[] = [];
  // Match <Table>...</Table> blocks
  let startIdx = 0;
  while (true) {
    const tableStart = xml.indexOf('<Table>', startIdx);
    if (tableStart === -1) break;
    const tableEnd = xml.indexOf('</Table>', tableStart);
    if (tableEnd === -1) break;
    const block = xml.substring(tableStart + 7, tableEnd);
    startIdx = tableEnd + 8;

    const getValue = (tag: string): string => {
      const s = block.indexOf(`<${tag}>`);
      const e = block.indexOf(`</${tag}>`);
      if (s === -1 || e === -1) return '';
      return block.substring(s + tag.length + 2, e);
    };

    results.push({
      HATKODU: getValue('HATKODU'),
      YON: getValue('YON'),
      YON_ADI: getValue('YON_ADI'),
      SIRANO: parseInt(getValue('SIRANO')) || 0,
      DURAKKODU: getValue('DURAKKODU'),
      DURAKADI: getValue('DURAKADI'),
      XKOORDINATI: parseFloat(getValue('XKOORDINATI')) || 0,
      YKOORDINATI: parseFloat(getValue('YKOORDINATI')) || 0,
      DURAKTIPI: getValue('DURAKTIPI'),
      ISLETMEBOLGE: getValue('ISLETMEBOLGE'),
      ISLETMEALTBOLGE: getValue('ISLETMEALTBOLGE'),
      ILCEADI: getValue('ILCEADI'),
    });
  }

  return results;
}

/**
 * Get route stops detail for a bus line (from ibb.asmx - XML response)
 */
export async function getDurakDetay(hatKodu: string): Promise<IETTDurakDetay[]> {
  const body = buildSoapEnvelope('DurakDetay_GYY_wYonAdi', { hat_kodu: hatKodu });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(ENDPOINTS.ibb, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}DurakDetay_GYY_wYonAdi`,
      },
      body,
      signal: controller.signal,
      next: { revalidate: 3600 }, // 1 hour cache - stops rarely change
    });

    if (!response.ok) {
      throw new Error(`IETT DurakDetay API error: ${response.status}`);
    }

    const xml = await response.text();
    return parseDurakDetayXml(xml);
  } finally {
    clearTimeout(timer);
  }
}

// ==========================================
// COMBINED DATA HELPERS
// ==========================================

/**
 * Get complete bus route detail with all available info
 */
export async function getBusRouteDetail(hatKodu: string) {
  const upperCode = hatKodu.toUpperCase();

  const [hatResult, seferler, duyurular, konumlar, duraklar] = await Promise.allSettled([
    getHat(upperCode),
    getPlanlananSeferSaati(upperCode),
    getDuyurular(upperCode),
    getHatOtoKonum(upperCode),
    getDurakDetay(upperCode),
  ]);

  return {
    hat: hatResult.status === 'fulfilled' && hatResult.value.length > 0 ? hatResult.value[0] : null,
    seferler: seferler.status === 'fulfilled' ? seferler.value : [],
    duyurular: duyurular.status === 'fulfilled' ? duyurular.value : [],
    konumlar: konumlar.status === 'fulfilled' ? konumlar.value : [],
    duraklar: duraklar.status === 'fulfilled' ? duraklar.value : [],
  };
}

/**
 * Search bus lines by code or name
 */
export async function searchHatlar(query: string): Promise<IETTHat[]> {
  const allHatlar = await getHat();
  const q = query.toUpperCase().trim();
  return allHatlar.filter(
    (h) =>
      h.SHATKODU.toUpperCase().includes(q) ||
      h.SHATADI.toUpperCase().includes(q)
  );
}

/**
 * Find all bus lines passing through a given stop code.
 * Uses a single API call to get ALL stop-line mappings, then filters.
 * Much more efficient than the brute-force per-line approach.
 */
export async function getHatlarByDurakKodu(durakKodu: string): Promise<{ hat: IETTHat; durakDetay: IETTDurakDetay }[]> {
  const matches = await getHatlarByDurakDirekt(durakKodu);
  if (matches.length === 0) return [];

  // Fetch hat info for each matching line
  const hatKodlari = [...new Set(matches.map((m) => m.HATKODU))];
  const hatResults = await Promise.allSettled(
    hatKodlari.map((kod) => getHat(kod))
  );

  const hatMap = new Map<string, IETTHat>();
  for (const r of hatResults) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      hatMap.set(r.value[0].SHATKODU, r.value[0]);
    }
  }

  return matches
    .filter((m) => hatMap.has(m.HATKODU))
    .map((m) => ({ hat: hatMap.get(m.HATKODU)!, durakDetay: m }));
}

/**
 * Find which bus lines pass through a given stop code.
 * Single API call approach — fetches all stop-line mappings and filters by durak code.
 */
export async function getHatlarByDurak(durakKodu: string): Promise<{ hatKodu: string; hatAdi: string; yon: string; sirano: number }[]> {
  const matches = await getHatlarByDurakDirekt(durakKodu);
  if (matches.length === 0) return [];

  // Fetch hat info for matched lines
  const hatKodlari = [...new Set(matches.map((m) => m.HATKODU))];
  const hatResults = await Promise.allSettled(
    hatKodlari.map((kod) => getHat(kod))
  );

  const hatMap = new Map<string, string>();
  for (const r of hatResults) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      hatMap.set(r.value[0].SHATKODU, r.value[0].SHATADI);
    }
  }

  return matches
    .filter((m) => hatMap.has(m.HATKODU))
    .map((m) => ({
      hatKodu: m.HATKODU,
      hatAdi: hatMap.get(m.HATKODU) || '',
      yon: m.YON,
      sirano: m.SIRANO,
    }));
}

/**
 * Fetch ALL stop-line mappings from IETT API (single call) and filter for a specific durak code.
 * Only parses XML blocks that contain the target durak code for efficiency.
 */
async function getHatlarByDurakDirekt(durakKodu: string): Promise<IETTDurakDetay[]> {
  const body = buildSoapEnvelope('DurakDetay_GYY_wYonAdi', { hat_kodu: '' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000); // 60s timeout for large response

  try {
    const response = await fetch(ENDPOINTS.ibb, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}DurakDetay_GYY_wYonAdi`,
      },
      body,
      signal: controller.signal,
      next: { revalidate: 3600 }, // Cache full response for 1 hour
    });

    if (!response.ok) {
      throw new Error(`IETT DurakDetay ALL API error: ${response.status}`);
    }

    const xml = await response.text();

    // Only parse <Table> blocks that contain the target durak code
    const searchStr = `<DURAKKODU>${durakKodu}</DURAKKODU>`;
    const results: IETTDurakDetay[] = [];
    let startIdx = 0;

    while (true) {
      const tableStart = xml.indexOf('<Table>', startIdx);
      if (tableStart === -1) break;
      const tableEnd = xml.indexOf('</Table>', tableStart);
      if (tableEnd === -1) break;
      const block = xml.substring(tableStart + 7, tableEnd);
      startIdx = tableEnd + 8;

      // Skip blocks that don't contain our durak code
      if (!block.includes(searchStr)) continue;

      const getValue = (tag: string): string => {
        const s = block.indexOf(`<${tag}>`);
        const e = block.indexOf(`</${tag}>`);
        if (s === -1 || e === -1) return '';
        return block.substring(s + tag.length + 2, e);
      };

      results.push({
        HATKODU: getValue('HATKODU'),
        YON: getValue('YON'),
        YON_ADI: getValue('YON_ADI'),
        SIRANO: parseInt(getValue('SIRANO')) || 0,
        DURAKKODU: getValue('DURAKKODU'),
        DURAKADI: getValue('DURAKADI'),
        XKOORDINATI: parseFloat(getValue('XKOORDINATI')) || 0,
        YKOORDINATI: parseFloat(getValue('YKOORDINATI')) || 0,
        DURAKTIPI: getValue('DURAKTIPI'),
        ISLETMEBOLGE: getValue('ISLETMEBOLGE'),
        ISLETMEALTBOLGE: getValue('ISLETMEALTBOLGE'),
        ILCEADI: getValue('ILCEADI'),
      });
    }

    return results;
  } finally {
    clearTimeout(timer);
  }
}
