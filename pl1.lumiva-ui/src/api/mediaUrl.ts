// src/api/mediaUrl.ts — товары/отели хранят обложки/галерею как относительные пути
// ("/v1/uploads/...") — на самом CRM-домене (crm.lumiva.agency) nginx отдаёт их напрямую, но
// здесь, на pl1.lumiva.agency, такого проксирования нет, поэтому относительный путь нужно
// достраивать до полного URL бэкенда (тот же хост, что и VITE_PLATFORM_API_URL).
const apiBaseURL =
  import.meta.env.VITE_PLATFORM_API_URL?.trim() ||
  "https://crm.lumiva.agency/v1";

const apiOrigin = (() => {
  try {
    return new URL(apiBaseURL).origin;
  } catch {
    return "https://crm.lumiva.agency";
  }
})();

export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiOrigin}${url.startsWith("/") ? "" : "/"}${url}`;
}
