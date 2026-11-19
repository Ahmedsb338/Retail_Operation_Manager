export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly missingVariables?: string[];
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    options?: {
      code?: string;
      missingVariables?: string[];
      retryAfterSeconds?: number;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options?.code;
    this.missingVariables = options?.missingVariables;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;

export function onUnauthorizedResponse(listener: UnauthorizedListener | null) {
  unauthorizedListener = listener;
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON body
  }
  const message =
    typeof payload.error === 'string' && payload.error
      ? payload.error
      : `Request failed (${res.status})`;

  const err = new ApiError(message, res.status, {
    code: typeof payload.code === 'string' ? payload.code : undefined,
    missingVariables: Array.isArray(payload.missingVariables)
      ? payload.missingVariables.map(String)
      : undefined,
    retryAfterSeconds:
      typeof payload.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : undefined,
  });

  if (res.status === 401 && unauthorizedListener && !res.url.includes('/api/v1/auth/login')) {
    unauthorizedListener();
  }
  return err;
}

export async function apiRequest<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    skipAuthRedirect?: boolean;
  }
): Promise<T> {
  const method = options?.method || 'GET';
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    headers['X-CSRF-Check'] = '1';
  }
  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    if (options?.skipAuthRedirect && res.status === 401) {
      let msg = 'Unauthorized';
      try {
        const j = (await res.json()) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        // ignore
      }
      throw new ApiError(msg, 401);
    }
    throw await parseErrorResponse(res);
  }

  return (await res.json()) as T;
}

export async function apiDownloadFile(url: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read selected file'));
    reader.readAsDataURL(file);
  });
}

export function buildQueryParams(params: Record<string, string | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      sp.set(k, String(v).trim());
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}
