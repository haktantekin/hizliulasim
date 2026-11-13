export interface BusRouteDetailResponses {
  hatRes: PromiseSettledResult<Response>;
  seferRes: PromiseSettledResult<Response>;
  durakRes: PromiseSettledResult<Response>;
  pathRes: PromiseSettledResult<Response>;
}

export async function loadBusRouteDetailResponses(
  hatKodu: string,
  fetcher: typeof fetch = fetch,
): Promise<BusRouteDetailResponses> {
  const encodedCode = encodeURIComponent(hatKodu);
  const [hatRes, seferRes, durakRes, pathRes] = await Promise.allSettled([
    fetcher(`/api/iett/hatlar?kod=${encodedCode}`),
    fetcher(`/api/iett/sefer-saatleri?hatKodu=${encodedCode}`),
    fetcher(`/api/iett/durak-detay?hatKodu=${encodedCode}`),
    fetcher(`/api/iett/guzergah?hatKodu=${encodedCode}`),
  ]);

  return { hatRes, seferRes, durakRes, pathRes };
}
