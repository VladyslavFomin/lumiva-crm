import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fetchIntegrationHealth, type IntegrationHealthItem } from '../../api/marketing';
import { IntegrationHealthDetails, IntegrationHealthPill } from './IntegrationHealthBadge';

const PROBLEM = new Set(['error', 'stale', 'expired', 'expiring']);
const ORDER: Record<string, number> = { error: 0, expired: 1, stale: 2, expiring: 3 };

/**
 * Сводка над вкладками «Интеграций»: какие подключения сломаны или устарели и куда идти чинить.
 * Ничего не показывает, если всё в порядке. `reloadKey` — перечитать после «Обновить» / синка.
 */
export const IntegrationHealthBanner: React.FC<{
  reloadKey?: number;
  onOpenTab?: (tab: 'marketing' | 'connections') => void;
}> = ({ reloadKey, onOpenTab }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<IntegrationHealthItem[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchIntegrationHealth()
      .then((r) => {
        if (alive) setItems(r.items.filter((i) => PROBLEM.has(i.status)).sort((a, b) => ORDER[a.status] - ORDER[b.status]));
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  if (!items.length) return null;
  const hasErrors = items.some((i) => i.status === 'error' || i.status === 'expired');

  const go = (i: IntegrationHealthItem) => {
    if (i.source === 'telegram') return navigate('/telegram');
    if (i.source === 'instagram') return navigate('/instagram');
    onOpenTab?.(i.source === 'marketing' ? 'marketing' : 'connections');
    // карточка появится после переключения вкладки — подождём кадр-другой и подсветим её
    window.setTimeout(() => {
      const el = document.getElementById(`integration-${i.source}-${i.id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.animate?.([{ boxShadow: '0 0 0 3px rgba(217,45,32,0.35)' }, { boxShadow: '0 0 0 0 rgba(217,45,32,0)' }], { duration: 1600, easing: 'ease-out' });
    }, 350);
  };

  return (
    <div
      className={`mb-5 rounded-[14px] border ${hasErrors ? 'border-[#f4c7c3] bg-[#fffafa]' : 'border-[#f1dcb0] bg-[#fffdf7]'}`}
      role="status"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${hasErrors ? 'bg-[#d92d20]' : 'bg-[#dc8a00]'}`} />
        <span className="text-[13px] font-semibold text-[#222] flex-1">
          {t('crm.integrationHealth.banner.title', { count: items.length })}
        </span>
        <span className="text-[11px] text-[#888]">{open ? t('crm.integrationHealth.banner.hide') : t('crm.integrationHealth.banner.show')}</span>
      </button>
      {open && (
        <ul className="border-t border-black/[0.06] divide-y divide-black/[0.05]">
          {items.map((i) => (
            <li key={`${i.source}:${i.id}`} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-[#222] truncate">{i.name}</span>
                  <IntegrationHealthPill status={i.status} />
                </div>
                <IntegrationHealthDetails status={i.status} lastSyncAt={i.lastSyncAt} lastError={i.lastError} since={i.since} />
              </div>
              <button
                type="button"
                onClick={() => go(i)}
                className="self-start sm:self-center shrink-0 rounded-lg border border-[#e7e7e7] bg-white px-3 py-1.5 text-[11.5px] font-medium text-[#222] hover:border-[#222] transition-colors"
              >
                {t('crm.integrationHealth.banner.fix')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
