import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getApiErrorMessage, setUnauthorizedHandler, TOKEN_STORAGE_KEY } from '../api/client';
import type { CurrentUser } from '../types';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get<CurrentUser>('/auth/me');
      setUser(data);
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
    });
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = useCallback(async (username: string) => {
    try {
      const { data } = await api.post('/auth/login', { username });
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setUser(data.user);
    } catch (err) {
      throw new Error(getApiErrorMessage(err, '로그인에 실패했습니다.'));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
