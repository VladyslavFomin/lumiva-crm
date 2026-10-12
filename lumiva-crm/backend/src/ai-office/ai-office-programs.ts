/** Встроенные программы отдела продаж: дожим без ответа и реанимация потерянных лидов. */
export type OfficePrograms = {
  followup: { enabled: boolean; days: number[]; loseAfterDays: number };
  reactivation: { enabled: boolean; afterDays: number; perWeek: number };
  /** маркетинг: ежедневно — кампании тратят N дней без конверсий */
  adsWatch: { enabled: boolean; days: number };
  /** маркетинг: по понедельникам — пересмотр бюджета по ROAS/цене конверсии за 14 дней */
  budgetReview: { enabled: boolean };
  /** финансы: напоминания об оплате неоплаченных продаж по дням от даты продажи */
  debtReminders: { enabled: boolean; days: number[] };
  /** финансы: сводка по понедельникам с цифрами системы */
  financeWeekly: { enabled: boolean };
  /** склад: ежедневно — позиции на исходе → одна задача на дозаказ */
  stockWatch: { enabled: boolean };
  /** разработка: новый PR или новые коммиты в нём → задача «Ревью PR #N» */
  prReview: { enabled: boolean };
  /** поддержка: заявка ждёт нашего ответа дольше N часов → задача */
  supportSla: { enabled: boolean; hours: number };
  /** ресепшн: напоминание накануне визита/заезда, неявки, неподтверждённые брони, просьба об отзыве */
  bookingReminders: { enabled: boolean };
  noShows: { enabled: boolean };
  confirmations: { enabled: boolean };
  reviewRequests: { enabled: boolean };
  /** финансы: ежедневная сверка онлайн-платежей с продажами */
  reconcile: { enabled: boolean };
  /** утренняя сводка владельцу (письмо + колокольчик) — по умолчанию у всех отделов */
  digest: { enabled: boolean };
};

export function defaultPrograms(templateKey: string | null): OfficePrograms {
  const sales = templateKey === 'sales';
  const mkt = templateKey === 'marketing';
  const fin = templateKey === 'finance';
  const stock = templateKey === 'stock';
  return {
    stockWatch: { enabled: stock },
    prReview: { enabled: templateKey === 'dev' },
    supportSla: { enabled: templateKey === 'support', hours: 4 },
    reconcile: { enabled: fin },
    bookingReminders: { enabled: templateKey === 'reception' },
    noShows: { enabled: templateKey === 'reception' },
    confirmations: { enabled: templateKey === 'reception' },
    reviewRequests: { enabled: templateKey === 'reception' },
    digest: { enabled: true },
    debtReminders: { enabled: fin, days: [3, 7, 14] },
    financeWeekly: { enabled: fin },
    adsWatch: { enabled: mkt, days: 3 },
    budgetReview: { enabled: mkt },
    followup: { enabled: sales, days: [1, 3, 7], loseAfterDays: 14 },
    reactivation: { enabled: sales, afterDays: 30, perWeek: 15 },
  };
}

export function normPrograms(raw: any, templateKey: string | null): OfficePrograms {
  const d = defaultPrograms(templateKey);
  const n = (v: unknown, def: number, lo: number, hi: number) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : def);
  const days = Array.isArray(raw?.followup?.days)
    ? [...new Set((raw.followup.days as unknown[]).map((x) => n(x, 0, 1, 60)).filter((x) => x > 0))].sort((a, b) => a - b).slice(0, 5)
    : d.followup.days;
  const debtDays = Array.isArray(raw?.debtReminders?.days)
    ? [...new Set((raw.debtReminders.days as unknown[]).map((x) => n(x, 0, 1, 90)).filter((x) => x > 0))].sort((a, b) => a - b).slice(0, 5)
    : d.debtReminders.days;
  return {
    bookingReminders: { enabled: raw?.bookingReminders?.enabled !== undefined ? !!raw.bookingReminders.enabled : d.bookingReminders.enabled },
    noShows: { enabled: raw?.noShows?.enabled !== undefined ? !!raw.noShows.enabled : d.noShows.enabled },
    confirmations: { enabled: raw?.confirmations?.enabled !== undefined ? !!raw.confirmations.enabled : d.confirmations.enabled },
    reviewRequests: { enabled: raw?.reviewRequests?.enabled !== undefined ? !!raw.reviewRequests.enabled : d.reviewRequests.enabled },
    reconcile: { enabled: raw?.reconcile?.enabled !== undefined ? !!raw.reconcile.enabled : d.reconcile.enabled },
    supportSla: { enabled: raw?.supportSla?.enabled !== undefined ? !!raw.supportSla.enabled : d.supportSla.enabled, hours: n(raw?.supportSla?.hours, d.supportSla.hours, 1, 72) },
    prReview: { enabled: raw?.prReview?.enabled !== undefined ? !!raw.prReview.enabled : d.prReview.enabled },
    stockWatch: { enabled: raw?.stockWatch?.enabled !== undefined ? !!raw.stockWatch.enabled : d.stockWatch.enabled },
    digest: { enabled: raw?.digest?.enabled !== undefined ? !!raw.digest.enabled : d.digest.enabled },
    debtReminders: { enabled: raw?.debtReminders?.enabled !== undefined ? !!raw.debtReminders.enabled : d.debtReminders.enabled, days: debtDays.length ? debtDays : d.debtReminders.days },
    financeWeekly: { enabled: raw?.financeWeekly?.enabled !== undefined ? !!raw.financeWeekly.enabled : d.financeWeekly.enabled },
    adsWatch: { enabled: raw?.adsWatch?.enabled !== undefined ? !!raw.adsWatch.enabled : d.adsWatch.enabled, days: n(raw?.adsWatch?.days, d.adsWatch.days, 2, 14) },
    budgetReview: { enabled: raw?.budgetReview?.enabled !== undefined ? !!raw.budgetReview.enabled : d.budgetReview.enabled },
    followup: {
      enabled: raw?.followup?.enabled !== undefined ? !!raw.followup.enabled : d.followup.enabled,
      days: days.length ? days : d.followup.days,
      loseAfterDays: n(raw?.followup?.loseAfterDays, d.followup.loseAfterDays, 0, 120),
    },
    reactivation: {
      enabled: raw?.reactivation?.enabled !== undefined ? !!raw.reactivation.enabled : d.reactivation.enabled,
      afterDays: n(raw?.reactivation?.afterDays, d.reactivation.afterDays, 7, 365),
      perWeek: n(raw?.reactivation?.perWeek, d.reactivation.perWeek, 1, 200),
    },
  };
}
