import en from "./locales/en";
import bo from "./locales/bo";

export type Language = "en" | "bo";

export const languages: Language[] = ["en", "bo"];

export const defaultLanguage: Language = "en";

export const languageLabels: Record<Language, string> = {
  en: "English",
  bo: "Burmese",
};

export type Translations = Record<string, string>;

export const translations: Record<Language, Translations> = {
  en,
  bo,
};

export function translate(
  key: string,
  language: Language,
  params?: Record<string, string | number>,
) {
  const message = translations[language][key] ?? translations.en[key] ?? key;
  if (!params) return message;
  return Object.entries(params).reduce(
    (text, [paramKey, value]) =>
      text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value)),
    message,
  );
}

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "bo";
}
