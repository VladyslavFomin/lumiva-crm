import React, { useEffect, useState } from 'react';
import { fetchExternalLinks, type ExternalLinkInfo, type JiraLinkEntityType } from '../../api/integrations';

type Props = {
  entityType: JiraLinkEntityType;
  entityId: string | undefined | null;
};

const PROVIDER_STYLE: Record<ExternalLinkInfo['provider'], { bg: string; fg: string; label: string }> = {
  bitrix: { bg: '#2FC7F7', fg: '#fff', label: 'Bitrix24' },
  amocrm: { bg: '#333333', fg: '#fff', label: 'amoCRM' },
  hubspot: { bg: '#FF7A59', fg: '#fff', label: 'HubSpot' },
};

/** Бейджи привязанных записей во внешних CRM (Bitrix24 / amoCRM / HubSpot) — только чтение. */
export const ExternalLinksPanel: React.FC<Props> = ({ entityType, entityId }) => {
  const [links, setLinks] = useState<ExternalLinkInfo[]>([]);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    fetchExternalLinks(entityType, entityId)
      .then((list) => {
        if (!cancelled) setLinks(list);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (!entityId || links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => {
        const style = PROVIDER_STYLE[l.provider];
        const content = (
          <>
            <span
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: style.bg, color: style.fg }}
            >
              {style.label}
            </span>
            <span className="truncate text-xs font-medium text-slate-700">{l.label}</span>
          </>
        );
        return l.url ? (
          <a
            key={l.provider}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 hover:border-slate-300"
          >
            {content}
            <span className="text-slate-400">↗</span>
          </a>
        ) : (
          <div
            key={l.provider}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
};
