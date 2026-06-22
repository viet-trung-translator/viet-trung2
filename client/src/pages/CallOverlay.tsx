import { useAuth } from '../auth';
import { useRealtime } from '../realtimeContext';

/** Full-screen overlay shown during outgoing/incoming/active calls. */
export default function CallOverlay() {
  const { t } = useAuth();
  const { call, accept, reject, hangup, transcripts, notice, clearNotice } = useRealtime();

  if (call.kind === 'idle') {
    return notice ? (
      <div className="toast" onClick={clearNotice}>
        {noticeText(notice, t)}
      </div>
    ) : null;
  }

  const peer = call.kind === 'incoming' ? call.from : call.peer;
  const peerName = peer?.username ?? '';
  const initial = peerName.slice(0, 1).toUpperCase();

  return (
    <div className="overlay">
      <div className="peer">
        <div className="big-avatar">{initial || '👤'}</div>
        <div className="name">{peerName}</div>
        <div className="state">
          {call.kind === 'outgoing' && t('ringing')}
          {call.kind === 'incoming' && t('incomingCall')}
          {call.kind === 'active' && t('inCall')}
        </div>
      </div>

      {call.kind === 'active' && (
        <div className="transcripts">
          <div className="bubble">
            <div className="label">{t('youSaid')}</div>
            <div className="text">{transcripts.source}</div>
          </div>
          <div className="bubble translation">
            <div className="label">{t('translation')}</div>
            <div className="text">{transcripts.translation}</div>
          </div>
        </div>
      )}

      <div style={{ flex: call.kind === 'active' ? 0 : 1 }} />

      <div className="call-actions">
        {call.kind === 'incoming' ? (
          <>
            <button className="btn red" onClick={reject}>
              {t('reject')}
            </button>
            <button className="btn green" onClick={accept}>
              {t('accept')}
            </button>
          </>
        ) : (
          <button className="btn red" onClick={hangup}>
            {t('hangup')}
          </button>
        )}
      </div>
    </div>
  );
}

function noticeText(code: string, t: ReturnType<typeof useAuth>['t']): string {
  const map: Record<string, string> = {
    offline: t('callFailedOffline'),
    busy: t('callFailedBusy'),
    rejected: t('callEnded'),
  };
  return map[code] ?? code;
}
