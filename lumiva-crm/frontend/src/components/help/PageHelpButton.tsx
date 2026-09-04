import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

type HelpSection = {
  heading: string;
  body?: string;
  bullets?: string[];
  steps?: string[];
};

type HelpContent = {
  title: string;
  tagline?: string;
  sections: HelpSection[];
};

function useHelpContent(topic: string): HelpContent | null {
  const { t } = useTranslation();
  const content = t(`crm.help.${topic}`, { returnObjects: true }) as HelpContent | string;
  if (!content || typeof content !== 'object' || !content.title) return null;
  return content;
}

const HelpModal: React.FC<{ topic: string; open: boolean; onClose: () => void }> = ({ topic, open, onClose }) => {
  const { t } = useTranslation();
  const content = useHelpContent(topic);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !content) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="page-help-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative sticky top-0 rounded-t-2xl border-b border-slate-100 bg-white px-8 pb-4 pt-6">
          <button
            type="button"
            onClick={onClose}
            aria-label={t('crm.help.closeLabel')}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 id="page-help-modal-title" className="pr-8 text-lg font-semibold text-slate-900">
            {content.title}
          </h2>
          {content.tagline && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{content.tagline}</p>
          )}
        </div>

        <div className="space-y-5 px-8 py-5">
          {content.sections?.map((section, idx) => (
            <div key={idx}>
              <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-900">
                {section.heading}
              </h3>
              {section.body && (
                <p className="text-sm leading-relaxed text-slate-600">{section.body}</p>
              )}
              {section.bullets && (
                <ul className="mt-1 space-y-1.5">
                  {section.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.steps && (
                <ol className="mt-1 space-y-1.5">
                  {section.steps.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-600">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                        {i + 1}
                      </span>
                      <span className="pt-px">{s}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end rounded-b-2xl border-t border-slate-100 bg-slate-50 px-8 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#222222] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            {t('crm.help.closeLabel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export type PageHelpButtonProps = {
  /** Ключ раздела в crm.help.<topic> (например "leads", "leadCard", "aiAssistant") */
  topic: string;
};

/**
 * Плавающая кнопка-подсказка в углу экрана: открывает попап с простым объяснением
 * раздела для клиента (без терминов, как для новичка). Для целой страницы.
 */
export const PageHelpButton: React.FC<PageHelpButtonProps> = ({ topic }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const content = useHelpContent(topic);
  if (!content) return null;
  const buttonLabel = t('crm.help.buttonLabel');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={buttonLabel}
        aria-label={buttonLabel}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-[0_10px_30px_rgba(15,23,42,0.16)] transition hover:bg-neutral-50 hover:text-neutral-900 hover:scale-[1.04]"
      >
        <HelpMarkIcon className="h-6 w-6" />
      </button>
      <HelpModal topic={topic} open={open} onClose={() => setOpen(false)} />
    </>
  );
};

/**
 * Маленькая кнопка-подсказка "?" для встраивания внутрь панели/блока (например,
 * рядом с заголовком ИИ-панели), а не только в угол экрана.
 */
export const InlineHelpButton: React.FC<PageHelpButtonProps & { className?: string }> = ({ topic, className }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const content = useHelpContent(topic);
  if (!content) return null;
  const buttonLabel = t('crm.help.buttonLabel');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={buttonLabel}
        aria-label={buttonLabel}
        className={
          className ||
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800'
        }
      >
        <HelpMarkIcon className="h-3.5 w-3.5" />
      </button>
      <HelpModal topic={topic} open={open} onClose={() => setOpen(false)} />
    </>
  );
};

function HelpMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.451.999-1.451 1.827v.5"
      />
      <circle cx="12" cy="17.6" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  );
}
