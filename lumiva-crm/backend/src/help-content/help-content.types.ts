export type L10n = { ru: string; en: string; tr: string };
export type HelpLang = keyof L10n;

/** Один шаг тура: окно рядом с элементом страницы `[data-tour="<target>"]`. */
export type TourStepDef = {
  /** Стабильный id шага — к нему привязывается видео/gif в pl1, менять нельзя. */
  id: string;
  /** Значение data-tour у элемента; нет элемента на экране → окно по центру. */
  target?: string;
  title: L10n;
  body: L10n;
};

export type HelpMediaKind = 'video' | 'gif';

/** id «шага» для видео-гайда всей страницы (показывается в окне «?»). */
export const PAGE_GUIDE_STEP = '_page';
