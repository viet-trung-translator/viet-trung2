import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useRealtime } from '../realtimeContext';
import { api } from '../api';
import { ContactEntry, PeerInfo } from '../types';
import TopBar from '../components/TopBar';

export default function Home() {
  const { t, user, logout } = useAuth();
  const { status, online, invite } = useRealtime();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PeerInfo[]>([]);

  useEffect(() => {
    api.frequentContacts().then((r) => setContacts(r.contacts)).catch(() => {});
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const id = setTimeout(() => {
      api.searchUsers(q).then((r) => setResults(r.results)).catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  const onlineIds = new Set(online.map((p) => p.id));
  const langLabel = (l: string) => (l === 'zh' ? t('langZh') : t('langVi'));

  const PersonRow = ({ p, isOnline }: { p: PeerInfo; isOnline: boolean }) => (
    <div className="row">
      <div className="who">
        <div className="avatar">{p.username.slice(0, 1).toUpperCase()}</div>
        <div className="meta">
          <div className="name">{p.username}</div>
          <div className="sub">
            {isOnline && <span className="dot" style={{ marginRight: 6 }} />}
            {langLabel(p.language)}
          </div>
        </div>
      </div>
      <button className="btn sm" disabled={!isOnline} onClick={() => invite(p.id)}>
        📞 {t('call')}
      </button>
    </div>
  );

  return (
    <>
      <TopBar
        right={
          <>
            <span className={`status-pill ${status}`}>
              {status === 'open' ? '●' : '○'} {status === 'open' ? '' : t('connecting')}
            </span>
            {user?.role === 'owner' && (
              <button className="btn sm ghost" onClick={() => navigate('/admin')}>
                {t('admin')}
              </button>
            )}
            <button className="btn sm ghost" onClick={logout}>
              {t('logout')}
            </button>
          </>
        }
      />
      <div className="content">
        <div className="field">
          <input
            className="input"
            placeholder={t('searchPeople')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoCapitalize="none"
          />
        </div>

        {search.trim() ? (
          <>
            <div className="section-title">{t('searchPeople')}</div>
            <div className="list">
              {results.length === 0 ? (
                <div className="empty">—</div>
              ) : (
                results.map((p) => <PersonRow key={p.id} p={p} isOnline={onlineIds.has(p.id)} />)
              )}
            </div>
          </>
        ) : (
          <>
            <div className="section-title">{t('online')}</div>
            <div className="list">
              {online.length === 0 ? (
                <div className="empty">{t('noOnline')}</div>
              ) : (
                online.map((p) => <PersonRow key={p.id} p={p} isOnline />)
              )}
            </div>

            <div className="section-title">{t('frequent')}</div>
            <div className="list">
              {contacts.length === 0 ? (
                <div className="empty">{t('noFrequent')}</div>
              ) : (
                contacts.map((c) => (
                  <PersonRow
                    key={c.id}
                    p={{ id: c.id, username: c.username, language: c.language }}
                    isOnline={onlineIds.has(c.id)}
                  />
                ))
              )}
            </div>
          </>
        )}

        <div className="fab-solo">
          <button className="btn block green" onClick={() => navigate('/solo')}>
            🎤 {t('soloMode')}
          </button>
        </div>
      </div>
    </>
  );
}
