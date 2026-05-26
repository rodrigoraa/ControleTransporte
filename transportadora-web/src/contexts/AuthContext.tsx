import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

type User = { id: string; nome: string; email: string; perfil: 'ADMIN' | 'USUARIO' };
type AuthContextType = {
  user: User | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('user');
    try {
      return stored ? JSON.parse(stored) : null;
    } catch {
      sessionStorage.removeItem('user');
      return null;
    }
  });

  useEffect(() => {
    if (!sessionStorage.getItem('token')) setUser(null);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    async login(email, senha) {
      const { data } = await api.post('/auth/login', { email, senha });
      sessionStorage.setItem('token', data.accessToken);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    },
    logout() {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      setUser(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};

