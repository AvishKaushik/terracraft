import { create } from 'zustand';

export interface AuthUser {
  id: string;
  username: string;
  skinColor: string;
  shirtColor: string;
  pantsColor: string;
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  serverCode: string | null;
  serverName: string | null;
  setAuth: (token: string, user: AuthUser) => void;
  setAvatar: (colors: Partial<Pick<AuthUser, 'skinColor' | 'shirtColor' | 'pantsColor'>>) => void;
  setServer: (code: string, name: string) => void;
  logout: () => void;
}

function loadStored(): { token: string; user: AuthUser } | null {
  try {
    const t = localStorage.getItem('tc_token');
    const u = localStorage.getItem('tc_user');
    return t && u ? { token: t, user: JSON.parse(u) } : null;
  } catch { return null; }
}

const stored = loadStored();

export const useAuthStore = create<AuthStore>((set) => ({
  token:      stored?.token ?? null,
  user:       stored?.user  ?? null,
  serverCode: null,
  serverName: null,

  setAuth(token, user) {
    localStorage.setItem('tc_token', token);
    localStorage.setItem('tc_user', JSON.stringify(user));
    set({ token, user });
  },

  setAvatar(colors) {
    set(s => {
      const user = s.user ? { ...s.user, ...colors } : s.user;
      if (user) localStorage.setItem('tc_user', JSON.stringify(user));
      return { user };
    });
  },

  setServer(code, name) {
    set({ serverCode: code, serverName: name });
  },

  logout() {
    localStorage.removeItem('tc_token');
    localStorage.removeItem('tc_user');
    set({ token: null, user: null, serverCode: null, serverName: null });
  },
}));
