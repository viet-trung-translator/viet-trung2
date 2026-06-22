import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from './api';
import { Language, PublicUser } from './types';
import { makeT, TFunc } from './i18n';

interface AuthCtx {
  user: PublicUser | null;
  loading: boolean;
  uiLang: Language;
  setUiLang: (l: Language) => void;
  t: TFunc;
  onAuthenticated: (token: string, user: PublicUser) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [uiLang, setUiLang] = useState<Language>(
    (localStorage.getItem('along.uiLang') as Language) || 'vi',
  );

  useEffect(() => {
    let alive = true;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user }) => {
        if (!alive) return;
        setUser(user);
        setUiLang(user.language);
      })
      .catch(() => clearToken())
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const onAuthenticated = (token: string, u: PublicUser) => {
    setToken(token);
    setUser(u);
    setUiLang(u.language);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const changeUiLang = (l: Language) => {
    localStorage.setItem('along.uiLang', l);
    setUiLang(l);
  };

  const lang = user?.language ?? uiLang;
  const t = useMemo(() => makeT(lang), [lang]);

  return (
    <Ctx.Provider
      value={{ user, loading, uiLang: lang, setUiLang: changeUiLang, t, onAuthenticated, logout }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
