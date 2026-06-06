import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TokenResponse, UserProfile } from "@kidzventure/shared-types";
import { api } from "../api/client";

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function storeTokens(data: TokenResponse) {
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Guard against React StrictMode double-invocation
  const initDone = useRef(false);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<UserProfile>("/auth/me");
      setUser(data);
    } catch (err: any) {
      // 401 here means both access + refresh token failed (interceptor already cleared tokens)
      setUser(null);
      clearTokens();
      // Only show "session expired" if we actually had a token (not first visit)
      if (err?.response?.status === 401 && token) {
        setSessionExpired(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Prevent double-fetch in React 18 StrictMode
    if (initDone.current) return;
    initDone.current = true;
    fetchMe();
  }, [fetchMe]);

  // Also listen for the redirect-to-login signal from the interceptor
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session_expired") {
      setSessionExpired(true);
      // Clean up the URL
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
  const { data } = await api.post<TokenResponse>("/auth/login", {
    email,
    password,
    device_id: crypto.randomUUID(),
    device_name: navigator.userAgent,
  });

  storeTokens(data);

  const me = await api.get<UserProfile>("/auth/me");

  setUser(me.data);
  setSessionExpired(false);
}, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setSessionExpired(false);
  }, []);

  const value = useMemo(
    () => ({ user, loading, sessionExpired, login, logout }),
    [user, loading, sessionExpired, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
