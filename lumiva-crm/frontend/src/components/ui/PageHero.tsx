import type { ReactNode } from 'react';

/**
 * Шапка страницы в общем стиле CRM (как bk-hero / em-hero в px-scope модулях):
 * mono-kicker с точкой, заголовок 26px, подзаголовок, действия справа, линия снизу.
 * Для страниц без своего дизайн-CSS — чтобы шапки не отличались от редизайненных разделов.
 */
export function PageHero({
  kicker,
  title,
  subtitle,
  actions,
  className = '',
}: {
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-end justify-between gap-6 border-b border-[#e7e7e7] pb-[18px] pt-2.5 ${className}`}
    >
      <div className="min-w-0">
        {kicker ? (
          <div className="mb-1.5 inline-flex items-center gap-2 font-['JetBrains_Mono',ui-monospace,monospace] text-[11px] uppercase tracking-[0.12em] text-[#888]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#222]" />
            {kicker}
          </div>
        ) : null}
        <h1 className="cd-display text-[34px] font-semibold leading-[1.05] text-[#222]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 max-w-[560px] text-[13px] leading-normal text-[#888]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
