import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LottieIcon } from '../../components/LottieIcon';

export const PaymentResultPage: React.FC = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const status = params.get('status');
  const paid = status === 'paid';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#e7e7e7] bg-white p-8 text-center shadow-sm">
        {paid ? (
          <div className="mx-auto mb-2 flex justify-center">
            <LottieIcon name="invoice-check" size={90} loop={false} />
          </div>
        ) : (
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-2xl text-rose-600">
            ✕
          </div>
        )}
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
