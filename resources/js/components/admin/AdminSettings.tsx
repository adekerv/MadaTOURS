import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ImageUp, Megaphone } from 'lucide-react';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import { preparePhoto } from '../../lib/upload-photo';
import { setSiteSettings, siteSettingsSchema, type SiteSettings } from '../../lib/site';
import { useToast } from '../ui/Toast';
import { ListSkeleton, LoadError, SectionHeader, useDateFormat } from './AdminKit';

type Form = {
  hero: Record<'title' | 'titleFr' | 'subtitle' | 'subtitleFr' | 'image', string>;
  contact: Record<'email' | 'phone' | 'whatsapp' | 'address', string>;
  social: Record<'instagram' | 'facebook' | 'tiktok' | 'youtube', string>;
  announcement: {
    enabled: boolean;
    text: string;
    textFr: string;
    link: string;
    tone: 'info' | 'warning' | 'success';
  };
};
const toForm = (settings: SiteSettings): Form => {
  const blank = <T extends Record<string, string | null>>(group: T) =>
    Object.fromEntries(Object.entries(group).map(([key, value]) => [key, value ?? ''])) as Record<
      keyof T,
      string
    >;
  return {
    hero: blank(settings.hero),
    contact: blank(settings.contact),
    social: blank(settings.social),
    announcement: {
      enabled: settings.announcement.enabled,
      text: settings.announcement.text ?? '',
      textFr: settings.announcement.textFr ?? '',
      link: settings.announcement.link ?? '',
      tone: settings.announcement.tone,
    },
  };
};

