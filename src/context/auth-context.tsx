'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useLocale } from 'next-intl';
import { initAxiosService, refreshAxiosService, postWithApi, setAxiosLocale } from '@/services/axios-service';

export type UserRole = 'client' | 'station' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
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
  if (lower === 'admin') return 'admin';
  if (lower === 'station') return 'station';
  return 'client';
}

function normalizeUser(raw: Record<string, unknown>): AuthUser {
  return {
    ...raw,
    role: normalizeRole(String(raw.role || 'client')),
  } as AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const loginPath = `/${locale}/login`;
  const homePath = `/${locale}`;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ref to hold current token for the tokenGetter closure (avoids stale closures)
  const tokenRef = useRef<string | null>(null);

  // Race-condition guard for concurrent 401 refresh attempts
  const isRefreshingRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  // Keep axios Accept-Language in sync with the app locale
  useEffect(() => {
    setAxiosLocale(locale);
  }, [locale]);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
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
          tokenRef.current = data.access_token;
          setToken(data.access_token);
          setUser(normalized);
          return data.access_token;
        }
      }
    } catch {
      // Refresh failed
    }
    return null;
  }, []);

  const clearAuth = useCallback(() => {
    tokenRef.current = null;
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
    if (!isRefreshingRef.current) {
      isRefreshingRef.current = true;
      refreshPromiseRef.current = refreshAccessToken().finally(() => {
        isRefreshingRef.current = false;
        refreshPromiseRef.current = null;
      });
    }

    const newToken = await refreshPromiseRef.current;
    if (newToken) {
      refreshAxiosService({
        baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
        tokenGetter: () => tokenRef.current,
        onUnauthorized: () => { clearAuth(); },
      });
    } else {
      clearAuth();
    }
  }, [refreshAccessToken, clearAuth]);

  // On mount: restore session from the httpOnly refresh token cookie.
  // The user object is fetched from the server — nothing is read from localStorage.
  useEffect(() => {
    refreshAccessToken().then((newToken) => {
      if (newToken) {
        refreshAxiosService({
          baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
          tokenGetter: () => tokenRef.current,
          onUnauthorized: handleUnauthorized,
        });
      } else {
        initAxiosService({
          baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
        });
      }
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    const normalized = normalizeUser(newUser as unknown as Record<string, unknown>);
    tokenRef.current = newToken;
    setToken(newToken);
    setUser(normalized);
    refreshAxiosService({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
      tokenGetter: () => tokenRef.current,
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
    tokenRef.current = null;
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
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/auth/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
        credentials: 'include',
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const u = data?.data;
        if (u) {
          setUser(normalizeUser(u));
        }
      }
    } catch {
      // Silent fail; keep current user
    }
  }, [handleUnauthorized]);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
    refetchUser,
    isClient: user?.role === 'client',
    isStation: user?.role === 'station',
    isSuperAdmin: user?.role === 'admin',
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
