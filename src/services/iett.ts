import type {
  IETTHat,
  IETTPlanlananSefer,
  IETTDuyuru,
  IETTHatOtoKonum,
  IETTDurak,
  IETTGaraj,
} from '@/types/iett';

// IETT SOAP API Endpoints
const ENDPOINTS = {
  hatDurakGuzergah: 'https://api.ibb.gov.tr/iett/UlasimAnaVeri/HatDurakGuzergah.asmx',
  planlananSeferSaati: 'https://api.ibb.gov.tr/iett/UlasimAnaVeri/PlanlananSeferSaati.asmx',
  duyurular: 'https://api.ibb.gov.tr/iett/UlasimDinamikVeri/Duyurular.asmx',
  seferGerceklesme: 'https://api.ibb.gov.tr/iett/FiloDurum/SeferGerceklesme.asmx',
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
// COMBINED DATA HELPERS
// ==========================================

/**
 * Get complete bus route detail with all available info
 */
export async function getBusRouteDetail(hatKodu: string) {
  const upperCode = hatKodu.toUpperCase();

  const [hatResult, seferler, duyurular, konumlar] = await Promise.allSettled([
    getHat(upperCode),
    getPlanlananSeferSaati(upperCode),
    getDuyurular(upperCode),
    getHatOtoKonum(upperCode),
  ]);

  return {
    hat: hatResult.status === 'fulfilled' && hatResult.value.length > 0 ? hatResult.value[0] : null,
    seferler: seferler.status === 'fulfilled' ? seferler.value : [],
    duyurular: duyurular.status === 'fulfilled' ? duyurular.value : [],
    konumlar: konumlar.status === 'fulfilled' ? konumlar.value : [],
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
