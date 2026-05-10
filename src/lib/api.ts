const BASE = '';

async function request(
  method: string,
  url: string,
  body?: unknown,
  token?: string | null,
) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export const api = {
  register: (username: string, password: string) =>
    request('POST', '/api/auth/register', { username, password }),

  login: (username: string, password: string) =>
    request('POST', '/api/auth/login', { username, password }),

  logout: (token: string) =>
    request('POST', '/api/auth/logout', undefined, token),

  updateAvatar: (
    colors: { skinColor?: string; shirtColor?: string; pantsColor?: string },
    token: string,
  ) => request('PATCH', '/api/users/me/avatar', colors, token),

  createServer: (name: string, token: string) =>
    request('POST', '/api/servers', { name }, token),

  getServer: (code: string, token: string) =>
    request('GET', `/api/servers/${code.toUpperCase()}`, undefined, token),
};
