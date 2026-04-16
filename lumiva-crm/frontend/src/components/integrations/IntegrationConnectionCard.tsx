import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TFunction } from 'i18next';
import type { IntegrationConnectionDto } from '../../api/integrations';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { integrationCatalogName } from '../../pages/automations/integrationsCatalog';

export type IntegrationConnectionCardProps = {
  connection: IntegrationConnectionDto;
  t: TFunction;
  /** Внешний вид карточки */
  surfaceTone?: 'default' | 'whiteDashed';
  /** Дополнительные классы корневой карточки */
  cardClassName?: string;
  /** Под заголовком: «через коннектор …» / только имя каталога / скрыть */
  connectorSubtitle: 'viaConnector' | 'plainCatalog' | false;
  /** Строка под заголовком (например kind · catalogId) — если задана, имеет приоритет над connectorSubtitle */
  metaLine?: React.ReactNode;
  lastSyncVariant: 'panel' | 'hub';
  /** Добавить ` · {lastSyncStatus}` для варианта hub */
  showLastSyncStatus?: boolean;
  /** Ссылка в продажи для Woo / ручного импорта */
  showSalesIntegrationsLink?: boolean;
  /** WhatsApp / amo / CF7 блоки */
  showInboundWebhookBlocks?: boolean;
  /** WordPress CF7: подгрузить полный URL с секретом (GET /integrations/:id) */
  fetchCf7PasteUrl?: (connectionId: string) => Promise<string | null>;
  footer?: React.ReactNode;
};

export const IntegrationConnectionCard: React.FC<
  IntegrationConnectionCardProps
