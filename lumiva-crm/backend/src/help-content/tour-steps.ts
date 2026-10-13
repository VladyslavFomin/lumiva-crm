import type { TourStepDef } from './help-content.types';
import { GENERAL_TOURS } from './tours/general';
import { LEADS_TOURS } from './tours/leads';
import { CLIENTS_TOURS } from './tours/clients';
import { SALES_TOURS } from './tours/sales';
import { PROJECTS_TOURS } from './tours/projects';
import { PRODUCTS_TOURS } from './tours/products';
import { BOOKINGS_TOURS } from './tours/bookings';
import { HOTELS_TOURS } from './tours/hotels';
import { COMMUNICATIONS_TOURS } from './tours/communications';
import { AI_EMPLOYEES_TOURS } from './tours/aiEmployees';
import { MARKETING_TOURS } from './tours/marketing';

/**
 * Шаги туров по страницам (topic = тот же ключ, что у кнопки «?», crm.help.<topic>).
 * target → элемент страницы с атрибутом data-tour="<target>". Если элемента нет на экране
 * (пустой список, скрыт правами, мобильная вёрстка) — шаг показывается окном по центру.
 * id шага стабилен: к нему в pl1 привязано видео/gif. Тексты — простые, для новичка, 5–8 шагов.
 */
export const TOUR_STEPS: Record<string, TourStepDef[]> = {
  ...GENERAL_TOURS,
  ...LEADS_TOURS,
  ...CLIENTS_TOURS,
  ...SALES_TOURS,
  ...PROJECTS_TOURS,
  ...PRODUCTS_TOURS,
  ...BOOKINGS_TOURS,
  ...HOTELS_TOURS,
  ...COMMUNICATIONS_TOURS,
  ...AI_EMPLOYEES_TOURS,
  ...MARKETING_TOURS,
};
