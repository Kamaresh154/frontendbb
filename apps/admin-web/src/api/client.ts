import axios, { type AxiosError } from "axios";
import type { TokenResponse } from "@kidzventure/shared-types";

const baseURL = "https://backend-5-1ptj.onrender.com";

export const api = axios.create({
  baseURL: baseURL ? `${baseURL}/api/v1` : "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// ── Request: attach access token ───────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: handle 401 with one refresh attempt ─────────────────────────
// These endpoints must NEVER trigger a refresh attempt (they ARE auth endpoints)
const NO_REFRESH_URLS = ["/auth/login", "/auth/refresh", "/auth/me", "/auth/register"];

let refreshPromise: Promise<string> | null = null;
let isRedirecting = false;

function redirectToLogin(reason = "") {
  if (isRedirecting) return;
  isRedirecting = true;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  // Add a small delay so any in-flight requests can abort cleanly
  setTimeout(() => {
    const url = new URL("/login", window.location.origin);
    if (reason) url.searchParams.set("reason", reason);
    window.location.replace(url.toString());
    isRedirecting = false;
  }, 100);
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    const status = error.response?.status;
    const url = original?.url ?? "";

    // Not a 401 → reject normally
    if (status !== 401) return Promise.reject(error);

    // Auth endpoints themselves failed → clear & redirect
    if (NO_REFRESH_URLS.some((u) => url.includes(u))) {
      // Only redirect if we actually had tokens (not just a fresh visit)
      const hadTokens = !!localStorage.getItem("refresh_token");
      if (hadTokens) redirectToLogin("session_expired");
      return Promise.reject(error);
    }

    // Already retried → give up
    if (original?._retry) {
      redirectToLogin("session_expired");
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      // No refresh token at all → just let the caller handle it
      return Promise.reject(error);
    }

    // Mark as retried before awaiting so concurrent 401s don't stack
    if (original) original._retry = true;

    // Deduplicate concurrent refresh calls
    if (!refreshPromise) {
      refreshPromise = api
        .post<TokenResponse>("/auth/refresh", { refresh_token: refreshToken })
        .then((r) => {
          localStorage.setItem("access_token", r.data.access_token);
          localStorage.setItem("refresh_token", r.data.refresh_token);
          return r.data.access_token;
        })
        .catch((refreshErr) => {
          redirectToLogin("session_expired");
          return Promise.reject(refreshErr);
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      const newToken = await refreshPromise;
      if (original) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    } catch {
      // redirectToLogin already called above
    }

    return Promise.reject(error);
  }
);
