import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ApiError, buildQueryParams, onUnauthorizedResponse } from './apiClient';

export { ApiError, buildQueryParams, onUnauthorizedResponse };

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface ApiRequestOptions<TBody = unknown> {
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  skipAuthRedirect?: boolean;
  data?: TBody;
}

export interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  skipAuthRedirect?: boolean;
}

export interface HealthStatusResponse {
  status: string;
  service?: string;
  databaseConfigured: boolean;
  supabaseRestOnly?: boolean;
  geminiConfigured?: boolean;
  timestamp?: string;
}

let unauthorizedCallback: (() => void) | null = null;

export function setApiUnauthorizedHandler(listener: (() => void) | null): void {
  unauthorizedCallback = listener;
  onUnauthorizedResponse(listener);
}

/**
 * Safely parses and normalizes VITE_API_BASE_URL without ever throwing at import time.
 * Only http:// and https:// URLs (or empty string for same-origin relative /api calls) are accepted.
 */
export function resolveSafeApiBaseUrl(rawOverride?: string): string {
  const envValue =
    rawOverride !== undefined
      ? rawOverride
      : typeof import.meta !== 'undefined' &&
          (import.meta as unknown as { env?: Record<string, string | undefined> }).env
            ?.VITE_API_BASE_URL;

  const trimmed = typeof envValue === 'string' ? envValue.trim() : '';
  if (!trimmed) return '';

  // Allow root-relative API prefixes such as "/backend"
  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/+$/, '');
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn(
        `[ASB Workforce API] Ignoring unsupported VITE_API_BASE_URL protocol "${parsed.protocol}". Falling back to same-origin.`
      );
      return '';
    }
    const cleanPath = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${cleanPath}`;
  } catch {
    console.warn(
      '[ASB Workforce API] Invalid VITE_API_BASE_URL format. Falling back to same-origin relative requests.'
    );
    return '';
  }
}

const API_BASE_URL = resolveSafeApiBaseUrl();

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function resolveSafeApiUrl(path: string, baseOverride?: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = baseOverride !== undefined ? resolveSafeApiBaseUrl(baseOverride) : API_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

function getHeaderCaseInsensitive(
  headers: unknown,
  targetName: string
): string {
  if (!headers || typeof headers !== 'object') return '';
  const target = targetName.toLowerCase();
  const record = headers as Record<string, unknown>;
  if (typeof (record as { get?: unknown }).get === 'function') {
    const val = (record as { get: (k: string) => unknown }).get(targetName);
    return val ? String(val) : '';
  }
  for (const [k, v] of Object.entries(record)) {
    if (k.toLowerCase() === target && v !== undefined && v !== null) {
      return String(v);
    }
  }
  return '';
}

function isHtmlPayload(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  const snippet = data.trimStart().slice(0, 120).toLowerCase();
  return snippet.startsWith('<!doctype html') || snippet.startsWith('<html');
}

export function normalizeAxiosError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError(
      error instanceof Error && error.message ? error.message : 'Unexpected API client error.',
      500
    );
  }

  const axiosErr = error as AxiosError<Record<string, unknown>>;
  const config = (axiosErr.config || {}) as ExtendedAxiosRequestConfig;
  const response = axiosErr.response;

  // Network error, DNS/TCP failure, CORS block, or request timeout: backend unreachable
  if (!response) {
    const isTimeout =
      axiosErr.code === 'ECONNABORTED' ||
      axiosErr.code === 'ETIMEDOUT' ||
      /timeout/i.test(axiosErr.message || '');

    return new ApiError(
      isTimeout
        ? 'Backend API request timed out while waiting for a response.'
        : 'Unable to reach backend API server. Verify the backend is running and VITE_API_BASE_URL is reachable.',
      503,
      { code: 'BACKEND_UNAVAILABLE' }
    );
  }

  const status = response.status;
  const contentType = getHeaderCaseInsensitive(response.headers, 'content-type').toLowerCase();
  const payload =
    response.data && typeof response.data === 'object' && !Array.isArray(response.data)
      ? (response.data as Record<string, unknown>)
      : {};

  // Detect static hosting / SPA fallback intercepting /api/* routes
  const isStaticHostRejection =
    status === 405 ||
    (status === 404 && (contentType.includes('text/html') || isHtmlPayload(response.data)));

  if (isStaticHostRejection) {
    return new ApiError(
      status === 405
        ? 'Backend API returned 405 Method Not Allowed (this host appears to be serving static files without the /api/v1 backend).'
        : 'Backend API endpoint was not found (static HTML returned instead of JSON).',
      status,
      { code: 'BACKEND_UNAVAILABLE' }
    );
  }

  const message =
    typeof payload.error === 'string' && payload.error
      ? payload.error
      : `Request failed (${status})`;

  const retryHeader = getHeaderCaseInsensitive(response.headers, 'retry-after');
  const retryFromHeader = retryHeader ? Number(retryHeader) : Number.NaN;
  const retryAfterSeconds =
    typeof payload.retryAfterSeconds === 'number'
      ? payload.retryAfterSeconds
      : Number.isFinite(retryFromHeader) && retryFromHeader > 0
        ? retryFromHeader
        : undefined;

  const apiErr = new ApiError(message, status, {
    code: typeof payload.code === 'string' ? payload.code : undefined,
    missingVariables: Array.isArray(payload.missingVariables)
      ? payload.missingVariables.map(String)
      : undefined,
    retryAfterSeconds,
  });

  const reqUrl = String(config.url || '');
  if (
    status === 401 &&
    !config.skipAuthRedirect &&
    unauthorizedCallback &&
    !reqUrl.includes('/api/v1/auth/login')
  ) {
    unauthorizedCallback();
  }

  return apiErr;
}

export function createApiInstance(baseUrlOverride?: string): AxiosInstance {
  const baseURL =
    baseUrlOverride !== undefined ? resolveSafeApiBaseUrl(baseUrlOverride) : API_BASE_URL;

  const instance = axios.create({
    baseURL: baseURL || undefined,
    withCredentials: true,
    timeout: 20000,
    headers: {
      Accept: 'application/json',
    },
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const method = String(config.method || 'GET').toUpperCase();
    if (MUTATING_METHODS.has(method)) {
      config.headers.set('X-CSRF-Check', '1');
    }
    if (
      config.data !== undefined &&
      typeof FormData !== 'undefined' &&
      !(config.data instanceof FormData) &&
      !config.headers.get('Content-Type')
    ) {
      config.headers.set('Content-Type', 'application/json');
    }
    return config;
  });

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const responseType = String(response.config?.responseType || '').toLowerCase();
      if (responseType === 'blob' || responseType === 'arraybuffer' || responseType === 'text') {
        return response;
      }

      const contentType = getHeaderCaseInsensitive(response.headers, 'content-type').toLowerCase();
      if (
        (contentType && !contentType.includes('application/json') && !contentType.includes('+json')) ||
        isHtmlPayload(response.data)
      ) {
        return Promise.reject(
          new ApiError(
            'Received non-JSON response from /api/v1 (this URL appears to be serving static frontend files without the backend server).',
            503,
            { code: 'BACKEND_UNAVAILABLE' }
          )
        );
      }

      return response;
    },
    (error: unknown) => Promise.reject(normalizeAxiosError(error))
  );

  return instance;
}

export const api: AxiosInstance = createApiInstance();

export async function apiGet<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const res = await api.get<T>(path, {
    params: options?.params,
    headers: options?.headers,
    timeout: options?.timeout,
    signal: options?.signal,
    skipAuthRedirect: options?.skipAuthRedirect,
  } as ExtendedAxiosRequestConfig);
  return res.data;
}

export async function apiPost<T, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: ApiRequestOptions
): Promise<T> {
  const res = await api.post<T>(path, body, {
    params: options?.params,
    headers: options?.headers,
    timeout: options?.timeout,
    signal: options?.signal,
    skipAuthRedirect: options?.skipAuthRedirect,
  } as ExtendedAxiosRequestConfig);
  return res.data;
}

export async function apiPut<T, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: ApiRequestOptions
): Promise<T> {
  const res = await api.put<T>(path, body, {
    params: options?.params,
    headers: options?.headers,
    timeout: options?.timeout,
    signal: options?.signal,
    skipAuthRedirect: options?.skipAuthRedirect,
  } as ExtendedAxiosRequestConfig);
  return res.data;
}

export async function apiPatch<T, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: ApiRequestOptions
): Promise<T> {
  const res = await api.patch<T>(path, body, {
    params: options?.params,
    headers: options?.headers,
    timeout: options?.timeout,
    signal: options?.signal,
    skipAuthRedirect: options?.skipAuthRedirect,
  } as ExtendedAxiosRequestConfig);
  return res.data;
}

export async function apiDelete<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const res = await api.delete<T>(path, {
    params: options?.params,
    headers: options?.headers,
    timeout: options?.timeout,
    signal: options?.signal,
    data: options?.data,
    skipAuthRedirect: options?.skipAuthRedirect,
  } as ExtendedAxiosRequestConfig);
  return res.data;
}

export async function checkBackendHealth(options?: {
  timeout?: number;
  signal?: AbortSignal;
}): Promise<HealthStatusResponse> {
  return apiGet<HealthStatusResponse>('/api/v1/health', {
    timeout: options?.timeout ?? 8000,
    signal: options?.signal,
    skipAuthRedirect: true,
  });
}

export default api;
