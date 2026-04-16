import React from 'react';
import { useTranslation } from 'react-i18next';
import { integrationCatalogName } from '../../pages/automations/integrationsCatalog';
import {
  MarketingIntegrationsPanel,
  type MarketingIntegrationProviderKey,
} from '../../pages/marketing/MarketingIntegrationsPanel';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { BlurModal } from './BlurModal';

export type MarketingIntegrationSetupModalProps = {
  open: boolean;
  catalogId: string;
  provider: MarketingIntegrationProviderKey;
  onClose: () => void;
  onDataChanged?: () => void;
};

export const MarketingIntegrationSetupModal: React.FC<MarketingIntegrationSetupModalProps> = ({
  open,
  catalogId,
  provider,
  onClose,
  onDataChanged,
}) => {
  const { t } = useTranslation();

  if (!open || typeof document === 'undefined') return null;

  const title = t('crm.integrationsHub.marketingModalTitle', {
    name: integrationCatalogName(catalogId, t),
  });
  const titleId = 'marketing-setup-modal-title';

  return (
    <BlurModal open={open} onClose={onClose} labelledBy={titleId} size="full90">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/70 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <IntegrationBrandIcon
            catalogId={catalogId}
            label={integrationCatalogName(catalogId, t)}
            size={44}
            className="ring-1 ring-black/5"
          />
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold text-slate-900 sm:text-base">
              {title}
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-slate-600">
              {t('crm.integrationsHub.marketingModalSubtitle')}
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 sm:py-5">
        <div className="w-full max-w-none">
          <MarketingIntegrationsPanel
            key={`${catalogId}-${provider}`}
            variant="modal"
            initialProvider={provider}
            onMarketingDataChanged={onDataChanged}
          />
        </div>
      </div>
    </BlurModal>
  );
};
