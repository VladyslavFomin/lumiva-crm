import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchSalesChannels, type SalesChannel } from '../../api/salesChannels';
import { WooCommerceConnectSection } from './WooCommerceConnectSection';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { integrationCatalogName } from '../../pages/automations/integrationsCatalog';
import { BlurModal } from './BlurModal';

export type WooCommerceHubSheetProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export const WooCommerceHubSheet: React.FC<WooCommerceHubSheetProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<SalesChannel[]>([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchSalesChannels()
      .then((ch) => {
        if (alive) setChannels(ch.filter((c) => !c.isDeleted));
      })
      .catch(() => {
        if (alive) setChannels([]);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const titleId = 'woo-hub-sheet-title';

  return (
    <BlurModal open={open} onClose={onClose} labelledBy={titleId} size="xl">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/70 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <IntegrationBrandIcon
            catalogId="woocommerce"
            label={integrationCatalogName('woocommerce', t)}
            size={44}
            className="ring-1 ring-black/5"
          />
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold text-slate-900 sm:text-base">
              {t('crm.integrationsHub.wooSheetTitle')}
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-slate-600">
              {t('crm.integrationsHub.wooSheetSubtitle')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white hover:shadow"
        >
          {t('crm.integrationsHub.marketingModalClose')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
        <div className="mx-auto w-full max-w-3xl">
          <WooCommerceConnectSection
            variant="inSheet"
            channels={channels}
            onCreated={() => {
              onCreated?.();
            }}
          />
        </div>
      </div>
    </BlurModal>
  );
};
