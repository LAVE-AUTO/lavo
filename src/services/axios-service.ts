import axios, { type AxiosInstance } from 'axios';
import { API_TIMEOUT, HTTP_STATUS } from '@/helpers/constants';

const DEFAULT_BASE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
  '/api/v1';
const DEFAULT_TIMEOUT = API_TIMEOUT;

let currentLocale = 'fr';

/**
 * Token getter type for auth injection.
 * Can be sync (localStorage) or async (AsyncStorage).
 */
export type TokenGetter = () => string | null | Promise<string | null>;

/**
 * Options for creating an axios instance.
 */
export interface CreateAxiosInstanceOptions {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  tokenGetter?: TokenGetter;
  onUnauthorized?: () => void;
  /**
   * Called on 401 responses for authenticated requests.
   * Should attempt a token refresh and return the new access token, or null on failure.
   * When provided, the original request is retried once with the new token.
   * Falls back to onUnauthorized() when the refresh returns null.
   */
  tokenRefresher?: () => Promise<string | null>;
}

let defaultInstance: AxiosInstance;

/**
 * Create a customizable axios instance.
 *
 * Generic and versatile: supports custom base URL, timeout, headers,
 * optional auth token injection via token getter, and optional 401 handler.
 *
 * @param options - Configuration options
 * @returns Configured AxiosInstance
 *
 * @example
 * const api = createAxiosInstance({
 *   baseURL: '/api/v1',
 *   tokenGetter: () => localStorage.getItem('auth_token'),
 *   onUnauthorized: () => window.location.href = '/login',
 * });
 */
export function createAxiosInstance(
  options: CreateAxiosInstanceOptions | string = {}
): AxiosInstance {
  const opts =
    typeof options === 'string'
      ? { baseURL: options }
      : (options as CreateAxiosInstanceOptions);

  const {
    baseURL = DEFAULT_BASE_URL,
    timeout = DEFAULT_TIMEOUT,
    headers = {},
    tokenGetter,
    onUnauthorized,
    tokenRefresher,
  } = opts;

  const instance = axios.create({
    baseURL,
    timeout,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  instance.interceptors.request.use(
    async (config) => {
      config.headers['Accept-Language'] = currentLocale;
      if (tokenGetter) {
        const token = await Promise.resolve(tokenGetter());
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  if (tokenRefresher || onUnauthorized) {
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalConfig = error.config as (typeof error.config) & { _retried?: boolean };
        const is401 = error.response?.status === HTTP_STATUS.UNAUTHORIZED;

        if (is401) {
          const hadAuthHeader = !!originalConfig?.headers?.Authorization;

          // Authenticated request expired - try to refresh and retry once.
          if (hadAuthHeader && tokenRefresher && !originalConfig._retried) {
            originalConfig._retried = true;
            const newToken = await tokenRefresher();
            if (newToken) {
              originalConfig.headers.Authorization = `Bearer ${newToken}`;
              return instance(originalConfig);
            }
            // Refresh failed - fall through to logout handler.
            if (onUnauthorized) onUnauthorized();
            return Promise.reject(error);
          }

          // No tokenRefresher configured - legacy direct handler.
          if (!tokenRefresher && onUnauthorized) {
            onUnauthorized();
          }
        }

        return Promise.reject(error);
      }
    );
  }

  return instance;
}

/**
 * Initialize the default axios instance.
 * Call this once at app bootstrap with your token getter and optional handlers.
 */
export function initAxiosService(options?: CreateAxiosInstanceOptions): AxiosInstance {
  defaultInstance = createAxiosInstance(options ?? { baseURL: DEFAULT_BASE_URL });
  return defaultInstance;
}

/**
 * Get the default axios instance.
 * Falls back to a basic instance if initAxiosService was not called.
 */
export function getAxiosInstance(): AxiosInstance {
  if (!defaultInstance) {
    defaultInstance = createAxiosInstance({});
  }
  return defaultInstance;
}

/**
 * Refresh the default instance with new options.
 */
export function refreshAxiosService(options?: CreateAxiosInstanceOptions): AxiosInstance {
  defaultInstance = createAxiosInstance(options ?? { baseURL: DEFAULT_BASE_URL });
  return defaultInstance;
}

/**
 * Set a new base URL for the default instance.
 * Creates a new instance; tokenGetter and onUnauthorized are cleared.
 * Use refreshAxiosService with full options to preserve auth and 401 handler.
 */
export function setBaseURL(newBaseURL: string): void {
  defaultInstance = createAxiosInstance({
    baseURL: newBaseURL,
    timeout: DEFAULT_TIMEOUT,
  });
}

/**
 * Update the locale sent via Accept-Language on every request.
 */
export function setAxiosLocale(locale: string): void {
  currentLocale = locale;
}

/**
 * Request options for HTTP helpers.
 */
export interface RequestOptions {
  successStatus?: number;
  timeout?: number;
  instance?: AxiosInstance;
}

/**
 * Get data from API.
 * Returns [success, data] tuple (Leroi pattern).
 *
 * @param endpoint - API endpoint path
 * @param options - Request options
 * @returns Promise<[boolean, T | ErrorData]>
 */
export async function getFromApi<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<[boolean, T | { message?: string }]> {
  const {
    successStatus = HTTP_STATUS.OK,
    timeout,
    instance = getAxiosInstance(),
  } = options;

  try {
    const config = timeout ? { timeout } : {};
    const result = await instance.get<T>(endpoint, config);
    if (result.status === successStatus) {
      return [true, result.data];
    }
    return [false, result.data as { message?: string }];
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown } };
    return [
      false,
      (err.response?.data as { message?: string }) ?? { message: 'Request failed' },
    ];
  }
}

/**
 * Post data to API.
 *
 * @param endpoint - API endpoint path
 * @param data - Payload (optional for some APIs)
 * @param options - Request options
 * @returns Promise<[boolean, T | ErrorData]>
 */
export async function postWithApi<T = unknown>(
  endpoint: string,
  data: unknown = null,
  options: RequestOptions & { successStatus?: number } = {}
): Promise<[boolean, T | { message?: string }]> {
  const {
    successStatus = HTTP_STATUS.CREATED,
    timeout,
    instance = getAxiosInstance(),
  } = options;

  try {
    const config = timeout ? { timeout } : {};
    const result =
      data !== null
        ? await instance.post<T>(endpoint, data, config)
        : await instance.post<T>(endpoint, undefined, config);

    if (
      result.status === successStatus ||
      result.status === HTTP_STATUS.OK
    ) {
      return [true, result.data];
    }
    return [false, result.data as { message?: string }];
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown } };
    return [
      false,
      (err.response?.data as { message?: string }) ?? { message: 'Post failed' },
    ];
  }
}

