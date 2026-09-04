// src/pages/leads/leadTypes.ts
import type { LeadStatus, Lead, LeadTask } from '../../api/leads';

export type { LeadStatus, Lead, LeadTask };

// заодно можно оставить какой-то демо-набор, но он нам уже не обязателен
export const INITIAL_LEADS: Lead[] = [];