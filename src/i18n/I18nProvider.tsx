import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { translate, type Language } from './core';
const key = 'madatours:language:v1';
const context = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (message: string, values?: Record<string, string | number>) => string;
}>({
  language: 'en',
  setLanguage: () => {},
  t: (message, values) => translate('en', message, values),
});
function initialLanguage(): Language {
  try {
    const value = localStorage.getItem(key);
    if (value === 'en' || value === 'fr') return value;
  } catch {
    /* Use device language when storage is unavailable. */
  }
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(initialLanguage);
  const setLanguage = useCallback((value: Language) => {
    updateLanguage(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Keep the in-memory selection. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const t = useCallback(
    (message: string, values?: Record<string, string | number>) =>
      translate(language, message, values),
    [language],
  );
  return <context.Provider value={{ language, setLanguage, t }}>{children}</context.Provider>;
}
export const useI18n = () => useContext(context);
