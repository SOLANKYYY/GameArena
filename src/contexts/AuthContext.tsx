'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';

interface User {
  id: number;
  username: string;
  teamName: string;
  balance: number;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, teamName: string) => Promise<void>;
  logout: () => void;
  updateBalance: (newBalance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('game-arena-token');
    if (savedToken) {
      setToken(savedToken);
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
        signal: AbortSignal.timeout(10000),
      })
        .then(res => {
          if (!res.ok) throw new Error('Invalid token');
          return res.json();
        })
        .then(data => {
          setUser(data.user);
          setToken(savedToken);
        })
        .catch(() => {
          localStorage.removeItem('game-arena-token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('game-arena-token', data.token);
  }, []);

  const register = useCallback(async (username: string, password: string, teamName: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, teamName }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('game-arena-token', data.token);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('game-arena-token');
  }, []);

  const updateBalance = useCallback((newBalance: number) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : null);
  }, []);

  const value = useMemo(() => ({
    user, token, loading, login, register, logout, updateBalance,
  }), [user, token, loading, login, register, logout, updateBalance]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
