import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const STORAGE_KEY = "lumiva_lang";
type Lang = "ru" | "en" | "tr";

const savedLang =
  typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
const initialLang: Lang = savedLang === "en" || savedLang === "tr" ? savedLang : "ru";

/**
 * Переводы грузятся отдельными файлами и только нужные: раньше все три языка (~3 МБ) были
 * вшиты в основной бандл и разбирались при каждой загрузке сайта. Цепочка запасных языков
 * та же, что в fallbackLng: tr → en → ru, en → ru.
 */
const loaders: Record<Lang, () => Promise<{ default: Record<string, unknown> }>> = {
  ru: () => import("./locales/ru/translation.json"),
  en: () => import("./locales/en/translation.json"),
  tr: () => import("./locales/tr/translation.json"),
};
const CHAIN: Record<Lang, Lang[]> = { ru: ["ru"], en: ["en", "ru"], tr: ["tr", "en", "ru"] };

i18n.use(initReactI18next).init({
  resources: {},
  partialBundledLanguages: true,
  lng: initialLang,
  /** tr: prefer English for missing keys, then Russian; en: then Russian */
  fallbackLng: {
    tr: ["en", "ru"],
    en: ["ru"],
    ru: [],
    default: ["ru"],
  },
  interpolation: {
    escapeValue: false,
  },
});

/** Догрузить язык и его запасные языки (однократно). */
export async function ensureLanguageLoaded(lang: Lang): Promise<void> {
  await Promise.all(
    CHAIN[lang].map(async (l) => {
      if (i18n.hasResourceBundle(l, "translation")) return;
      const mod = await loaders[l]();
      i18n.addResourceBundle(l, "translation", mod.default, true, true);
    }),
  );
}

/** Отрисовка приложения ждёт этот промис, чтобы не показать ключи вместо текста. */
export const i18nReady: Promise<void> = ensureLanguageLoaded(initialLang)
  .then(() => {
    // addResourceBundle после init — переподтверждаем язык, чтобы подписчики перечитали тексты.
    return i18n.changeLanguage(initialLang).then(() => undefined);
  })
  .catch((e) => {
    console.error("Cannot load translations", e);
  });

export const setAppLanguage = async (lang: Lang) => {
  await ensureLanguageLoaded(lang).catch(() => {});
  await i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, lang);
  }
};

export default i18n;
