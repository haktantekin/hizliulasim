interface AccountDeletionConfig {
  wpApi: string;
}

interface AccountDeletionDependencies {
  config?: AccountDeletionConfig;
  fetchImpl?: typeof fetch;
}

interface AccountDeletionResponse {
  deleted: true;
  message: string;
}

const CONFIRMATION_TEXT = 'HESABIMI SIL';
const SECURE_COOKIE = process.env.NODE_ENV === 'production';

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function getConfig(): AccountDeletionConfig {
  return {
    wpApi: (process.env.NEXT_PUBLIC_WP_API_URL?.replace(/\/wp\/v2\/?$/u, '')
      || 'https://cms.hizliulasim.com/wp-json').replace(/\/$/u, ''),
  };
}

function getCookie(request: Request, name: string): string {
  const cookieHeader = request.headers.get('cookie') || '';
  const prefix = `${name}=`;
  const entry = cookieHeader.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  if (!entry) return '';

  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return '';
  }
}

function clearAuthCookie(name: string): string {
  const parts = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (SECURE_COOKIE) parts.push('Secure');
  return parts.join('; ');
}

function isAccountDeletionResponse(value: unknown): value is AccountDeletionResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AccountDeletionResponse>;
  return candidate.deleted === true && typeof candidate.message === 'string';
}

function upstreamErrorMessage(status: number): string {
  if (status === 401 || status === 404) {
    return 'Oturumunuz sona erdi. Hesabınızı silmek için yeniden giriş yapın.';
  }
  if (status === 403) {
    return 'Bu hesap uygulama içinden silinemez.';
  }
  if (status === 400) {
    return 'Silme onayı geçersiz. Onay metnini eksiksiz yazın.';
  }
  if (status === 429) {
    return 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.';
  }
  return 'Hesap şu anda silinemedi. Lütfen tekrar deneyin.';
}

export function createDeleteAccountHandler(dependencies: AccountDeletionDependencies = {}) {
  const config = dependencies.config ?? getConfig();
  const fetchImpl = dependencies.fetchImpl ?? fetch;

  return async function deleteAccount(request: Request) {
    const token = getCookie(request, 'auth_token');
    if (!token) {
      return json({ message: 'Hesabınızı silmek için giriş yapın.' }, 401);
    }

    let confirmation: string;
    try {
      if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
        throw new Error('invalid content type');
      }
      const rawBody = await request.text();
      if (rawBody.length > 256) throw new Error('oversized body');
      const body = JSON.parse(rawBody);
      confirmation = typeof body?.confirmation === 'string' ? body.confirmation : '';
    } catch {
      return json({ message: 'Silme onayı geçersiz.' }, 400);
    }

    if (confirmation !== CONFIRMATION_TEXT) {
      return json({ message: 'Silme onayı geçersiz. Onay metnini eksiksiz yazın.' }, 400);
    }

    let upstream: Response;
    try {
      upstream = await fetchImpl(`${config.wpApi}/hizliulasim/v1/auth/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmation }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return json({ message: 'Hesap silme hizmetine ulaşılamadı. Lütfen tekrar deneyin.' }, 502);
    }

    const data: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const status = upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
      return json({ message: upstreamErrorMessage(status) }, status);
    }

    if (!isAccountDeletionResponse(data)) {
      return json({ message: 'Hesap silme işlemi doğrulanamadı. Lütfen tekrar deneyin.' }, 502);
    }

    const response = json(data);
    response.headers.append('Set-Cookie', clearAuthCookie('auth_token'));
    response.headers.append('Set-Cookie', clearAuthCookie('refresh_token'));
    return response;
  };
}
