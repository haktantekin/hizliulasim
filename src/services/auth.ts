export interface AuthUser {
  id: number;
  email: string;
  name: string;
  username: string;
  role: string;
  avatar_url?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface UserFavorites {
  stops: FavoriteItem[];
  routes: FavoriteItem[];
  places: FavoriteItem[];
}

export interface FavoriteItem {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface UserPreferences {
  district?: string;
  city?: string;
  theme?: string;
  notifications?: string;
}

const AUTH_API_BASE = '/api/auth';

async function authFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Bir hata oluştu');
  }

  return data as T;
}

export async function loginUser(email: string, password: string) {
  return authFetch<{ user: AuthUser; tokens: AuthTokens }>(
    `${AUTH_API_BASE}/login`,
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }
  );
}

export async function registerUser(email: string, password: string, name: string, username: string) {
  return authFetch<{ user: AuthUser; tokens: AuthTokens }>(
    `${AUTH_API_BASE}/register`,
    {
      method: 'POST',
      body: JSON.stringify({ email, password, name, username }),
    }
  );
}

export async function getProfile() {
  return authFetch<{ user: AuthUser; favorites: UserFavorites; preferences: UserPreferences }>(
    `${AUTH_API_BASE}/me`
  );
}

export async function refreshToken() {
  return authFetch<{ tokens: AuthTokens }>(
    `${AUTH_API_BASE}/refresh`,
    { method: 'POST' }
  );
}

export async function logoutUser() {
  return authFetch<{ success: boolean }>(
    `${AUTH_API_BASE}/logout`,
    { method: 'POST' }
  );
}

export async function getFavorites() {
  return authFetch<UserFavorites>(`${AUTH_API_BASE}/favorites`);
}

export async function updateFavorite(type: 'stops' | 'routes' | 'places', action: 'add' | 'remove', item: FavoriteItem) {
  return authFetch<UserFavorites>(
    `${AUTH_API_BASE}/favorites`,
    {
      method: 'POST',
      body: JSON.stringify({ type, action, item }),
    }
  );
}

export async function getPreferences() {
  return authFetch<UserPreferences>(`${AUTH_API_BASE}/preferences`);
}

export async function updatePreferences(prefs: Partial<UserPreferences>) {
  return authFetch<UserPreferences>(
    `${AUTH_API_BASE}/preferences`,
    {
      method: 'POST',
      body: JSON.stringify(prefs),
    }
  );
}
