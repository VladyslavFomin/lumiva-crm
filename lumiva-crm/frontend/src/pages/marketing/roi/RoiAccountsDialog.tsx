/**
 * «Кабинеты и клиенты»: какой компании CRM принадлежит каждый рекламный кабинет / ресурс GA4,
 * подсказки по названию, создание компании прямо в строке и выбор действий-конверсий Meta.
 */
import React, { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import type { RoiAccount } from '../../../api/marketing';
import { marketingProviderFamilyLabel } from '../../../utils/marketingDataSourceLabel';
import { Ico, PI } from './RoiParts';

export const RoiAccountsDialog: React.FC<{
  accounts: RoiAccount[];
  companies: Array<{ id: string; name: string }>;
  busy: boolean;
  savedKey: string | null;
  locale: string;
  t: TFunction;
  onClose: () => void;
  onAssign: (key: string, companyId: string | null) => Promise<void>;
  onCreateCompany: (key: string, name: string) => Promise<void>;
  onAcceptSuggestions: (list: RoiAccount[]) => Promise<void>;
  onSaveMetaActions: (key: string, conv: string[], value: string[]) => Promise<void>;
}> = ({ accounts, companies, busy, savedKey, locale, t, onClose, onAssign, onCreateCompany, onAcceptSuggestions, onSaveMetaActions }) => {
  const [newFor, setNewFor] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ conv: string[]; value: string[] }>({ conv: [], value: [] });
  const suggestions = useMemo(() => accounts.filter((a) => !a.companyId && a.suggestedCompanyId), [accounts]);
  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? '';

  return (
    <div className="roi-dlg-bd" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="roi-dlg wide" role="dialog" aria-label={t('crm.marketingRoi.accountsTitle', { defaultValue: 'Кабинеты и клиенты' })}>
        <header>
          <div>
            <div className="kick">{t('crm.marketingRoi.accountsKick', { defaultValue: 'Привязка к компаниям CRM' })}</div>
            <h3>{t('crm.marketingRoi.accountsTitle', { defaultValue: 'Кабинеты и клиенты' })}</h3>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {suggestions.length > 0 && (
              <button type="button" className="roi-btn pri sm" disabled={busy} onClick={() => void onAcceptSuggestions(suggestions)}>
                {t('crm.marketingRoi.acceptSuggestions', { defaultValue: 'Принять подсказки ({{n}})', n: suggestions.length })}
              </button>
            )}
            <button type="button" className="roi-ib" onClick={onClose} aria-label="×">
              <Ico d={PI.x} />
            </button>
          </div>
        </header>
        <p>
          {t('crm.marketingRoi.accountsHint', {
            defaultValue:
              'Укажите, какой компании-клиенту принадлежит каждый рекламный кабинет. Несколько кабинетов разных площадок можно привязать к одной компании.',
          })}
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="roi-acc">
            <thead>
              <tr>
                <th>{t('crm.marketingRoi.colPlatform', { defaultValue: 'Площадка' })}</th>
                <th>{t('crm.marketingRoi.colAccount', { defaultValue: 'Кабинет' })}</th>
                <th style={{ textAlign: 'right' }}>{t('crm.marketingRoi.colSpendAll', { defaultValue: 'Расход (всё время)' })}</th>
                <th>{t('crm.marketingRoi.colClient', { defaultValue: 'Клиент' })}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.key}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--fg-2)' }}>{marketingProviderFamilyLabel(a.provider)}</td>
                  <td title={a.key}>{a.label}</td>
                  <td className="n">{a.cost ? `${a.cost.toLocaleString(locale, { maximumFractionDigits: 0 })} ${a.currency}` : '—'}</td>
                  <td>
                    <div className="row">
                      <select
                        value={a.companyId ?? ''}
                        disabled={busy}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__new__') {
                            setNewFor(a.key);
                            setNewName((a.label || '').replace(/\s*(20\d\d|hotels?|resorts?)\b.*$/i, '').trim());
                            return;
                          }
                          void onAssign(a.key, v || null);
                        }}
                      >
                        <option value="">{t('crm.marketingRoi.notAssigned', { defaultValue: '— не привязан —' })}</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value="__new__">{t('crm.marketingRoi.newCompany', { defaultValue: '+ Новая компания…' })}</option>
                      </select>
                      {newFor === a.key && (
                        <>
                          <input
                            type="text"
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newName.trim()) void onCreateCompany(a.key, newName.trim()).then(() => setNewFor(null));
                              if (e.key === 'Escape') setNewFor(null);
                            }}
                            placeholder={t('crm.marketingRoi.newCompanyPrompt', { defaultValue: 'Название компании-клиента' })}
                          />
                          <button
                            type="button"
                            className="roi-btn pri sm"
                            disabled={busy || !newName.trim()}
                            onClick={() => void onCreateCompany(a.key, newName.trim()).then(() => setNewFor(null))}
                          >
                            {t('crm.marketingRoi.create', { defaultValue: 'Создать' })}
                          </button>
                          <button type="button" className="lnk" onClick={() => setNewFor(null)}>
                            ×
                          </button>
                        </>
                      )}
                      {!a.companyId && a.suggestedCompanyId && (
                        <button type="button" className="lnk hint" disabled={busy} onClick={() => void onAssign(a.key, a.suggestedCompanyId)}>
                          {t('crm.marketingRoi.suggested', { defaultValue: 'Предложено: {{name}}', name: companyName(a.suggestedCompanyId) })}
                        </button>
                      )}
                      {a.metaActions && (
                        <button
                          type="button"
                          className="lnk"
                          onClick={() => {
                            setActionsFor(actionsFor === a.key ? null : a.key);
                            setDraft({ conv: a.metaActions!.conversionAction, value: a.metaActions!.revenueAction });
                          }}
                        >
                          {t('crm.marketingRoi.metaActionsBtn', { defaultValue: 'Конверсии: {{list}}', list: a.metaActions.conversionAction.join(', ') })}
                        </button>
                      )}
                      {savedKey === a.key && (
                        <span className="saved">
                          {t('crm.marketingRoi.metaActionsSaved', { defaultValue: 'Сохранено — кабинет пересинхронизируется (до минуты)' })}
                        </span>
                      )}
                    </div>
                    {actionsFor === a.key && a.metaActions && (
                      <div className="roi-acts-ed">
                        {(['conv', 'value'] as const).map((kind) => {
                          const available = Object.entries(a.metaActions!.available);
                          const selected = draft[kind];
                          const extra = selected.filter((x) => !a.metaActions!.available[x]);
                          return (
                            <div key={kind}>
                              <div className="kick" style={{ marginBottom: 4 }}>
                                {kind === 'conv'
                                  ? t('crm.marketingRoi.metaConvTitle', { defaultValue: 'Считать конверсией' })
                                  : t('crm.marketingRoi.metaValueTitle', { defaultValue: 'Ценность как выручка площадки' })}
                              </div>
                              <div className="lst">
                                {[...extra.map((x) => [x, 0] as [string, number]), ...available].map(([type, count]) => (
                                  <label key={type}>
                                    <input
                                      type="checkbox"
                                      checked={selected.includes(type)}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          [kind]: e.target.checked ? [...d[kind], type] : d[kind].filter((x) => x !== type),
                                        }))
                                      }
                                    />
                                    <span className="ty">{type}</span>
                                    {count ? <span className="mut">· {count.toLocaleString(locale)}</span> : null}
                                  </label>
                                ))}
                                {!available.length && (
                                  <span className="mut">{t('crm.marketingRoi.metaNoActions', { defaultValue: 'Список действий появится после синхронизации кабинета.' })}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div className="ft">
                          <button
                            type="button"
                            className="roi-btn pri sm"
                            disabled={busy}
                            onClick={() => void onSaveMetaActions(a.key, draft.conv, draft.value).then(() => setActionsFor(null))}
                          >
                            {t('crm.marketingRoi.save', { defaultValue: 'Сохранить' })}
                          </button>
                          <span>
                            {t('crm.marketingRoi.metaActionsHint', {
                              defaultValue: 'Meta дублирует события под разными именами (lead, onsite_web_lead…) — отмечайте одно из дублей.',
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!accounts.length && (
                <tr>
                  <td colSpan={4} className="mut">
                    {t('crm.marketingRoi.noAccounts', {
                      defaultValue: 'Нет данных рекламных кабинетов — подключите Google Ads, Meta Ads, Яндекс.Директ или VK Реклама.',
                    })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
