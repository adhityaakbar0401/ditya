import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api';
import type { AuthStatusResponse, UserProfile, UserRole } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  authStatus: AuthStatusResponse | null;
  authStatusError: string | null;
  login: (identifier: string, password: string) => Promise<UserProfile>;
  registerFirstAdmin: (payload: {
    full_name: string;
    email: string;
    password: string;
    nip?: string;
    jabatan?: string;
  }) => Promise<UserProfile>;
  activateStudentAccount: (payload: {
    nis: string;
    email: string;
    password: string;
  }) => Promise<UserProfile>;
  claimAdmin: () => Promise<UserProfile>;
  logout: () => void;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'guru':
      return 'Guru';
    case 'tenaga_kependidikan':
      return 'Tenaga Kependidikan';
    case 'siswa':
      return 'Siswa';
    default:
      return role;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authStatusError, setAuthStatusError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const status = await apiRequest<AuthStatusResponse>('/api/auth/status');
      setAuthStatus(status);
      setAuthStatusError(null);
    } catch (err) {
      setAuthStatusError(err instanceof Error ? err.message : 'Gagal memeriksa status server.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const statusPromise = apiRequest<AuthStatusResponse>('/api/auth/status')
          .then((res) => ({ ok: true as const, data: res }))
          .catch((err: unknown) => ({
            ok: false as const,
            error: err instanceof Error ? err.message : 'Gagal menghubungi server API.',
          }));
        const token = getStoredToken();
        const mePromise = token
          ? apiRequest<{ user: UserProfile }>('/api/auth/me').catch(() => {
              setStoredToken(null);
              return null;
            })
          : Promise.resolve(null);

        const [statusRes, me] = await Promise.all([statusPromise, mePromise]);
        if (!active) return;
        if (statusRes.ok) {
          setAuthStatus(statusRes.data);
          setAuthStatusError(null);
        } else {
          setAuthStatusError(statusRes.error);
        }
        if (me?.user) setUser(me.user);
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setStoredToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const registerFirstAdmin = useCallback(
    async (payload: {
      full_name: string;
      email: string;
      password: string;
      nip?: string;
      jabatan?: string;
    }) => {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register-first', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStoredToken(res.token);
      setUser(res.user);
      await refreshAuthStatus();
      return res.user;
    },
    [refreshAuthStatus]
  );

  const activateStudentAccount = useCallback(
    async (payload: { nis: string; email: string; password: string }) => {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/activate-student', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStoredToken(res.token);
      setUser(res.user);
      await refreshAuthStatus();
      return res.user;
    },
    [refreshAuthStatus]
  );

  const claimAdmin = useCallback(async () => {
    const res = await apiRequest<{ user: UserProfile }>('/api/auth/claim-admin', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    setUser(res.user);
    await refreshAuthStatus();
    return res.user;
  }, [refreshAuthStatus]);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authStatus,
        authStatusError,
        login,
        registerFirstAdmin,
        activateStudentAccount,
        claimAdmin,
        logout,
        refreshAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
