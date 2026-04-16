export const getLocale = (lang?: string) => {
  if (lang === "en") return "en-US";
  if (lang === "tr") return "tr-TR";
  return "ru-RU";
};
