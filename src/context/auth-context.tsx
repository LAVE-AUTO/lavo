'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useLocale } from 'next-intl';
import { initAxiosService, refreshAxiosService, postWithApi, setAxiosLocale } from '@/services/axios-service';

const AUTH_TOKEN_KEY = 'lavo_auth_token';
const AUTH_USER_KEY = 'lavo_auth_user';

export type UserRole = 'CLIENT' | 'STATION' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  station_id?: string | null;
  force_password_change?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  refetchUser: () => Promise<void>;
  isClient: boolean;
  isStation: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeRole(role: string): UserRole {
  const lower = role.toLowerCase();
  if (lower === 'admin') return 'SUPER_ADMIN';
  if (lower === 'station') return 'STATION';
  return 'CLIENT';
}

function normalizeUser(raw: Record<string, unknown>): AuthUser {
  return {
    ...raw,
    role: normalizeRole(String(raw.role || 'client')),
  } as AuthUser;
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function setStoredAuth(token: string | null, user: AuthUser | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const loginPath = `/${locale}/login`;
  const homePath = `/${locale}`;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Keep axios Accept-Language in sync with the app locale
  useEffect(() => {
    setAxiosLocale(locale);
  }, [locale]);

  const clearAuth = useCallback(() => {
    setStoredAuth(null, null);
    setToken(null);
    setUser(null);
    initAxiosService({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
    });
    if (typeof window !== 'undefined') {
      window.location.href = loginPath;
    }
  }, [loginPath]);

  const handleUnauthorized = useCallback(async () => {
    // Try to refresh the token before logging out
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const body = await res.json();
        const data = body.data;
        if (data && data.access_token && data.user) {
          const normalized = normalizeUser(data.user);
          setStoredAuth(data.access_token, normalized);
          setToken(data.access_token);
          setUser(normalized);
          refreshAxiosService({
            baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
            tokenGetter: () => getStoredToken(),
            onUnauthorized: () => { clearAuth(); },
          });
          return;
        }
      }
    } catch {
      // Refresh failed, clear auth
    }
    clearAuth();
  }, [clearAuth]);

  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();

    const id = setTimeout(() => {
      if (storedToken) {
        setToken(storedToken);
        if (storedUser) {
          const normalized = normalizeUser(storedUser as unknown as Record<string, unknown>);
          setUser(normalized);
        }

        refreshAxiosService({
          baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
          tokenGetter: () => getStoredToken(),
          onUnauthorized: handleUnauthorized,
        });
      } else {
        initAxiosService({
          baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
        });
      }

      setIsLoading(false);
    }, 0);

    return () => clearTimeout(id);
  }, [handleUnauthorized, loginPath]);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    const normalized = normalizeUser(newUser as unknown as Record<string, unknown>);
    setStoredAuth(newToken, normalized);
    setToken(newToken);
    setUser(normalized);
    refreshAxiosService({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
      tokenGetter: () => getStoredToken(),
      onUnauthorized: () => {
        clearAuth();
      },
    });
  }, [clearAuth]);

  const logout = useCallback(async () => {
    try {
      await postWithApi('/auth/logout', null, { successStatus: 200 });
    } catch {
      // Logout API failure is non-blocking
    }
    setStoredAuth(null, null);
    setToken(null);
    setUser(null);
    initAxiosService({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
    });
    if (typeof window !== 'undefined') {
      window.location.href = homePath;
    }
  }, [homePath]);

  const refetchUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const u = data?.data ?? data?.user;
        if (u) {
          const normalized = normalizeUser(u);
          setUser(normalized);
          setStoredAuth(token, normalized);
        }
      }
    } catch {
      // Silent fail; keep current user
    }
  }, [token, handleUnauthorized]);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
    refetchUser,
    isClient: user?.role === 'CLIENT',
    isStation: user?.role === 'STATION',
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
