import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const PaymentResultPage: React.FC = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const status = params.get('status');
  const paid = status === 'paid';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#e7e7e7] bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
            paid ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}
        >
          {paid ? '✓' : '✕'}
        </div>
        <h1 className="text-lg font-semibold text-[#222]">
          {paid ? t('crm.pay.result.successTitle') : t('crm.pay.result.failTitle')}
        </h1>
        <p className="mt-2 text-[13px] text-[#666] leading-relaxed">
          {paid ? t('crm.pay.result.successSubtitle') : t('crm.pay.result.failSubtitle')}
        </p>
      </div>
    </div>
  );
};
