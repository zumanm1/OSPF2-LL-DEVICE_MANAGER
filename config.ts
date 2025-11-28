/**
 * Application Configuration
 *
 * Dynamic API URL configuration that works for both:
 * - Local development: http://localhost:9050 → http://localhost:9051
 * - Remote access: http://172.16.39.172:9050 → http://172.16.39.172:9051
 */

// Get the API base URL dynamically based on current browser location
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return `http://${host}:9051/api`;
  }
  return 'http://localhost:9051/api';
};

// API Base URL (evaluated once at load time)
export const API_BASE_URL = getApiBaseUrl();

// Backend base URL (without /api)
export const getBackendUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return `http://${host}:9051`;
  }
  return 'http://localhost:9051';
};

export const BACKEND_URL = getBackendUrl();
