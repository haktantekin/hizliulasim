type WordPressProxyFetch = (
  input: string | URL,
  init?: RequestInit & { next?: { revalidate: number } },
) => Promise<Response>;

export class WordPressProxyHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`WordPress API error: ${status}`);
    this.name = 'WordPressProxyHttpError';
    this.status = status;
  }
}

export async function fetchWordPressProxyPayload(
  url: string,
  fetchImpl: WordPressProxyFetch = fetch,
): Promise<{ data: unknown; total: string | null; totalPages: string | null }> {
  const response = await fetchImpl(url, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new WordPressProxyHttpError(response.status);
  }

  return {
    data: await response.json(),
    total: response.headers.get('X-WP-Total'),
    totalPages: response.headers.get('X-WP-TotalPages'),
  };
}
