/**
 * Ultron API Base URL Configuration & Resolution
 * 
 * Manages dynamic endpoint resolution across:
 * 1. User runtime configuration in Settings (persisted in localStorage)
 * 2. Build-time environment variable (VITE_API_BASE_URL)
 * 3. Fallback for native Android APK (Capacitor)
 * 4. Relative paths for web hosting
 */

const STORAGE_KEY = 'ULTRON_API_BASE_URL';

// Default verified public remote backend URL
export const DEFAULT_REMOTE_BACKEND = 'https://ultron-command-center.onrender.com';

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. User explicit configuration from in-app Settings (takes highest precedence)
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.trim()) {
    return stored.trim().replace(/\/+$/, '');
  }

  // 2. Build-time environment variable
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 3. Native Capacitor Android App detection
  const isCapacitorNative = 
    window.location.protocol === 'capacitor:' || 
    window.location.protocol === 'ionic:' ||
    (window.location.hostname === 'localhost' && window.location.port === '');

  if (isCapacitorNative) {
    return DEFAULT_REMOTE_BACKEND;
  }

  // 4. Default: empty string (relative paths for web server / Vite dev proxy)
  return '';
}

export function setApiBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) {
    localStorage.setItem(STORAGE_KEY, clean);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function apiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}
