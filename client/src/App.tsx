import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { RealtimeProvider } from './realtimeContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Solo from './pages/Solo';
import CallOverlay from './pages/CallOverlay';

export default function App() {
  const { user, loading, t } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <p className="empty">{t('connecting')}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell">
        <Login />
      </div>
    );
  }

  return (
    <RealtimeProvider>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/solo" element={<Solo />} />
          <Route
            path="/admin"
            element={user.role === 'owner' ? <Admin /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <CallOverlay />
    </RealtimeProvider>
  );
}
