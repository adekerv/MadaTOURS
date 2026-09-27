import { french } from './fr';
export type Language = 'en' | 'fr';
export function translate(
  language: Language,
  message: string,
  values: Record<string, string | number> = {},
) {
  const text = language === 'fr' ? (french[message] ?? message) : message;
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}
