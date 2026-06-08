import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, tokenStore, condoStore } from "@/lib/api";
import type { AuthUser, CondoSummary } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** Condomínios acessíveis ao utilizador (vazio/1 = sem selector) */
  condominiums: CondoSummary[];
  /** Condomínio activo resolvido pelo servidor */
  activeCondominiumId: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Troca o condomínio activo: persiste, invalida queries e recarrega o /me */
  setActiveCondominium: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.getAccess()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<AuthUser>("/auth/me");
      // Alinha o store local com o condomínio resolvido pelo servidor — assim
      // os pedidos seguintes enviam um header coerente (e a UI mostra o activo).
      if (data.activeCondominiumId) condoStore.set(data.activeCondominiumId);
      setUser(data);
    } catch {
      tokenStore.clear();
      condoStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    tokenStore.setTokens(data.accessToken, data.refreshToken);
    const me = await api.get<AuthUser>("/auth/me").then((r) => r.data);
    if (me.activeCondominiumId) condoStore.set(me.activeCondominiumId);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", { refreshToken: tokenStore.getRefresh() });
    } catch {
      /* ignore */
    }
    tokenStore.clear();
    condoStore.clear();
    setUser(null);
  }, []);

  const setActiveCondominium = useCallback(
    async (id: string) => {
      if (id === condoStore.get()) return;
      condoStore.set(id);
      // Todos os dados em cache pertencem ao condomínio anterior — descarta-os
      // e recarrega o /me (que agora resolve o novo condomínio activo).
      await qc.invalidateQueries();
      await refresh();
    },
    [qc, refresh]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        condominiums: user?.condominiums ?? [],
        activeCondominiumId: user?.activeCondominiumId ?? null,
        login,
        logout,
        refresh,
        setActiveCondominium,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
