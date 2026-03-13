// src/pages/marketing/EmailTemplatesPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchEmailTemplates, deleteEmailTemplate, type EmailTemplate } from '../../api/email';

export const EmailTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmailTemplates();
      setTemplates(data);
    } catch (e: any) {
      setError(e.message || t('crm.emailTemplates.list.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => navigate('/app/marketing/email-templates/new');
  const handleEdit = (id: string) => navigate(`/app/marketing/email-templates/${id}`);
  const handleDelete = async (id: string) => {
    if (!confirm(t('crm.emailTemplates.list.deleteConfirm'))) return;
    try {
      await deleteEmailTemplate(id);
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message || t('crm.emailTemplates.list.errors.deleteFailed'));
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-slate-400">{t('crm.emailTemplates.list.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">{t('crm.emailTemplates.list.title')}</h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.emailTemplates.list.subtitle')}
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
          >
            + {t('crm.emailTemplates.list.create')}
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Список шаблонов */}
        {templates.length === 0 ? (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-8 text-center">
            <div className="text-sm text-slate-400 mb-2">{t('crm.emailTemplates.list.empty')}</div>
            <button
              onClick={handleCreate}
              className="text-xs text-lumiva-accent hover:text-lumiva-accent-soft"
            >
              {t('crm.emailTemplates.list.createFirst')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 hover:border-slate-700/80 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-50 mb-1">{template.name}</h3>
                    {template.description && (
                      <div className="text-[11px] text-slate-400 line-clamp-2">
                        {template.description}
                      </div>
                    )}
                  </div>
                  <div className={`w-2 h-2 rounded-full ml-2 ${template.isActive ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                </div>

                {template.subject && (
                  <div className="text-[10px] text-slate-500 mb-2 truncate">
                    Тема: {template.subject}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleEdit(template.id)}
                    className="flex-1 px-2 py-1.5 text-[10px] rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-800/80 transition-colors"
                  >
                    {t('crm.emailTemplates.list.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="px-2 py-1.5 text-[10px] rounded-lg text-red-400 hover:bg-red-950/30 transition-colors"
                  >
                    {t('crm.emailTemplates.list.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};




