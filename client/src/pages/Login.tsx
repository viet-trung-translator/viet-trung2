import { useState, FormEvent } from 'react';
import { useAuth } from '../auth';
import { api, ApiError } from '../api';
import { Language } from '../types';

export default function Login() {
  const { t, uiLang, setUiLang, onAuthenticated } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<Language>(uiLang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setPending(false);
    try {
      if (mode === 'register') {
        const res = await api.register(username, password, language);
        if (res.token) {
          onAuthenticated(res.token, res.user);
        } else {
          setPending(true);
          setMode('login');
        }
      } else {
        const res = await api.login(username, password);
        onAuthenticated(res.token, res.user);
      }
    } catch (err) {
      const e = err as ApiError;
      setError(translateError(e.code) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-screen">
      <div className="auth-box">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div className="lang-toggle">
            <button className={uiLang === 'vi' ? 'active' : ''} onClick={() => setUiLang('vi')}>
              VI
            </button>
            <button className={uiLang === 'zh' ? 'active' : ''} onClick={() => setUiLang('zh')}>
              中文
            </button>
          </div>
        </div>

        <h1 className="auth-title">
          <span className="logo" style={{ display: 'none' }} />
          {t('appName')}
        </h1>
        <p className="auth-sub">{t('tagline')}</p>

        {pending && <p className="error-text" style={{ color: '#bbf7d0' }}>{t('pendingApproval')}</p>}
        {error && <p className="error-text">{error}</p>}

        <form onSubmit={submit} className="card">
          <div className="field">
            <label>{t('username')}</label>
            <input
              className="input"
              value={username}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>{t('password')}</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {mode === 'register' && (
            <div className="field">
              <label>{t('yourLanguage')}</label>
              <select
                className="input"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                <option value="vi">{t('langVi')}</option>
                <option value="zh">{t('langZh')}</option>
              </select>
            </div>
          )}
          <button className="btn block" disabled={busy} type="submit">
            {busy ? t('loggingIn') : mode === 'login' ? t('login') : t('register')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button
            className="link-btn"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? t('noAccount') : t('haveAccount')}
          </button>
        </div>
      </div>
    </div>
  );

  function translateError(code: string): string {
    const map: Record<string, string> = {
      invalid_credentials: t('login') + ' ✗',
      pending_approval: t('pendingApproval'),
      username_taken: '⚠ ' + t('username'),
    };
    return map[code] ?? '';
  }
}
