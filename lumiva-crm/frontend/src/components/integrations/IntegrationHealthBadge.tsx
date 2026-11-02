import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IntegrationHealthStatus } from '../../api/marketing';

const TONE: Record<IntegrationHealthStatus, string> = {
  ok: 'text-[#1f8a5e] border-[#c5e3d2] bg-[#eaf4ee]',
  error: 'text-[#b42318] border-[#f4c7c3] bg-[#fdecea]',
  expired: 'text-[#b42318] border-[#f4c7c3] bg-[#fdecea]',
  stale: 'text-[#9a5b00] border-[#f1dcb0] bg-[#fdf5e6]',
  expiring: 'text-[#9a5b00] border-[#f1dcb0] bg-[#fdf5e6]',
  never: 'text-[#888] border-[#e7e7e7] bg-[#fafafa]',
};

/** «5 мин назад» / «2 h ago» / «3 gün önce» по языку интерфейса. */
export function formatAgo(iso: string | null | undefined, lang: string): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const diff = Math.round((ms - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang || 'ru', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export const IntegrationHealthPill: React.FC<{ status: IntegrationHealthStatus }> = ({ status }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] px-2 py-[3px] rounded-full border ${TONE[status]}`}
    >
      <span className="w-[5px] h-[5px] rounded-full bg-current" />
      {t(`crm.integrationHealth.status.${status}`)}
    </span>
  );
};

/** Строка под названием подключения: когда синхронизировалось + текст ошибки. */
export const IntegrationHealthDetails: React.FC<{
  status: IntegrationHealthStatus;
  lastSyncAt?: string | null;
  lastError?: string | null;
  rows?: number | null;
  since?: string | null;
}> = ({ status, lastSyncAt, lastError, rows, since }) => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2);
  const ago = formatAgo(lastSyncAt, lang);
  const sinceAgo = formatAgo(since, lang);
  return (
    <div className="mt-1 text-[11px] leading-snug">
      <span className="text-[#888]">
        {ago
          ? t(status === 'error' ? 'crm.integrationHealth.lastAttempt' : 'crm.integrationHealth.lastSync', { ago })
          : t('crm.integrationHealth.neverSynced')}
        {status === 'ok' && typeof rows === 'number' ? ` · ${t('crm.integrationHealth.rows', { count: rows })}` : ''}
        {status === 'error' && sinceAgo && sinceAgo !== ago ? ` · ${t('crm.integrationHealth.failingSince', { ago: sinceAgo })}` : ''}
      </span>
      {status === 'stale' && <div className="text-[#9a5b00] mt-0.5">{t('crm.integrationHealth.staleHint')}</div>}
      {status === 'expired' && <div className="text-[#b42318] mt-0.5">{t('crm.integrationHealth.expiredHint')}</div>}
      {status === 'error' && lastError && (
        <div className="text-[#b42318] mt-0.5 line-clamp-2 break-words" title={lastError}>
          {lastError}
        </div>
      )}
    </div>
  );
};
