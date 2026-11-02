import i18next from "i18next";

/** Без аргумента — текущий язык интерфейса (раньше молча отдавал ru-RU, и на EN/TR суммы шли с «тыс./млн»). */
export const getLocale = (lang: string | undefined = i18next.language) => {
  const l = (lang || "").slice(0, 2);
  if (l === "en") return "en-US";
  if (l === "tr") return "tr-TR";
  return "ru-RU";
};
