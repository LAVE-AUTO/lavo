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

// ---------------------------------------------------------------------------
// Session cache — sessionStorage (tab-isolated, cleared on tab close).
// Stores the short-lived access token + user alongside its expiry so that
// hard reloads within the same browser tab can restore auth state without a
// blocking /auth/refresh round-trip. The refresh token stays in httpOnly
// cookies; this cache only mirrors what is already accessible to client JS.
// ---------------------------------------------------------------------------
const SESSION_CACHE_KEY = 'HL_sess';
const TOKEN_CACHE_TTL_MS = 14 * 60 * 1000; // 14 min (assuming 15-min tokens)

interface SessionCache {
  token: string;
  user: AuthUser;
  exp: number;
}

function readSessionCache(): SessionCache | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCache;
    // Require at least 60 s remaining to avoid using a nearly-expired token
    if (parsed.exp > Date.now() + 60_000) return parsed;
    sessionStorage.removeItem(SESSION_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function writeSessionCache(token: string, user: AuthUser): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      token,
      user,
      exp: Date.now() + TOKEN_CACHE_TTL_MS,
    } satisfies SessionCache));
  } catch {}
}

function clearSessionCache(): void {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.removeItem(SESSION_CACHE_KEY); } catch {}
}

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
  /** ISO timestamp set when the user clicks the verification email link. Null until then. */
  email_verified_at?: string | null;
  /** ISO timestamp of account creation - used as "member since" on the profile page. */
  created_at?: string;
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

/** Returns "; Secure" when the page is served over HTTPS. */
function secureFlag(): string {
  return typeof window !== 'undefined' && window.isSecureContext ? '; Secure' : '';
}

function setRoleCookie(role: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `Hurryline_auth_role=${role}; path=/; SameSite=Lax${secureFlag()}`;
}

function clearRoleCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `Hurryline_auth_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag()}`;
}

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

  // Prevents double clearAuth calls (concurrent 401s, StrictMode double-effects)
  const isLoggedOutRef = useRef(false);

  // Always holds the latest clearAuth so the axios interceptor never captures a stale closure
  const latestClearAuthRef = useRef<() => void>(() => {});

  // Prevents the StrictMode double-invocation from running the mount effect twice
  const hasMountedRef = useRef(false);

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
          writeSessionCache(data.access_token, normalized);
          // Hint cookie for middleware-level admin guard (non-httpOnly, non-sensitive)
          if (typeof document !== 'undefined') {
            if (normalized.role === 'admin') {
              document.cookie = `Hurryline_admin_session=1; path=/; SameSite=Lax${secureFlag()}`;
            } else {
              document.cookie = `Hurryline_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag()}`;
            }
            setRoleCookie(normalized.role);
          }
          return data.access_token;
        }
      }
    } catch {
      // Refresh failed
    }
    return null;
  }, []);

  const clearAuth = useCallback(() => {
    if (isLoggedOutRef.current) return;
    isLoggedOutRef.current = true;
    clearSessionCache();
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    initAxiosService({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
    });
    if (typeof document !== 'undefined') {
      document.cookie = `Hurryline_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag()}`;
      clearRoleCookie();
    }
    if (typeof window !== 'undefined') {
      window.location.replace(loginPath);
    }
  }, [loginPath]);

  // Keep the ref in sync so the axios interceptor always redirects to the correct locale
  useEffect(() => {
    latestClearAuthRef.current = clearAuth;
  }, [clearAuth]);

  // Deduplicated refresh - multiple concurrent callers share the same in-flight promise.
  const tryRefreshToken = useCallback(async (): Promise<string | null> => {
    if (!isRefreshingRef.current) {
      isRefreshingRef.current = true;
      refreshPromiseRef.current = refreshAccessToken().finally(() => {
        isRefreshingRef.current = false;
        refreshPromiseRef.current = null;
      });
    }
    return refreshPromiseRef.current;
  }, [refreshAccessToken]);

  // Used by refetchUser (raw fetch, not axios) - clears session when refresh fails.
  const handleUnauthorized = useCallback(async () => {
    const newToken = await tryRefreshToken();
    if (!newToken) clearAuth();
  }, [tryRefreshToken, clearAuth]);

  // On mount: restore session — either from tab-local cache (instant) or via
  // a blocking /auth/refresh call (first load or expired session).
  // hasMountedRef prevents the StrictMode double-invocation from rotating the
  // httpOnly refresh cookie twice and clearing the session on the second call.
  useEffect(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;

    const axiosOpts = {
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
      tokenGetter: () => tokenRef.current,
      tokenRefresher: tryRefreshToken,
      onUnauthorized: () => latestClearAuthRef.current(),
    };

    const cached = readSessionCache();

    if (cached) {
      // Fast path: restore token + user immediately → layouts unblock with no
      // network call. A silent background refresh rotates the token so the
      // session cache stays fresh and the interceptor stays healthy.
      tokenRef.current = cached.token;
      setToken(cached.token);
      setUser(cached.user);
      if (typeof document !== 'undefined') {
        if (cached.user.role === 'admin') {
          document.cookie = `Hurryline_admin_session=1; path=/; SameSite=Lax${secureFlag()}`;
        } else {
          document.cookie = `Hurryline_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag()}`;
        }
        setRoleCookie(cached.user.role);
      }
      refreshAxiosService(axiosOpts);
      setIsLoading(false);
      // Background rotation — failure is non-fatal; interceptor handles 401 later.
      tryRefreshToken().catch(() => {});
    } else {
      // Slow path: no valid cache — blocking refresh (first visit or expired session).
      tryRefreshToken().then(async (newToken) => {
        if (!newToken) {
          // Refresh failed — clear hint cookies so middleware stops redirecting
          // /login → /admin and creating an infinite loop.
          if (typeof document !== 'undefined') {
            const expired = '; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
            document.cookie = `Hurryline_admin_session=${expired}`;
            document.cookie = `Hurryline_auth_role=${expired}`;
          }
          // Clear the httpOnly refresh cookie server-side.
          await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          }).catch(() => {});
        }
        refreshAxiosService(axiosOpts);
        setIsLoading(false);
      }).catch(() => {
        // Safety net: ensure layouts are never permanently stuck.
        setIsLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    isLoggedOutRef.current = false; // Allow clearAuth to fire again after re-login
    const normalized = normalizeUser(newUser as unknown as Record<string, unknown>);
    tokenRef.current = newToken;
    setToken(newToken);
    setUser(normalized);
    writeSessionCache(newToken, normalized);
    // Hint cookies for middleware-level guards (non-httpOnly, non-sensitive)
    if (typeof document !== 'undefined') {
      if (normalized.role === 'admin') {
        document.cookie = `Hurryline_admin_session=1; path=/; SameSite=Lax${secureFlag()}`;
      } else {
        document.cookie = `Hurryline_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag()}`;
      }
      setRoleCookie(normalized.role);
    }
    refreshAxiosService({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
      tokenGetter: () => tokenRef.current,
      tokenRefresher: tryRefreshToken,
      onUnauthorized: () => latestClearAuthRef.current(),
    });
  }, [tryRefreshToken]);

  const logout = useCallback(async () => {
    try {
      await postWithApi('/auth/logout', null, { successStatus: 200 });
    } catch {
      // Logout API failure is non-blocking
    }
    clearSessionCache();
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    initAxiosService({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
    });
    if (typeof document !== 'undefined') {
      document.cookie = `Hurryline_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag()}`;
      clearRoleCookie();
    }
    // replace() instead of href so the logged-in pages are not in browser history
    if (typeof window !== 'undefined') {
      window.location.replace(`${homePath}`);
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
        await handleUnauthorized();
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
