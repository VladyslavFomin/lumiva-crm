import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startOutlookCalendarOAuth } from '../../api/integrations';
import { integrationCatalogName } from '../../pages/automations/integrationsCatalog';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { BlurModal } from './BlurModal';

const REDIRECT_PATH = '/integrations-hub?tab=connections';
const CATALOG_ID = 'outlook';

export type OutlookCalendarOAuthHubModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Подключение Outlook / Microsoft 365 Calendar через OAuth платформы (без ручного access token).
 */
export const OutlookCalendarOAuthHubModal: React.FC<OutlookCalendarOAuthHubModalProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleId = 'outlook-cal-oauth-hub-title';

  const handleClose = () => {
    if (busy) return;
    setErr(null);
    onClose();
  };

  const connect = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { url } = await startOutlookCalendarOAuth({
        intent: 'create',
        redirectPath: REDIRECT_PATH,
        name: label.trim() || undefined,
      });
      window.location.assign(url);
    } catch (e: unknown) {
      setBusy(false);
      setErr(
        (e as Error)?.message ||
          t('crm.integrationsHub.outlookCalendar.oauthStartError'),
      );
    }
  };

  if (!open) return null;

  return (
    <BlurModal open={open} onClose={handleClose} labelledBy={titleId} size="md">
      <div className="max-h-[min(82vh,720px)] overflow-y-auto overscroll-contain p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <IntegrationBrandIcon
            catalogId={CATALOG_ID}
            label={integrationCatalogName(CATALOG_ID, t)}
            size={44}
          />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-900">
              {t('crm.integrationsHub.outlookCalendar.oauthTitle')}
            </h2>
            <p className="mt-1 text-[11px] text-slate-600 leading-snug">
              {t('crm.integrationsHub.outlookCalendar.oauthSubtitle')}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <p className="text-[10px] text-slate-500 leading-snug">
            {t('crm.integrationsHub.outlookCalendar.oauthUsesPrimaryCalendar')}
          </p>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">
              {t('crm.integrationsHub.outlookCalendar.oauthNameLabel')}
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              placeholder={integrationCatalogName(CATALOG_ID, t)}
              disabled={busy}
            />
          </div>
          {err ? <p className="text-[11px] text-rose-600">{err}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={handleClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('crm.automations.panel.integrations.connectCancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void connect()}
            className="rounded-full bg-[#222222] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? t('crm.integrationsHub.outlookCalendar.oauthBusy')
              : t('crm.integrationsHub.outlookCalendar.oauthConnect')}
          </button>
        </div>
      </div>
    </BlurModal>
  );
};