> = ({
  connection: c,
  t,
  surfaceTone = 'default',
  cardClassName = '',
  connectorSubtitle,
  metaLine,
  lastSyncVariant,
  showLastSyncStatus = false,
  showSalesIntegrationsLink = false,
  showInboundWebhookBlocks = true,
  fetchCf7PasteUrl,
  footer,
}) => {
  const [cf7CopyHint, setCf7CopyHint] = useState<string | null>(null);

  const copyText = useCallback(
    async (text: string) => {
      if (!text) {
        setCf7CopyHint(t('crm.automations.panel.integrations.siteFormCf7CopyEmpty'));
        window.setTimeout(() => setCf7CopyHint(null), 2500);
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        setCf7CopyHint(t('crm.automations.panel.integrations.siteFormCf7Copied'));
        window.setTimeout(() => setCf7CopyHint(null), 2500);
      } catch {
        setCf7CopyHint(t('crm.automations.panel.integrations.siteFormCf7CopyFailed'));
        window.setTimeout(() => setCf7CopyHint(null), 3500);
      }
    },
    [t],
  );
  const surfaceClass =
    surfaceTone === 'whiteDashed'
      ? 'rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm'
      : 'rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm';

  const lastSyncLabel =
    lastSyncVariant === 'hub'
      ? t('crm.integrationsHub.lastSync')
      : t('crm.automations.panel.integrations.lastSync');
  const neverLabel =
    lastSyncVariant === 'hub'
      ? t('crm.integrationsHub.never')
      : t('crm.automations.panel.integrations.never');

  const subtitleNode = (() => {
    if (metaLine) return metaLine;
    if (connectorSubtitle === 'plainCatalog' && c.kind === 'woocommerce') {
      return (
        <div className="text-[10px] text-slate-500 mt-0.5">
          {integrationCatalogName('woocommerce', t)}
        </div>
      );
    }
    if (!connectorSubtitle || c.kind !== 'third_party_link' || !c.linkCatalogId) {
      return null;
    }
    if (connectorSubtitle === 'viaConnector') {
      return (
        <div className="text-[10px] text-slate-500 mt-0.5">
          {t('crm.automations.panel.integrations.viaConnector', {
            name: integrationCatalogName(c.linkCatalogId, t),
          })}
        </div>
      );
    }
    return (
      <div className="text-[10px] text-slate-500 mt-0.5">
        {integrationCatalogName(c.linkCatalogId, t)}
      </div>
    );
  })();

  return (
    <div className={`${surfaceClass} ${cardClassName}`.trim()}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2">
          {(c.kind === 'third_party_link' && c.linkCatalogId) || c.kind === 'woocommerce' ? (
            <IntegrationBrandIcon
              catalogId={
                c.kind === 'woocommerce' ? 'woocommerce' : (c.linkCatalogId as string)
              }
              label={c.name}
              size={40}
            />
          ) : null}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div>
            {subtitleNode}
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            c.isEnabled
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          {c.isEnabled
            ? t('crm.automations.panel.integrations.statusLive')
            : t('crm.automations.panel.integrations.statusOff')}
        </span>
      </div>

      {c.lastError ? (
        <p className="mt-2 text-[10px] text-rose-700 line-clamp-3">{c.lastError}</p>
      ) : null}

      {showInboundWebhookBlocks && (
        <>
          {c.linkCatalogId === 'whatsapp' && c.whatsappInboundWebhookUrl && (
            <details className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] text-slate-800">
              <summary className="cursor-pointer font-semibold text-slate-900 select-none">
                {t('crm.automations.panel.integrations.webhookUrlDetails')}
              </summary>
              <div className="mt-2 font-semibold text-slate-900">
                {t('crm.automations.panel.integrations.whatsappInboundUrlTitle')}
              </div>
              <code className="mt-1 block break-all text-[9px] text-slate-700">
                {c.whatsappInboundWebhookUrl}
              </code>
              <p className="mt-1 text-[9px] text-slate-600 leading-snug">
                {t('crm.automations.panel.integrations.whatsappInboundUrlHint')}
              </p>
            </details>
          )}
          {c.linkCatalogId === 'whatsapp' && !c.whatsappInboundWebhookUrl && (
            <p className="mt-2 text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
              {t('crm.automations.panel.integrations.whatsappInboundUrlMissingEnv')}
            </p>
          )}
          {c.linkCatalogId === 'amocrm' && c.amocrmInboundWebhookUrl && (
            <details className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] text-slate-800">
              <summary className="cursor-pointer font-semibold text-slate-900 select-none">
                {t('crm.automations.panel.integrations.webhookUrlDetails')}
              </summary>
              <div className="mt-2 font-semibold text-slate-900">
                {t('crm.automations.panel.integrations.amocrmInboundUrlTitle')}
              </div>
              <code className="mt-1 block break-all text-[9px] text-slate-700">
                {c.amocrmInboundWebhookUrl}
              </code>
              <p className="mt-1 text-[9px] text-slate-600 leading-snug">
                {t('crm.automations.panel.integrations.amocrmInboundUrlHint')}
              </p>
            </details>
          )}
          {c.linkCatalogId === 'amocrm' && !c.amocrmInboundWebhookUrl && (
            <p className="mt-2 text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
              {t('crm.automations.panel.integrations.amocrmInboundUrlMissingEnv')}
            </p>
          )}
          {c.linkCatalogId === 'wordpress_cf7' && c.siteFormInboundWebhookUrl && (
            <details className="mt-2 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[10px] text-slate-800 sm:px-3 sm:py-2.5">
              <summary className="cursor-pointer select-none font-semibold text-slate-900 list-none [&::-webkit-details-marker]:hidden">
                <span className="underline decoration-slate-300 underline-offset-2">
                  {t('crm.automations.panel.integrations.siteFormCf7WhereToPasteTitle')}
                </span>
              </summary>
              <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                <ol className="list-decimal space-y-1.5 pl-4 text-[10px] text-slate-700 leading-snug">
                  <li>{t('crm.automations.panel.integrations.siteFormCf7Step1')}</li>
                  <li>{t('crm.automations.panel.integrations.siteFormCf7Step2')}</li>
                  <li>{t('crm.automations.panel.integrations.siteFormCf7Step3')}</li>
                </ol>
                <div>
                  <div className="text-[10px] font-semibold text-slate-900">
                    {t('crm.automations.panel.integrations.siteFormInboundUrlTitle')}
                  </div>
                  <code className="mt-1 block max-h-24 overflow-auto break-all rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[9px] text-slate-800">
                    {c.siteFormInboundWebhookUrl}
                  </code>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText(c.siteFormInboundWebhookUrl || '')}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {t('crm.automations.panel.integrations.siteFormCf7CopyBase')}
                  </button>
                  {fetchCf7PasteUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        void (async () => {
                          const full = await fetchCf7PasteUrl(c.id);
                          await copyText(full || '');
                        })()
                      }
                      className="rounded-full bg-[#222222] px-3 py-1.5 text-[10px] font-semibold text-white hover:opacity-90"
                    >
                      {t('crm.automations.panel.integrations.siteFormCf7CopyFull')}
                    </button>
                  )}
                </div>
                {cf7CopyHint && (
                  <p className="text-[10px] font-medium text-emerald-800">{cf7CopyHint}</p>
                )}
                <p className="text-[9px] text-slate-600 leading-snug">
                  {t('crm.automations.panel.integrations.siteFormInboundUrlHint')}
                </p>
              </div>
            </details>
          )}
          {c.linkCatalogId === 'wordpress_cf7' && c.lumivaWizardCf7IngestUrl && (
            <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-2 text-[10px] text-slate-800 sm:px-3 sm:py-2.5">
              <summary className="cursor-pointer select-none font-semibold text-slate-900 list-none [&::-webkit-details-marker]:hidden">
                <span className="underline decoration-slate-300 underline-offset-2">
                  {t('crm.automations.panel.integrations.siteFormCf7WizardTitle')}
                </span>
              </summary>
              <div className="mt-2 space-y-2 border-t border-slate-200/80 pt-2">
                <p className="text-[10px] text-slate-700 leading-snug">
                  {t('crm.automations.panel.integrations.siteFormCf7WizardBody')}
                </p>
                <code className="mt-1 block max-h-24 overflow-auto break-all rounded border border-slate-200 bg-white px-2 py-1.5 text-[9px] text-slate-800">
                  {c.lumivaWizardCf7IngestUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void copyText(c.lumivaWizardCf7IngestUrl || '')}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {t('crm.automations.panel.integrations.siteFormCf7WizardCopyUrl')}
                </button>
              </div>
            </details>
          )}
          {c.linkCatalogId === 'wordpress_cf7' &&
            !c.siteFormInboundWebhookUrl &&
            !c.lumivaWizardCf7IngestUrl && (
            <p className="mt-2 text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
              {t('crm.automations.panel.integrations.siteFormInboundUrlMissingEnv')}
            </p>
          )}
        </>
      )}

      <p className="mt-2 text-[10px] text-slate-500">
        {lastSyncLabel}:{' '}
        {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : neverLabel}
        {showLastSyncStatus && c.lastSyncStatus ? ` · ${c.lastSyncStatus}` : ''}
      </p>

      {showSalesIntegrationsLink &&
        (c.kind === 'woocommerce' || c.kind === 'manual-import') && (
          <Link
            to="/app/sales/integrations"
            className="mt-3 inline-block text-[11px] font-semibold text-[#222222] hover:underline"
          >
            {t('crm.automations.panel.integrations.openSales')}
          </Link>
        )}

      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
};
