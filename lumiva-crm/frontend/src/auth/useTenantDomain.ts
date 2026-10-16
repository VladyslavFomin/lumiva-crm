import React from 'react';
import { resolveTenantByDomain } from '../api/client';

const MAIN_HOSTS = ['crm.lumiva.agency', 'localhost', '127.0.0.1'];

/**
 * Страницы входа/сброса пароля на кастомном домене тенанта: определяет clientKey и название
 * компании по hostname, чтобы не спрашивать ключ и не показывать бренд Lumiva.
 * `resolving` = true, пока идёт запрос, — поле ключа в это время скрыто, иначе оно мелькает.
 */
export function useTenantDomain() {
  const isCustomDomain = !MAIN_HOSTS.includes(window.location.hostname);
  const [resolving, setResolving] = React.useState(isCustomDomain);
  const [tenant, setTenant] = React.useState<{ clientKey: string; companyName: string } | null>(
    null,
  );

  React.useEffect(() => {
    if (!isCustomDomain) return;
    let cancelled = false;
    resolveTenantByDomain(window.location.hostname).then((found) => {
      if (cancelled) return;
      if (found) {
        setTenant(found);
        if (found.companyName) {
          const companyName = found.companyName.trim();
          document.title = /\bCRM\b/i.test(companyName)
            ? companyName
            : `${companyName} CRM`;
        }
      }
      setResolving(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isCustomDomain]);

  return { isCustomDomain, resolving, tenant };
}
