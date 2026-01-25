/**
 * API configuration with dynamic URL resolution.
 *
 * Determines the backend API URL based on:
 * 1. VITE_API_URL environment variable (if explicitly set)
 * 2. Dynamic resolution using window.location.hostname (for remote access)
 *
 * Port configuration:
 * - Main branch uses port 8000
 * - Feature branches use port 9000 (for worktree isolation)
 */

// Default backend port - can be overridden via VITE_API_URL
const DEFAULT_BACKEND_PORT = 8000;

function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;

  // If VITE_API_URL is explicitly set, always use it (supports worktree port isolation)
  if (envUrl) {
    return envUrl;
  }

  // For browser environments, derive API URL from current hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Use same hostname as frontend, just different port
    return `http://${hostname}:${DEFAULT_BACKEND_PORT}`;
  }

  // Fallback for SSR or non-browser environments
  return `http://localhost:${DEFAULT_BACKEND_PORT}`;
}

export const API_URL = getApiUrl();
