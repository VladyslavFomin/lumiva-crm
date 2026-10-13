import type { TourStepDef } from '../help-content.types';

type Tri = [ru: string, en: string, tr: string];

/** Компактная запись шага: step('id', 'data-tour цель' | null, [заголовок ru,en,tr], [текст ru,en,tr]). */
export function step(id: string, target: string | null, title: Tri, body: Tri): TourStepDef {
  return {
    id,
    target: target || undefined,
    title: { ru: title[0], en: title[1], tr: title[2] },
    body: { ru: body[0], en: body[1], tr: body[2] },
  };
}
