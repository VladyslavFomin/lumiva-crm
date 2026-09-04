// src/pages/portal/PortalVerifyPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { verifyPortalMagicLink } from '../../api/portal';
import { setPortalSession } from '../../portal/portalSession';

export const PortalVerifyPage: React.FC = () => {
  const { t } = useTranslation();
  const { clientKey = '' } = useParams<{ clientKey: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError(t('crm.portal.verify.invalidLink'));
      return;
    }
    verifyPortalMagicLink(token)
      .then((res) => {
        setPortalSession(res.sessionToken, clientKey);
        navigate(`/portal/${clientKey}/dashboard`, { replace: true });
      })
      .catch((e: any) => {
        setError(e?.message || t('crm.portal.verify.expiredLink'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-[0_24px_70px_rgba(17,24,39,0.12)] p-6 md:p-8 text-center">
        {error ? (
          <>
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-3 mb-4">
              {error}
            </div>
            <a href={`/portal/${clientKey}/login`} className="text-sm text-lumiva-accent underline">
              {t('crm.portal.verify.requestNewLink')}
            </a>
          </>
        ) : (
          <div className="text-sm text-slate-500">{t('crm.portal.verify.checking')}</div>
        )}
      </div>
    </div>
  );
};

export default PortalVerifyPage;