/** Photo preparation explains its own problems; anything else is a connection or server error. */
export const photoError = (failure: unknown) =>
  failure instanceof Error && !(failure instanceof ApiError) && !(failure instanceof TypeError)
    ? failure.message
    : errorMessage(failure);

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Homepage hero, contact details, social links and the announcement banner. Empty fields keep the built-in wording. */
export function AdminSettings() {
  const { t } = useI18n();
  const toast = useToast();
  const date = useDateFormat();
  const [form, setForm] = useState<Form | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api<unknown>('/site', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const parsed = siteSettingsSchema.parse(data);
        setForm(toForm(parsed));
        setUpdatedAt(parsed.updatedAt ?? null);
      })
      .catch((failure) => !controller.signal.aborted && setError(errorMessage(failure)));
    return () => controller.abort();
  }, [revision]);
  const set = <G extends keyof Form>(
    group: G,
    field: keyof Form[G],
    value: Form[G][keyof Form[G]],
  ) =>
    setForm((previous) =>
      previous ? { ...previous, [group]: { ...previous[group], [field]: value } } : previous,
    );
  const field = <G extends 'hero' | 'contact' | 'social'>(
    group: G,
    name: keyof Form[G] & string,
    label: string,
    options: {
      type?: string;
      max?: number;
      placeholder?: string;
      wide?: boolean;
      multiline?: boolean;
    } = {},
  ) => (
    <label className={`field-label ${options.wide ? 'sm:col-span-2' : ''}`}>
      {label}
      {options.multiline ? (
        <textarea
          rows={2}
          maxLength={options.max}
          value={form![group][name] as string}
          onChange={(event) => set(group, name, event.target.value as Form[G][keyof Form[G]])}
          className="field-input"
        />
      ) : (
        <input
          type={options.type ?? 'text'}
          maxLength={options.max}
          placeholder={options.placeholder}
          value={form![group][name] as string}
          onChange={(event) => set(group, name, event.target.value as Form[G][keyof Form[G]])}
          className="field-input"
        />
      )}
    </label>
  );
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const photo = await preparePhoto(file);
      const { url } = await api<{ url: string }>('/admin/images', {
        method: 'POST',
        body: JSON.stringify({ photo, kind: 'hero' }),
      });
      set('hero', 'image', url);
      toast('Image uploaded. Save to show it on the homepage.');
    } catch (failure) {
      toast(photoError(failure), 'error');
    } finally {
      setUploading(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setSaveError('');
    try {
      const saved = siteSettingsSchema.parse(
        await api<unknown>('/admin/site-settings', { method: 'POST', body: JSON.stringify(form) }),
      );
      setSiteSettings(saved);
      setForm(toForm(saved));
      setUpdatedAt(saved.updatedAt ?? null);
      toast('Site content saved. Visitors see it straight away.');
    } catch (failure) {
      setSaveError(errorMessage(failure));
      toast(errorMessage(failure), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionHeader
        title={t('Site content')}
        description={t(
          'Change the homepage, contact details, social links and announcement without touching code. Empty fields keep the built-in wording.',
        )}
      />
      {error && <LoadError error={error} onRetry={() => setRevision((value) => value + 1)} />}
      {!form && !error && <ListSkeleton rows={4} />}
      {form && (
        <form onSubmit={save} className="space-y-5">
          <Group
            title={t('Homepage hero')}
            description={t(
              'The big title and text at the top of the homepage. French fields are optional: without them French visitors see the English text.',
            )}
          >
            {field('hero', 'title', t('Title'), { max: 120 })}
            {field('hero', 'titleFr', t('Title in French'), { max: 120 })}
            {field('hero', 'subtitle', t('Text under the title'), { max: 300, multiline: true })}
            {field('hero', 'subtitleFr', t('Text under the title, in French'), {
              max: 300,
              multiline: true,
            })}
            <div className="space-y-2 sm:col-span-2">
              {field('hero', 'image', t('Image address (optional)'), {
                type: 'url',
                max: 2000,
                placeholder: 'https://…',
                wide: true,
              })}
              <div className="flex flex-wrap items-center gap-3">
                <label className="secondary-button inline-flex cursor-pointer items-center gap-2">
                  <ImageUp size={17} aria-hidden />
                  {uploading ? t('Uploading…') : t('Upload an image')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(event) => void upload(event.target.files?.[0])}
                  />
                </label>
                {form.hero.image && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => set('hero', 'image', '')}
                  >
                    {t('Remove the image')}
                  </button>
                )}
              </div>
              {form.hero.image && (
                <img
                  src={form.hero.image}
                  alt={t('Hero image preview')}
                  className="h-40 w-full max-w-md rounded-2xl object-cover"
                />
              )}
            </div>
          </Group>
          <Group
            title={t('Contact details')}
            description={t(
              'Shown on the contact page. Messages sent with the contact form arrive in Messages, not by email.',
            )}
          >
            {field('contact', 'email', t('Email'), { type: 'email', max: 254 })}
            {field('contact', 'phone', t('Phone'), {
              type: 'tel',
              max: 30,
              placeholder: '+596 696 00 00 00',
            })}
            {field('contact', 'whatsapp', t('WhatsApp number'), {
              type: 'tel',
              max: 30,
              placeholder: '+596 696 00 00 00',
            })}
            {field('contact', 'address', t('Address'), { max: 300 })}
          </Group>
          <Group
            title={t('Social links')}
            description={t(
              'Full addresses starting with https://. Shown in the footer of every page.',
            )}
          >
            {field('social', 'instagram', 'Instagram', {
              type: 'url',
              max: 300,
              placeholder: 'https://instagram.com/…',
            })}
            {field('social', 'facebook', 'Facebook', {
              type: 'url',
              max: 300,
              placeholder: 'https://facebook.com/…',
            })}
            {field('social', 'tiktok', 'TikTok', {
              type: 'url',
              max: 300,
              placeholder: 'https://tiktok.com/@…',
            })}
            {field('social', 'youtube', 'YouTube', {
              type: 'url',
              max: 300,
              placeholder: 'https://youtube.com/@…',
            })}
          </Group>
          <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Megaphone size={20} aria-hidden className="text-orange-700" />
              {t('Announcement banner')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('A short message at the top of every page, for closures, events or news.')}
            </p>
            <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="size-5"
                checked={form.announcement.enabled}
                onChange={(event) => set('announcement', 'enabled', event.target.checked)}
              />
              {t('Show the announcement')}
            </label>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                {t('Message')}
                <input
                  maxLength={200}
                  required={form.announcement.enabled}
                  value={form.announcement.text}
                  onChange={(event) => set('announcement', 'text', event.target.value)}
                  className="field-input"
                />
              </label>
              <label className="field-label">
                {t('Message in French')}
                <input
                  maxLength={200}
                  value={form.announcement.textFr}
                  onChange={(event) => set('announcement', 'textFr', event.target.value)}
                  className="field-input"
                />
              </label>
              <label className="field-label">
                {t('Link (optional)')}
                <input
                  maxLength={300}
                  placeholder="https://… or #contact"
                  value={form.announcement.link}
                  onChange={(event) => set('announcement', 'link', event.target.value)}
                  className="field-input"
                />
              </label>
              <label className="field-label">
                {t('Style')}
                <select
                  value={form.announcement.tone}
                  onChange={(event) =>
                    set('announcement', 'tone', event.target.value as Form['announcement']['tone'])
                  }
                  className="field-input"
                >
                  <option value="info">{t('Information')}</option>
                  <option value="warning">{t('Warning')}</option>
                  <option value="success">{t('Good news')}</option>
                </select>
              </label>
            </div>
          </section>
          {saveError && (
            <p role="alert" className="error-message">
              {t(saveError)}
            </p>
          )}
          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border">
            <span className="text-sm text-slate-600">
              {updatedAt ? t('Last saved {date}', { date: date(updatedAt) }) : t('Not saved yet')}
            </span>
            <button disabled={busy || uploading} className="primary-button">
              {busy ? t('Saving…') : t('Save site content')}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
