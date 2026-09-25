import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aop.user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('aop.jwt')));

  useEffect(() => {
    if (!localStorage.getItem('aop.jwt')) return;
    api.me().then((result) => setUser(result.data || result)).catch(() => {
      localStorage.removeItem('aop.jwt');
      localStorage.removeItem('aop.user');
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  const signIn = (result) => {
    const nextUser = { id: result.id, name: result.name, email: result.email, role: result.role, demo: Boolean(result.demo) };
    localStorage.setItem('aop.jwt', result.token);
    localStorage.setItem('aop.user', JSON.stringify(nextUser));
    if (result.demo) localStorage.setItem('aop.demo', 'true');
    else localStorage.removeItem('aop.demo');
    setUser(nextUser);
  };

  const signOut = () => {
    localStorage.removeItem('aop.jwt');
    localStorage.removeItem('aop.user');
    localStorage.removeItem('aop.demo');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
