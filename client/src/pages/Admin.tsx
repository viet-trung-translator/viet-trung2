import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../api';
import { PublicUser } from '../types';
import TopBar from '../components/TopBar';

export default function Admin() {
  const { t, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => api.listUsers().then((r) => setUsers(r.users)).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const act = async (fn: () => Promise<unknown>, id: number) => {
    setBusyId(id);
    try {
      await fn();
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (s: PublicUser['status']) => (
    <span className={`badge ${s}`}>
      {s === 'pending' ? t('statusPending') : s === 'approved' ? t('statusApproved') : t('statusLocked')}
    </span>
  );

  return (
    <>
      <TopBar
        right={
          <button className="btn sm ghost" onClick={() => navigate('/')}>
            {t('back')}
          </button>
        }
      />
      <div className="content">
        <h2 style={{ margin: '4px 0 16px' }}>{t('adminTitle')}</h2>
        <div className="list">
          {users.map((u) => {
            const isSelf = u.id === user?.id;
            return (
              <div className="row admin-row" key={u.id} style={{ flexWrap: 'wrap', gap: 10 }}>
                <div className="who">
                  <div className="avatar">{u.username.slice(0, 1).toUpperCase()}</div>
                  <div className="meta">
                    <div className="name">
                      {u.username}{' '}
                      {u.role === 'owner' && <span className="badge owner">{t('roleOwner')}</span>}
                    </div>
                    <div className="sub">
                      {u.language === 'zh' ? t('langZh') : t('langVi')} · {statusBadge(u.status)}
                    </div>
                  </div>
                </div>
                {!isSelf && (
                  <div className="actions">
                    {u.status === 'pending' && (
                      <button
                        className="btn sm green"
                        disabled={busyId === u.id}
                        onClick={() => act(() => api.setUserStatus(u.id, 'approved'), u.id)}
                      >
                        {t('approve')}
                      </button>
                    )}
                    {u.status === 'approved' && (
                      <button
                        className="btn sm ghost"
                        disabled={busyId === u.id}
                        onClick={() => act(() => api.setUserStatus(u.id, 'locked'), u.id)}
                      >
                        {t('lock')}
                      </button>
                    )}
                    {u.status === 'locked' && (
                      <button
                        className="btn sm green"
                        disabled={busyId === u.id}
                        onClick={() => act(() => api.setUserStatus(u.id, 'approved'), u.id)}
                      >
                        {t('unlock')}
                      </button>
                    )}
                    <button
                      className="btn sm red"
                      disabled={busyId === u.id}
                      onClick={() => {
                        if (confirm(t('confirmDelete'))) act(() => api.deleteUser(u.id), u.id);
                      }}
                    >
                      {t('delete')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