/**
 * Update resource via API (PUT).
 *
 * @param endpoint - Full URL or base path
 * @param data - Payload
 * @param options - Request options; id + autoJoin appends id to endpoint
 * @returns Promise<[boolean, T | ErrorData]>
 */
export async function updateWithApi<T = unknown>(
  endpoint: string,
  data: unknown,
  options: RequestOptions & { id?: string | null; autoJoin?: boolean } = {}
): Promise<[boolean, T | { message?: string }]> {
  const {
    id = null,
    autoJoin = true,
    successStatus = HTTP_STATUS.OK,
    timeout,
    instance = getAxiosInstance(),
  } = options;

  if (!data) {
    return [false, { message: 'No data provided' }];
  }

  try {
    let url = endpoint;
    if (autoJoin && id) {
      url = url.replace(/\/$/, '') + '/' + id;
    }

    const config = timeout ? { timeout } : {};
    const result = await instance.put<T>(url, data, config);

    if (result.status === successStatus) {
      return [true, result.data];
    }
    return [false, result.data as { message?: string }];
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown } };
    return [
      false,
      (err.response?.data as { message?: string }) ?? { message: 'Update failed' },
    ];
  }
}

/**
 * Delete resource via API.
 *
 * @param endpoint - Full URL or base path
 * @param options - Request options; id + autoJoin appends id to endpoint
 * @returns Promise<[boolean, T | ErrorData]>
 */
export async function deleteWithApi<T = unknown>(
  endpoint: string,
  options: RequestOptions & { id?: string | null; autoJoin?: boolean; data?: unknown } = {}
): Promise<[boolean, T | { message?: string }]> {
  const {
    id = null,
    autoJoin = true,
    successStatus = HTTP_STATUS.OK,
    timeout,
    data,
    instance = getAxiosInstance(),
  } = options;

  try {
    let url = endpoint;
    if (autoJoin && id) {
      url = url.replace(/\/$/, '') + '/' + id;
    }

    const config = { ...(timeout ? { timeout } : {}), ...(data !== undefined ? { data } : {}) };
    const result = await instance.delete<T>(url, config);

    if (
      result.status === successStatus ||
      result.status === HTTP_STATUS.NO_CONTENT
    ) {
      return [true, result.data];
    }
    return [false, result.data as { message?: string }];
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown } };
    return [
      false,
      (err.response?.data as { message?: string }) ?? { message: 'Delete failed' },
    ];
  }
}

/**
 * Patch resource via API.
 *
 * @param endpoint - API endpoint path
 * @param data - Partial payload
 * @param options - Request options
 * @returns Promise<[boolean, T | ErrorData]>
 */
export async function patchWithApi<T = unknown>(
  endpoint: string,
  data: unknown,
  options: RequestOptions = {}
): Promise<[boolean, T | { message?: string }]> {
  const {
    successStatus = HTTP_STATUS.OK,
    timeout,
    instance = getAxiosInstance(),
  } = options;

  if (!data) {
    return [false, { message: 'No data provided' }];
  }

  try {
    const config = timeout ? { timeout } : {};
    const result = await instance.patch<T>(endpoint, data, config);

    if (result.status === successStatus) {
      return [true, result.data];
    }
    return [false, result.data as { message?: string }];
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown } };
    return [
      false,
      (err.response?.data as { message?: string }) ?? { message: 'Patch failed' },
    ];
  }
}
