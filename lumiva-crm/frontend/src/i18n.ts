import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "./locales/ru/translation.json";
import en from "./locales/en/translation.json";
import tr from "./locales/tr/translation.json";

const STORAGE_KEY = "lumiva_lang";
const savedLang =
  typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    tr: { translation: tr },
  },
  lng: savedLang || "ru",
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

export const setAppLanguage = (lang: "ru" | "en" | "tr") => {
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, lang);
  }
};

export default i18n;
