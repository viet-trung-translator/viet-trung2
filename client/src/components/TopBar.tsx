import { ReactNode } from 'react';
import { useAuth } from '../auth';

export default function TopBar({ right }: { right?: ReactNode }) {
  const { t } = useAuth();
  return (
    <div className="topbar">
      <div className="brand">
        <span className="logo">译</span>
        <span>{t('appName')}</span>
      </div>
      <div className="topbar-actions">{right}</div>
    </div>
  );
}
