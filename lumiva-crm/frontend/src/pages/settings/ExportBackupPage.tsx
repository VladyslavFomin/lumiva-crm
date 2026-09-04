// src/pages/settings/ExportBackupPage.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { API_BASE } from '../../api/client';
import { getAccessToken } from '../../auth/session';
import '../telephony/telephony-design.css';

export const ExportBackupPage: React.FC = () => {
  const { t } = useTranslation();
  const eb = (key: string, opts?: Record<string, unknown>) => t(`crm.settings.exportBackup.${key}`, opts as any) as string;
  const { showAlert } = useAlertModal();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/export/backup`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(eb('generateErrorFormat', { status: res.status }));
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showAlert(e?.message || eb('downloadError'), { variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <h1>{eb('title')}</h1>
            <p className="sub">
              {eb('subtitle')}
            </p>
          </div>
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3>{eb('fullExportTitle')}</h3>
              <div className="sub">
                {eb('fullExportHint')}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? eb('generatingBtn') : eb('downloadBtn')}
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default ExportBackupPage;
