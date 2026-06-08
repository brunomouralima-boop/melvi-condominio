import axios, { AxiosError } from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : "/api",
  withCredentials: true,
});

const ACCESS_KEY = "melvi_access";
const REFRESH_KEY = "melvi_refresh";
const CONDO_KEY = "melvi_condo";

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (access: string, refresh?: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// Condomínio activo (multi-tenant). Persiste a escolha do utilizador e
// é enviado em cada pedido via header `x-condominium-id`; o servidor valida-o
// contra os condomínios acessíveis (resolveCondominium).
export const condoStore = {
  get: () => localStorage.getItem(CONDO_KEY),
  set: (id: string) => localStorage.setItem(CONDO_KEY, id),
  clear: () => localStorage.removeItem(CONDO_KEY),
};

api.interceptors.request.use((cfg) => {
  const token = tokenStore.getAccess();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  const condo = condoStore.get();
  if (condo) cfg.headers["x-condominium-id"] = condo;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const res = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken: refresh });
    const newAccess = res.data.accessToken as string;
    tokenStore.setTokens(newAccess);
    return newAccess;
  } catch {
    tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as any;
    if (err.response?.status === 401 && !original?._retried) {
      original._retried = true;
      if (!refreshing) refreshing = tryRefresh().finally(() => (refreshing = null));
      const newTok = await refreshing;
      if (newTok) {
        original.headers.Authorization = `Bearer ${newTok}`;
        return api(original);
      }
    }
    return Promise.reject(err);
  }
);

export type ApiError = AxiosError<{ error: string; issues?: unknown[] }>;
