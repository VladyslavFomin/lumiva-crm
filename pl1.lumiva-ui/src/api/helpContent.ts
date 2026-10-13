// src/api/helpContent.ts — pl1 → «Контент»: видео/gif к подсказкам-турам CRM.
import { apiClient } from "./client";

export type HelpMediaKind = "video" | "gif";

export interface HelpCatalogStep {
  id: string;
  title: string;
  body: string;
}

export interface HelpCatalogPage {
  topic: string;
  group: string;
  title: string;
  steps: HelpCatalogStep[];
}

export interface HelpMediaRow {
  topic: string;
  stepId: string;
  kind: HelpMediaKind;
  url: string;
  updatedAt?: string;
}

export interface HelpCatalog {
  groups: { id: string; title: string }[];
  pages: HelpCatalogPage[];
  media: HelpMediaRow[];
}

/** id «шага» для видео-гайда всей страницы (окно «?» в CRM). */
export const PAGE_GUIDE_STEP = "_page";

export async function fetchHelpCatalog(): Promise<HelpCatalog> {
  const res = await apiClient.get<HelpCatalog>("/platform/help-content");
  return res.data;
}

/** Пустой url — удалить ссылку (подсказка показывается только текстом). */
export async function saveHelpMedia(body: {
  topic: string;
  stepId: string;
  kind: HelpMediaKind;
  url: string;
}): Promise<{ topic: string; stepId: string; kind: HelpMediaKind | null; url: string | null; updatedAt?: string }> {
  const res = await apiClient.put("/platform/help-content/media", body);
  return res.data;
}
