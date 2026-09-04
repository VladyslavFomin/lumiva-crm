// src/pages/settings/ApiTokensPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchApiTokens,
  createApiToken,
  updateApiToken,
  deleteApiToken,
  type ApiTokenRecord,
} from '../../api/apiTokens';
import { useAlertModal } from '../../contexts/AlertModalContext';
import '../telephony/telephony-design.css';

const maskToken = (token: string) => {
  if (token.length <= 10) return token;
  return `${token.slice(0, 6)}${'•'.repeat(10)}${token.slice(-4)}`;
};

export const ApiTokensPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const at = (key: string, opts?: Record<string, unknown>) => t(`crm.settings.apiTokens.${key}`, opts as any) as string;
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert, showConfirm } = useAlertModal();
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justCreated, setJustCreated] = useState<ApiTokenRecord | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    fetchApiTokens()
      .then(setTokens)
      .catch((e: any) => showAlert(e?.message || at('loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const created = await createApiToken({ name: name.trim(), description: description.trim() || null });
      setJustCreated(created);
      setName('');
      setDescription('');
      setShowForm(false);
      load();
    } catch (e: any) {
      showAlert(e?.message || at('createError'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (tok: ApiTokenRecord) => {
    try {
      await updateApiToken(tok.id, { isActive: !tok.isActive });
      load();
    } catch (e: any) {
      showAlert(e?.message || at('toggleError'), { variant: 'error' });
    }
  };

  const handleDelete = async (tok: ApiTokenRecord) => {
    const ok = await showConfirm(at('deleteConfirmFormat', { name: tok.name }), {
      title: at('deleteConfirmTitle'),
      confirmLabel: at('deleteConfirmBtn'),
      cancelLabel: at('cancelConfirmBtn'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteApiToken(tok.id);
      load();
    } catch (e: any) {
      showAlert(e?.message || at('deleteError'), { variant: 'error' });
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <h1>{at('title')}</h1>
            <p className="sub">
              {at('subtitlePrefix')}
              <a href="/api-integration" style={{ textDecoration: 'underline' }}>{at('docsLink')}</a>
              {at('subtitleSuffix')}
            </p>
          </div>
          <div className="tel-hero-r">
            <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? at('cancelBtn') : at('newTokenBtn')}
            </button>
          </div>
        </div>

        {justCreated && (
          <div className="ha-section" style={{ borderColor: '#1f8a5e' }}>
            <div className="ha-section-head">
              <div>
                <h3 style={{ color: '#1f8a5e' }}>{at('createdTitle')}</h3>
                <div className="sub">{at('createdHint')}</div>
              </div>
            </div>
            <div
              style={{
                fontFamily: 'var(--ff-mono)',
                fontSize: 13,
                background: 'var(--bg-muted)',
                padding: '10px 14px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span>{justCreated.token}</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(justCreated.token);
                  showAlert(at('copiedMsg'), { variant: 'success' });
                }}
              >
                {at('copyBtn')}
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="ha-section">
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gap: 10, maxWidth: 480 }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={at('form.namePlaceholder')}
                  className="info-input"
                />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={at('form.descriptionPlaceholder')}
                  className="info-input"
                />
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: 'fit-content' }}>
                  {submitting ? at('form.creatingBtn') : at('form.createBtn')}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3>{at('listTitle')}</h3>
              <div className="sub">{at('listHint')} <code>X-Api-Token: &lt;token&gt;</code></div>
            </div>
          </div>
          {loading ? (
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{at('loading')}</div>
          ) : tokens.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{at('empty')}</div>
          ) : (
            <div className="pace-table-wrap">
              <table className="pace-table">
                <thead>
                  <tr>
                    <th>{at('table.name')}</th>
                    <th>{at('table.token')}</th>
                    <th>{at('table.status')}</th>
                    <th>{at('table.created')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((tok) => (
                    <tr key={tok.id}>
                      <td>
                        {tok.name}
                        {tok.description && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{tok.description}</div>}
                      </td>
                      <td>
                        <span
                          style={{ fontFamily: 'var(--ff-mono)', fontSize: 11.5, cursor: 'pointer' }}
                          onClick={() => toggleReveal(tok.id)}
                          title={at('revealTitle')}
                        >
                          {revealedIds.has(tok.id) ? tok.token : maskToken(tok.token)}
                        </span>
                      </td>
                      <td>
                        <span className={tok.isActive ? 'need low' : 'need high'}>{tok.isActive ? at('statusActive') : at('statusRevoked')}</span>
                      </td>
                      <td style={{ color: 'var(--fg-3)' }}>{new Date(tok.createdAt).toLocaleDateString(dateLocale)}</td>
                      <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-sm" onClick={() => handleToggleActive(tok)}>
                          {tok.isActive ? at('revokeBtn') : at('restoreBtn')}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          onClick={() => handleDelete(tok)}
                        >
                          {at('deleteBtn')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ApiTokensPage;
