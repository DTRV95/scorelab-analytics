const DEFAULT_API_URL = "http://localhost:8000";

function normalizeApiUrl(url: string | undefined) {
  if (!url) return DEFAULT_API_URL;
  return url.trim().replace(/\/+$/, "") || DEFAULT_API_URL;
}

export const API_BASE_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
