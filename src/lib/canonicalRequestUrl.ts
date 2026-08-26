type CanonicalRequestUrlInput = {
  requestUrl: string;
  forwardedProtocol: string | null;
  host: string;
};

export function getCanonicalRequestUrl({
  requestUrl,
  forwardedProtocol,
  host,
}: CanonicalRequestUrlInput): URL | null {
  const url = new URL(requestUrl);
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const needsApexDomain = host.startsWith('www.') && !isLocalhost;
  const needsHttps = forwardedProtocol === 'http' && !isLocalhost;
  const hasTrailingSlash = url.pathname !== '/' && url.pathname.endsWith('/');

  if (!needsApexDomain && !needsHttps && !hasTrailingSlash) return null;

  if (needsApexDomain) {
    url.hostname = 'hizliulasim.com';
    url.port = '';
  }
  if (needsHttps) url.protocol = 'https:';
  if (hasTrailingSlash) url.pathname = url.pathname.replace(/\/+$/, '') || '/';

  return url;
}
