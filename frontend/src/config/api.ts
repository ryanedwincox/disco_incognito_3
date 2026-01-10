/**
 * API configuration with dynamic URL resolution.
 *
 * Determines the backend API URL based on:
 * 1. VITE_API_URL environment variable (if explicitly set and not localhost)
 * 2. Dynamic resolution using window.location.hostname (for remote access)
 */

const BACKEND_PORT = 8000;

function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;

  // If VITE_API_URL is explicitly set to a non-localhost value, use it
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }

  // For browser environments, derive API URL from current hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Use same hostname as frontend, just different port
    return `http://${hostname}:${BACKEND_PORT}`;
  }

  // Fallback for SSR or non-browser environments
  return envUrl || `http://localhost:${BACKEND_PORT}`;
}

export const API_URL = getApiUrl();
