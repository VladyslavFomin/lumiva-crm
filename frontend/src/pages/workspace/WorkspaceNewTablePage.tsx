import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { createCustomObject, createCustomObjectField } from '../../api/customObjects';

export const WorkspaceNewTablePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const finish = (searchParams.get('finish') || 'settings').toLowerCase();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createCustomObject({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      await Promise.all([
        createCustomObjectField(created.id, {
          key: 'name',
          label: 'Name',
          type: 'text',
          required: true,
        }),
        createCustomObjectField(created.id, {
          key: 'status',
          label: 'Status',
          type: 'status',
        }),
      ]);
      const tail =
        finish === 'kanban'
          ? 'kanban'
          : finish === 'analytics'
            ? 'analytics'
            : finish === 'table'
              ? 'table'
              : 'settings';
      navigate(`/workspace/${created.id}/${tail}`);
    } catch (e: any) {
      setError(e?.message || t('crm.workspace.newTable.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-900">{t('crm.workspace.newTable.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('crm.workspace.newTable.subtitle')}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('crm.workspace.newTable.name')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder={t('crm.workspace.newTable.placeholderName')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('crm.workspace.newTable.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-24"
              placeholder={t('crm.workspace.newTable.placeholderDescription')}
            />
          </div>

          {error && <div className="text-sm text-rose-600">{error}</div>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-lumiva-accent text-white text-sm font-medium disabled:opacity-60"
            >
              {saving ? t('crm.workspace.newTable.creating') : t('crm.workspace.newTable.create')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/workspace')}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm"
            >
              {t('crm.common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};

