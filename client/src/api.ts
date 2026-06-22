import { ContactEntry, Language, PeerInfo, PublicUser } from './types';

const TOKEN_KEY = 'along.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers: { ...headers, ...(opts.headers as object) } });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? 'error', data?.message ?? res.statusText, res.status);
  }
  return data as T;
}

export const api = {
  register(username: string, password: string, language: Language) {
    return request<{ token?: string; pending?: boolean; user: PublicUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, language }),
    });
  },
  login(username: string, password: string) {
    return request<{ token: string; user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  me() {
    return request<{ user: PublicUser }>('/api/me');
  },
  frequentContacts() {
    return request<{ contacts: ContactEntry[] }>('/api/contacts/frequent');
  },
  searchUsers(q: string) {
    return request<{ results: PeerInfo[] }>(`/api/contacts/search?q=${encodeURIComponent(q)}`);
  },
  // admin
  listUsers() {
    return request<{ users: PublicUser[] }>('/api/admin/users');
  },
  setUserStatus(id: number, status: 'pending' | 'approved' | 'locked') {
    return request<{ ok: true }>(`/api/admin/users/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },
  deleteUser(id: number) {
    return request<{ ok: true }>(`/api/admin/users/${id}`, { method: 'DELETE' });
  },
};
