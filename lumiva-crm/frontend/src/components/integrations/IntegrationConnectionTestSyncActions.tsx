import React from 'react';
import type { TFunction } from 'i18next';

export type IntegrationConnectionTestSyncActionsProps = {
  connectionId: string;
  testingId: string | null;
  syncingId: string | null;
  onTest: (id: string) => void | Promise<void>;
  onSync: (id: string) => void | Promise<void>;
  t: TFunction;
  /** Для коннекторов без импорта продаж (кабинет, чат) — только проверка. */
  showSync?: boolean;
};

/**
 * Кнопки «Проверить» и «Синхронизировать» для карточки подключения (хаб интеграций).
 */
export const IntegrationConnectionTestSyncActions: React.FC<
  IntegrationConnectionTestSyncActionsProps
> = ({
  connectionId,
  testingId,
  syncingId,
  onTest,
  onSync,
  t,
  showSync = true,
}) => {
  const testing = testingId === connectionId;
  const syncing = syncingId === connectionId;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={testing}
        onClick={() => void onTest(connectionId)}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
      >
        {testing ? t('crm.integrationsHub.testing') : t('crm.integrationsHub.test')}
      </button>
      {showSync ? (
        <button
          type="button"
          disabled={syncing}
          onClick={() => void onSync(connectionId)}
          className="rounded-full bg-[#222222] px-3 py-1.5 text-[10px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {syncing ? t('crm.integrationsHub.syncing') : t('crm.integrationsHub.sync')}
        </button>
      ) : null}
    </div>
  );
};
