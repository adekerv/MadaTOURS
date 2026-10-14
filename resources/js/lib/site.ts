import { useEffect, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { api } from './api';
import type { Language } from '../i18n/core';

const text = z.string().nullable().catch(null);
export const siteSettingsSchema = z.object({
  hero: z.object({
    title: text,
    titleFr: text,
    subtitle: text,
    subtitleFr: text,
    image: text,
  }),
  contact: z.object({ email: text, phone: text, whatsapp: text, address: text }),
  social: z.object({ instagram: text, facebook: text, tiktok: text, youtube: text }),
  announcement: z.object({
    enabled: z.boolean().catch(false),
    text,
    textFr: text,
    link: text,
    tone: z.enum(['info', 'warning', 'success']).catch('info'),
  }),
  updatedAt: z.string().nullable().optional(),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

/**
 * Site content administrators edit (hero, contact details, social links, announcement). Loaded once per visit and
 * shared by every component; until it arrives, or when it cannot load, pages show their built-in wording.
 */
let current: SiteSettings | null = null;
let requested = false;
const listeners = new Set<() => void>();
const publish = (value: SiteSettings | null) => {
  current = value;
  listeners.forEach((listener) => listener());
};

export function setSiteSettings(value: SiteSettings) {
  publish(value);
}

export function useSiteSettings(): SiteSettings | null {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
  useEffect(() => {
    if (requested) return;
    requested = true;
    api<unknown>('/site')
      .then((data) => {
        const parsed = siteSettingsSchema.safeParse(data);
        if (parsed.success) publish(parsed.data);
      })
      .catch(() => {
        // Built-in wording stays; the next visit tries again.
        requested = false;
      });
  }, []);
  return value;
}

/** The French text when the page is in French and one was written, otherwise the English one. */
export const localized = (language: Language, english: string | null, french: string | null) =>
  (language === 'fr' && french) || english;
