import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE, setAuthUser } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  created_at?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => {},
});

const TOKEN_KEY = 'mpuza-auth-token';

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/auth${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  return res.json();
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persist = useCallback((u: AuthUser, t: string) => {
    setUser(u);
    setToken(t);
    try {
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem('mpuza-auth-user', JSON.stringify({ id: u.id }));
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = localStorage.getItem(TOKEN_KEY);
        if (!saved) return;
        const data = await api('/me', { headers: { Authorization: `Bearer ${saved}` } });
        if (data.success && data.user) {
          persist(data.user, saved);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem('mpuza-auth-user');
        }
      } catch {
        /* offline — stay logged out, anonymous tracking still works */
      } finally {
        setLoading(false);
      }
    })();
  }, [persist]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!data.success) return { ok: false as const, message: data.message || 'Login failed' };
      persist(data.user, data.token);
      setAuthUser(data.user);
      return { ok: true as const };
    } catch {
      return { ok: false as const, message: 'Could not reach the server. Try again.' };
    }
  }, [persist]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      const data = await api('/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      if (!data.success) return { ok: false as const, message: data.message || 'Registration failed' };
      persist(data.user, data.token);
      setAuthUser(data.user);
      return { ok: true as const };
    } catch {
      return { ok: false as const, message: 'Could not reach the server. Try again.' };
    }
  }, [persist]);

  const logout = useCallback(async () => {
    try {
      if (token) await api('/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch {}
    setUser(null);
    setToken(null);
    setAuthUser(null);
  }, [token]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  return useContext(AuthContext);
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
