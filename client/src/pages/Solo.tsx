import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useRealtime } from '../realtimeContext';
import TopBar from '../components/TopBar';

export default function Solo() {
  const { t } = useAuth();
  const navigate = useNavigate();
  const { soloActive, startSolo, stopSolo, transcripts, notice, clearNotice } = useRealtime();

  // Stop the session when leaving this screen.
  useEffect(() => {
    return () => {
      if (soloActive) stopSolo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async () => {
    if (soloActive) stopSolo();
    else await startSolo();
  };

  return (
    <>
      <TopBar
        right={
          <button
            className="btn sm ghost"
            onClick={() => {
              if (soloActive) stopSolo();
              navigate('/');
            }}
          >
            {t('back')}
          </button>
        }
      />
      <div className="content" style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ textAlign: 'center', margin: '4px 0' }}>{t('soloTitle')}</h2>

        <button className={`solo-mic ${soloActive ? 'on' : ''}`} onClick={toggle}>
          {soloActive ? '⏹' : '🎤'}
        </button>
        <p className="hint">{soloActive ? t('tapToStop') : t('tapToStart')}</p>
        <p className="hint">{t('soloHint')}</p>

        <div className="transcripts">
          <div className="bubble">
            <div className="label">{t('original')}</div>
            <div className="text">{transcripts.source}</div>
          </div>
          <div className="bubble translation">
            <div className="label">{t('translation')}</div>
            <div className="text">{transcripts.translation}</div>
          </div>
        </div>
      </div>

      {notice && (
        <div className="toast" onClick={clearNotice}>
          {notice}
        </div>
      )}
    </>
  );
}
