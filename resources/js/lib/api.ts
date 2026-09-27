import { withRequestSignal } from './request';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const native = Capacitor.isNativePlatform();
  if (native && !baseUrl.startsWith('https://'))
    throw new ApiError('The mobile service is not configured yet.', 503);
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.method && options.method !== 'GET') headers.set('X-MadaTours-Client', '1');
  return withRequestSignal(async (signal) => {
    let data: unknown;
    let status: number;
    if (native) {
      // The platform HTTP client keeps HttpOnly session cookies outside JavaScript storage.
      const response = await CapacitorHttp.request({
        url: `${baseUrl}/api${path}`,
        method: options.method || 'GET',
        headers: Object.fromEntries(headers.entries()),
        data: typeof options.body === 'string' ? JSON.parse(options.body) : undefined,
        responseType: 'json',
        readTimeout: 15000,
        connectTimeout: 10000,
      });

      data = response.data;
      status = response.status;
    } else {
      const response = await fetch(`${baseUrl}/api${path}`, {
        ...options,
        headers,
        credentials: 'include',
        signal,
      });
      data = await response.json().catch(() => null);
      status = response.status;
    }
    if (status < 200 || status >= 300) {
      const message =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'The request could not be completed. Please try again.';
      throw new ApiError(message, status);
    }
    if (data === null) throw new ApiError('The service returned an unexpected response.', 502);
    return data as T;
  }, options.signal);
}
export const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'Could not connect. Check your internet connection and try again.';
