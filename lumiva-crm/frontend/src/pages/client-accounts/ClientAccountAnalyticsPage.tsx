import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ccpApi, type CcpClientAnalytics, type CcpTxn } from '../../api/ccp';
import { MainLayout } from '../../layout/MainLayout';
import { ProjectsAnalyticsPage } from '../projects/ProjectsAnalyticsPage';
import type { Project, ProjectStatus } from '../projects/projectTypes';

function s(value: any) {
  return String(value ?? '').trim();
}

function money(value: any) {
  const n = Number(s(value).replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(value: any) {
  const n = typeof value === 'number' ? value : money(value);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPercent(value: number | null | undefined) {
  return value == null ? 'Нет данных' : `${fmtMoney(value)}%`;
}

function fmtNullableMoney(value: number | null | undefined) {
  return value == null ? 'Нет данных' : fmtMoney(value);
}

function displayAccountBalance(account: any) {
  const financial = account?.financial || {};
  const explicit =
    account?.displayBalance ??
    account?.totalBalance ??
    account?.totalEquity ??
    financial?.totalEquity ??
    financial?.displayBalance ??
    financial?.totalBalance;
  if (explicit !== undefined && explicit !== null && String(explicit) !== '') return money(explicit);

  const operational = account?.balanceOperational ?? financial?.balanceOperational;
  const profitBalance = account?.profitBalance ?? financial?.profitBalance;
  const creditBalance = account?.creditBalance ?? financial?.creditBalance;
  if ([operational, profitBalance, creditBalance].some((value) => value !== undefined && value !== null && String(value) !== '')) {
    return money(operational) + money(profitBalance) + money(creditBalance);
  }

  return money(account?.balance ?? financial?.balance) +
    money(account?.profit ?? financial?.availableProfit) +
    money(account?.credit ?? financial?.creditLeverage ?? financial?.creditLeverageTotal);
}

function statusFrom(value: any): ProjectStatus {
  const key = s(value).toLowerCase();
  if (key.includes('done') || key.includes('completed') || key.includes('success') || key.includes('выполн')) {
    return 'Закрыт';
  }
  if (key.includes('fail') || key.includes('cancel') || key.includes('reject') || key.includes('ошиб')) {
    return 'Проиграно';
  }
  if (key.includes('pending') || key.includes('progress') || key.includes('ожида')) return 'В работе';
  return 'Новый';
}

function classifyTxn(txn: CcpTxn) {
  const category = s((txn as any).meta?.financialCategory);
  if (category === 'deposit') return 'Депозит';
  if (category === 'account_fee') return 'Списание';
  if (category === 'manual_adjustment') return 'Корректировка';
  if (category === 'transfer') return 'Перевод';
  if (category === 'profit_accrual') return 'Начисление прибыли';
  if (category === 'withdrawal' || category === 'bank_transfer') return 'Вывод';
  if (category === 'investment') return 'Инвестиция';
  if (category === 'credit_leverage') return 'Кредит';
  if (category === 'credit_repayment') return 'Погашение кредита';
  const haystack = `${txn.title || ''} ${txn.desc || ''} ${txn.ccpStatus || ''} ${txn.status || ''}`.toLowerCase();
  if (/profit|прибыл|доход|yield/.test(haystack)) return 'Профит';
  if (/invest|инвест|deposit|вклад/.test(haystack)) return 'Инвестиция';
  if (/fee|commission|списан|комисс|обслуж/.test(haystack)) return 'Списание';
  if (/credit|кредит|плеч/.test(haystack)) return 'Кредит';
  return 'Расход';
}

function dateOf(value: any) {
  const raw = s(value);
  return raw || new Date().toISOString();
}

const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';
}> = ({ label, value, hint, tone = 'slate' }) => {
  const tones = {
    sky: 'border-sky-200 bg-sky-50 text-sky-950',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-950',
    slate: 'border-neutral-200 bg-white text-[#222]',
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-2 text-xs text-neutral-600">{hint}</div> : null}
    </div>
  );
};

const ClientAccountAnalyticsPage: React.FC = () => {
  const { clientId = '' } = useParams();
  const [data, setData] = useState<CcpClientAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async (fresh: 0 | 1) => {
    if (!clientId) return;
    if (fresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await ccpApi.clientAnalytics(clientId, { fresh });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить аналитику клиента');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const client = data?.client;
  const investments = Array.isArray(client?.meta?.investments) ? client.meta.investments : [];
  const accounts = Array.isArray(client?.meta?.accounts) ? client.meta.accounts : [];
  const financialSummary = Array.isArray(client?.meta?.financialSummary) ? client.meta.financialSummary : [];

  const currencyTotals = useMemo(() => {
    const empty = () => ({ USD: 0, EUR: 0 });
    const pickSummary = (...keys: string[]) => {
      const out = empty();
      financialSummary.forEach((row: any) => {
        const currency = String(row?.currency || '').toUpperCase();
        if (currency !== 'USD' && currency !== 'EUR') return;
        const key = keys.find((candidate) => row?.[candidate] !== undefined && row?.[candidate] !== null && String(row[candidate]) !== '');
        if (key) out[currency] += money(row[key]);
      });
      return out;
    };
    const addInvestments = (target: { USD: number; EUR: number }, key: 'invested' | 'expectedProfit') => {
      investments.forEach((investment: any) => {
        const currency = String(investment?.currency || '').toUpperCase();
        if (currency === 'USD' || currency === 'EUR') target[currency] += money(investment?.[key]);
      });
      return target;
    };
    const operationExpenses = empty();
    data?.txns.forEach((txn: any) => {
      const category = String(txn?.meta?.financialCategory || '').toLowerCase();
      if (!['account_fee', 'withdrawal', 'bank_transfer', 'transfer'].includes(category)) return;
      operationExpenses.EUR += Math.abs(money(txn.spendEur));
      operationExpenses.USD += Math.abs(money(txn.spendUsd));
    });

    const invested = pickSummary('invested', 'investmentTotal');
    if (!invested.USD && !invested.EUR) addInvestments(invested, 'invested');
    const expected = pickSummary('expectedProfit');
    if (!expected.USD && !expected.EUR) addInvestments(expected, 'expectedProfit');

    return {
      invested,
      expected,
      profit: pickSummary('profitAccrued', 'profitAccrualTotal'),
      accountFee: pickSummary('accountFee', 'accountWriteOff'),
      credit: pickSummary('creditLeverage', 'creditLeverageTotal'),
      expenses: operationExpenses,
    };
  }, [data?.txns, financialSummary, investments]);

  const dualMoney = (totals: { USD: number; EUR: number }) => ({
    value: `${fmtMoney(totals.USD)} USD`,
    hint: `${fmtMoney(totals.EUR)} EUR`,
  });

  const items = useMemo<Project[]>(() => {
    if (!data) return [];
    const txns = data.txns.map((txn) => {
      const eur = money(txn.spendEur);
      const usd = money(txn.spendUsd);
      const amount = Math.abs(eur || usd);
      const currency = eur ? 'EUR' : usd ? 'USD' : 'EUR';
      const category = classifyTxn(txn);
      return {
        id: `txn-${txn.id}`,
        name: txn.title || `Операция #${txn.wpPostId}`,
        description: txn.desc || '',
        amount,
        currency,
        status: statusFrom(txn.ccpStatus || txn.status),
        category,
        tags: ['Операция', category],
        owner: client?.email || null,
        leadId: null,
        leadName: null,
        leadEmail: client?.email || null,
        ownerUserIds: [],
        customFields: {
          source: 'txn',
          financialCategory: (txn as any).meta?.financialCategory || '',
          accountId: (txn as any).meta?.accountId || '',
          assetId: (txn as any).meta?.assetId || '',
          amountEur: eur,
          amountUsd: usd,
          wpPostId: txn.wpPostId,
          ccpStatus: txn.ccpStatus || txn.status || '',
        },
        tasks: [],
        comments: [],
        createdAt: dateOf(txn.date || txn.createdAt),
        updatedAt: txn.updatedAt,
      };
    });

    return txns;
  }, [client?.email, data]);

  const toolbar = data ? (
    <div className="space-y-4 rounded-[28px] border border-neutral-200 bg-white p-5 text-[#222] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/app/client-accounts/${clientId}`}
            className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Карточка клиента
          </Link>
          <Link
            to="/app/client-accounts"
            className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Все клиенты
          </Link>
        </div>
        <button
          type="button"
          onClick={() => load(1)}
          disabled={refreshing}
          className="rounded-2xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
        >
          {refreshing ? 'Синхронизация...' : 'Обновить полностью'}
        </button>
      </div>

      {data.sync.errors.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Не все данные удалось обновить с сайта. Показана локальная аналитика: {data.sync.errors.join('; ')}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Баланс счетов"
          value={`${fmtMoney(data.metrics.balances.eur)} EUR`}
          hint={`${fmtMoney(data.metrics.balances.usd)} USD`}
          tone="sky"
        />
        <KpiCard
          label="Инвестировано"
          value={dualMoney(currencyTotals.invested).value}
          hint={`${dualMoney(currencyTotals.invested).hint} · стиль: ${data.metrics.investments.style || 'нет данных'} · ${fmtPercent(data.metrics.investments.annualPercent)} годовых`}
          tone="emerald"
        />
        <KpiCard
          label="Ожидаемый профит"
          value={dualMoney(currencyTotals.expected).value}
          hint={`${dualMoney(currencyTotals.expected).hint} · по данным сайта NSM`}
          tone="amber"
        />
        <KpiCard
          label="Расходы и переводы"
          value={dualMoney(currencyTotals.expenses).value}
          hint={`${dualMoney(currencyTotals.expenses).hint} · операций: ${data.metrics.counts.txns}`}
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard
          label="Начисление прибыли"
          value={dualMoney(currencyTotals.profit).value}
          hint={`${dualMoney(currencyTotals.profit).hint} · ${fmtPercent(data.metrics.investments.profitMonthlyPercent)} в месяц`}
          tone="emerald"
        />
        <KpiCard
          label="Списание за счет"
          value={dualMoney(currencyTotals.accountFee).value}
          hint={`${dualMoney(currencyTotals.accountFee).hint} · ${fmtPercent(data.metrics.accountCosts.monthlyPercent)} в месяц`}
          tone="rose"
        />
        <KpiCard
          label="Кредитное плечо"
          value={dualMoney(currencyTotals.credit).value}
          hint={`${dualMoney(currencyTotals.credit).hint} · погашение: ${fmtNullableMoney(data.metrics.credit.expectedMonthlyRepay)} / мес.`}
          tone="amber"
        />
      </div>

      {accounts.length ? (
        <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Счета клиента</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account: any, index) => {
              const financial = account.financial || {};
              return (
                <div key={account.externalAccountId || account.id || index} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-sm font-semibold text-[#222]">{account.number || `Счет ${index + 1}`}</div>
                  <div className="mt-1 text-xs text-neutral-500">{account.currency || financial.currency || '—'}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-neutral-500">Баланс CRM:</span> {fmtMoney(displayAccountBalance(account))}</div>
                    <div><span className="text-neutral-500">Опер. баланс:</span> {fmtMoney(financial.balanceOperational ?? account.balanceOperational ?? financial.balance ?? account.balance)}</div>
                    <div><span className="text-neutral-500">Накоплено:</span> {fmtMoney(financial.profitBalance ?? account.profitBalance ?? financial.availableProfit ?? account.profit)}</div>
                    <div><span className="text-neutral-500">Кредит:</span> {fmtMoney(financial.creditBalance ?? account.creditBalance ?? financial.creditLeverage ?? account.credit)}</div>
                    <div><span className="text-neutral-500">Инвестировано:</span> {fmtMoney(financial.invested ?? financial.investmentTotal)}</div>
                    <div><span className="text-neutral-500">Профит:</span> {fmtMoney(financial.profitAccrued ?? financial.profitAccrualTotal)}</div>
                    <div><span className="text-neutral-500">Ожидается:</span> {fmtMoney(financial.expectedProfit)}</div>
                    <div><span className="text-neutral-500">Комиссия:</span> {fmtMoney(financial.accountFee ?? financial.accountWriteOff)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {investments.length ? (
        <div className="rounded-3xl border border-neutral-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Во что сделаны инвестиции</div>
          <div className="mt-3 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                <tr>
                  <th className="py-2 pr-4">Актив</th>
                  <th className="py-2 pr-4">Категория</th>
                  <th className="py-2 pr-4">Доходность</th>
                  <th className="py-2 pr-4">Инвестировано</th>
                  <th className="py-2 pr-4">Ожидаемый профит</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((investment: any, index) => (
                  <tr key={investment.transactionId || `${investment.assetId}-${index}`} className="border-t border-neutral-100">
                    <td className="py-2 pr-4 font-medium text-[#222]">
                      {investment.assetName || '—'}
                      {investment.assetExcerpt ? <div className="mt-1 text-[11px] font-normal text-neutral-500">{investment.assetExcerpt}</div> : null}
                    </td>
                    <td className="py-2 pr-4 text-neutral-700">{investment.assetCategory || '—'}</td>
                    <td className="py-2 pr-4 text-neutral-700">{investment.assetCalculation || fmtPercent(money(investment.assetProfitRate))}</td>
                    <td className="py-2 pr-4 text-neutral-700">{fmtMoney(investment.invested)} {investment.currency || ''}</td>
                    <td className="py-2 pr-4 text-neutral-700">{fmtMoney(investment.expectedProfit)} {investment.currency || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  if (loading) {
    return (
      <MainLayout>
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-700">
          Загружаем все операции, переводы и аналитику клиента...
        </div>
      </MainLayout>
    );
  }

  if (error || !data) {
    return (
      <MainLayout>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
          {error || 'Нет данных аналитики'}
        </div>
      </MainLayout>
    );
  }

  const title = client?.name || client?.email || `Клиент #${client?.wpUserId || clientId}`;

  return (
    <ProjectsAnalyticsPage
      externalItems={items}
      storageNamespace={`client_account_operations_analytics_v3_${clientId}`}
      analyticsFields={[
        { key: 'source', label: 'Источник данных', type: 'select' },
        { key: 'financialCategory', label: 'Финансовая категория', type: 'select' },
        { key: 'amountUsd', label: 'Сумма USD', type: 'number' },
        { key: 'amountEur', label: 'Сумма EUR', type: 'number' },
        { key: 'ccpStatus', label: 'Статус CCP', type: 'text' },
      ]}
      header={{
        kicker: 'Client Accounts',
        title: `Аналитика клиента: ${title}`,
        subtitle: 'Счета, инвестиции, ожидаемый профит, затраты, операции и переводы в одном отчете.',
      }}
      analyticsLabels={{
        total: 'Всего операций',
        line: 'Динамика операций',
        table: 'Таблица операций',
        record: 'Операция',
      }}
      defaultWidgetsOverride={[
        {
          id: 'metric-total-operations',
          type: 'metric',
          title: 'Всего операций',
          metricKey: 'total',
          size: 'sm',
          span: 3,
          height: 160,
        },
        {
          id: 'metric-total-usd',
          type: 'metric',
          title: 'На сумму USD',
          metricKey: 'sum:amountUsd',
          size: 'sm',
          span: 3,
          height: 160,
        },
        {
          id: 'metric-total-eur',
          type: 'metric',
          title: 'На сумму EUR',
          metricKey: 'sum:amountEur',
          size: 'sm',
          span: 3,
          height: 160,
        },
        {
          id: 'metric-categories',
          type: 'metric',
          title: 'Категорий операций',
          metricKey: 'filled:financialCategory',
          size: 'sm',
          span: 3,
          height: 160,
        },
        {
          id: 'chart-operations-line',
          type: 'line',
          title: 'Динамика операций',
          chartKey: 'field:financialCategory',
          chartValueMode: 'count',
          size: 'md',
          span: 8,
          height: 360,
        },
        {
          id: 'chart-operations-donut',
          type: 'donut',
          title: 'Типы операций',
          chartKey: 'field:financialCategory',
          size: 'md',
          span: 4,
          height: 320,
          showLabels: true,
        },
        {
          id: 'chart-operations-bar',
          type: 'bar',
          title: 'Количество по типам операций',
          chartKey: 'field:financialCategory',
          chartValueMode: 'count',
          size: 'md',
          span: 6,
          height: 320,
        },
        {
          id: 'table-operations',
          type: 'table',
          title: 'Таблица операций',
          tableKey: 'projects',
          size: 'md',
          span: 6,
          height: 320,
        },
      ]}
      toolbarSlot={toolbar}
    />
  );
};

export default ClientAccountAnalyticsPage;
