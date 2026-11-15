export type WordPressCategoryRecord = {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
  parent: number;
};

type WordPressFetch = (
  input: string | URL,
  init?: RequestInit & { next?: { revalidate: number } },
) => Promise<Response>;

async function readWordPressJson<T>({
  url,
  fetchImpl,
  requestInit,
  validate,
}: {
  url: string;
  fetchImpl: WordPressFetch;
  requestInit: RequestInit & { next?: { revalidate: number } };
  validate?: (value: unknown) => value is T;
}): Promise<T> {
  const response = await fetchImpl(url, requestInit);
  if (!response.ok) {
    throw new Error(`WordPress request failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (validate && !validate(payload)) {
    throw new Error('WordPress response has an invalid shape');
  }

  return payload as T;
}

export async function fetchWordPressJsonWithFreshRetry<T>({
  url,
  revalidateSeconds,
  fetchImpl = fetch,
  validate,
}: {
  url: string;
  revalidateSeconds: number;
  fetchImpl?: WordPressFetch;
  validate?: (value: unknown) => value is T;
}): Promise<T> {
  const headers = { 'Content-Type': 'application/json' };

  try {
    return await readWordPressJson<T>({
      url,
      fetchImpl,
      requestInit: {
        headers,
        next: { revalidate: revalidateSeconds },
      },
      validate,
    });
  } catch {
    return await readWordPressJson<T>({
      url,
      fetchImpl,
      requestInit: {
        headers,
        cache: 'no-store',
      },
      validate,
    });
  }
}

const CATEGORY_PAGE_SIZE = 50;
const CATEGORY_FIELDS = 'id,name,slug,description,count,parent';

async function readWordPressCategoryPage({
  url,
  fetchImpl,
  requestInit,
}: {
  url: string;
  fetchImpl: WordPressFetch;
  requestInit?: RequestInit & { next?: { revalidate: number } };
}): Promise<{ batch: WordPressCategoryRecord[]; totalPages: number }> {
  const response = await fetchImpl(url, requestInit);
  if (!response.ok) {
    throw new Error(`WordPress categories request failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('WordPress categories response is not an array');
  }

  const headerValue = Number.parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
  return {
    batch: payload as WordPressCategoryRecord[],
    totalPages: Number.isSafeInteger(headerValue) && headerValue > 0 ? headerValue : 1,
  };
}

export async function fetchAllWordPressCategories({
  endpoint,
  fetchImpl = fetch,
  requestInit,
}: {
  endpoint: string;
  fetchImpl?: WordPressFetch;
  requestInit?: RequestInit & { next?: { revalidate: number } };
}): Promise<WordPressCategoryRecord[]> {
  const categories: WordPressCategoryRecord[] = [];
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    const query = new URLSearchParams({
      per_page: String(CATEGORY_PAGE_SIZE),
      page: String(page),
      hide_empty: 'true',
      _fields: CATEGORY_FIELDS,
    });
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${endpoint}${separator}${query.toString()}`;
    let pageResult: { batch: WordPressCategoryRecord[]; totalPages: number };

    try {
      pageResult = await readWordPressCategoryPage({ url, fetchImpl, requestInit });
    } catch {
      const freshRequestInit: RequestInit & { next?: { revalidate: number } } = {
        ...requestInit,
        cache: 'no-store',
      };
      delete freshRequestInit.next;
      pageResult = await readWordPressCategoryPage({ url, fetchImpl, requestInit: freshRequestInit });
    }

    categories.push(...pageResult.batch);
    totalPages = pageResult.totalPages;
  }

  return categories;
}
