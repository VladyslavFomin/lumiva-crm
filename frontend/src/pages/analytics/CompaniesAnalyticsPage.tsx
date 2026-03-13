// src/pages/analytics/CompaniesAnalyticsPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchAllCompaniesAnalytics, type AllCompaniesAnalytics } from '../../api/companies';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CHART_COLORS = [
  '#38bdf8',
  '#8b5cf6',
  '#f97316',
  '#22c55e',
  '#e11d48',
  '#6366f1',
];

export const CompaniesAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AllCompaniesAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchAllCompaniesAnalytics()
      .then((data) => {
        if (!alive) return;
        setAnalytics(data);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.companies.analytics.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">{t('crm.companies.analytics.loading')}</div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
          {error}
        </div>
      </MainLayout>
    );
  }

  if (!analytics) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">{t('crm.companies.analytics.noData')}</div>
      </MainLayout>
    );
  }

  // Данные для графика топ компаний по выручке
  const revenueChartData = analytics.topByRevenue.slice(0, 10).map((item) => ({
    name: item.companyName.length > 20 ? item.companyName.substring(0, 20) + '...' : item.companyName,
    revenue: item.revenue,
    projects: item.projects,
    leads: item.leads,
  }));

  // Данные для графика топ компаний по проектам
  const projectsChartData = analytics.topByProjects.slice(0, 10).map((item) => ({
    name: item.companyName.length > 20 ? item.companyName.substring(0, 20) + '...' : item.companyName,
    projects: item.projects,
    revenue: item.revenue,
  }));

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">{t('crm.companies.analytics.title')}</h1>
            <div className="text-[11px] text-slate-500">{t('crm.companies.analytics.subtitle')}</div>
          </div>
          <button
            onClick={() => navigate('/app/companies')}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-400 hover:text-slate-50 transition-colors"
          >
            {t('crm.companies.analytics.backToList')}
          </button>
        </div>

        {/* Общая статистика */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">{t('crm.companies.analytics.summary.totalCompanies')}</div>
            <div className="text-2xl font-semibold text-slate-50">{analytics.summary.totalCompanies}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">{t('crm.companies.analytics.summary.totalLeads')}</div>
            <div className="text-2xl font-semibold text-slate-50">{analytics.summary.totalLeads}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">{t('crm.companies.analytics.summary.totalProjects')}</div>
            <div className="text-2xl font-semibold text-slate-50">{analytics.summary.totalProjects}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">{t('crm.companies.analytics.summary.totalRevenue')}</div>
            <div className="text-2xl font-semibold text-emerald-400">
              {new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
              }).format(analytics.summary.totalRevenue)}
            </div>
          </div>
        </div>

        {/* Дополнительные метрики */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">{t('crm.companies.analytics.summary.potentialRevenue')}</div>
            <div className="text-xl font-semibold text-slate-300">
              {new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
              }).format(analytics.summary.totalPotentialRevenue)}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">{t('crm.companies.analytics.summary.avgConversion')}</div>
            <div className="text-xl font-semibold text-slate-300">
              {analytics.summary.avgConversionRate.toFixed(2)}%
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">{t('crm.companies.analytics.summary.avgRevenuePerCompany')}</div>
            <div className="text-xl font-semibold text-slate-300">
              {analytics.summary.totalCompanies > 0
                ? new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'EUR',
                    minimumFractionDigits: 0,
                  }).format(analytics.summary.totalRevenue / analytics.summary.totalCompanies)
                : '0 €'}
            </div>
          </div>
        </div>

        {/* Графики */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Топ компаний по выручке */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
            <h3 className="text-xs font-semibold text-slate-300 mb-4">{t('crm.companies.analytics.charts.topByRevenue')}</h3>
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#22c55e" name={t('crm.companies.analytics.charts.revenue')} />
                  <Bar dataKey="projects" fill="#8b5cf6" name={t('crm.companies.analytics.charts.projects')} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-xs text-slate-400">{t('crm.companies.analytics.noData')}</div>
            )}
          </div>

          {/* Топ компаний по проектам */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
            <h3 className="text-xs font-semibold text-slate-300 mb-4">{t('crm.companies.analytics.charts.topByProjects')}</h3>
            {projectsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="projects" fill="#6366f1" name={t('crm.companies.analytics.charts.projects')} />
                  <Bar dataKey="revenue" fill="#22c55e" name={t('crm.companies.analytics.charts.revenue')} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-xs text-slate-400">{t('crm.companies.analytics.noData')}</div>
            )}
          </div>
        </div>

        {/* Таблица топ компаний */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          <h3 className="text-xs font-semibold text-slate-300 mb-4">{t('crm.companies.analytics.table.topByRevenue')}</h3>
          {analytics.topByRevenue.length > 0 ? (
            <div className="space-y-2">
              {analytics.topByRevenue.slice(0, 10).map((item, index) => (
                <div
                  key={item.companyId}
                  onClick={() => navigate(`/app/companies/${item.companyId}/edit`)}
                  className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl cursor-pointer hover:border-slate-600/80 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-semibold text-slate-300">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-slate-50">{item.companyName}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.projects} {t('crm.companies.analytics.table.projects')} • {item.leads} {t('crm.companies.analytics.table.leads')}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-emerald-400">
                    {new Intl.NumberFormat('ru-RU', {
                      style: 'currency',
                      currency: 'EUR',
                      minimumFractionDigits: 0,
                    }).format(item.revenue)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-xs text-slate-400">{t('crm.companies.analytics.noData')}</div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};


