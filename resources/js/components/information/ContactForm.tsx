import { useEffect, useState, type FormEvent } from 'react';
import { Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import { useSession } from '../../lib/session';
import { useSiteSettings } from '../../lib/site';

/** The contact details an administrator set in Site content, with the built-in address as a fallback. */
export function ContactDetails({ fallbackEmail }: { fallbackEmail: string }) {
  const { t } = useI18n();
  const contact = useSiteSettings()?.contact;
  const email = contact?.email || fallbackEmail;
  const whatsapp = contact?.whatsapp?.replace(/[^0-9]/g, '');
  const row = 'flex min-h-11 items-center gap-2';
  return (
    <ul className="mt-5 space-y-1 text-slate-700">
      <li>
        <a href={`mailto:${email}`} className={`${row} text-orange-800 underline`}>
          <Mail size={18} aria-hidden />
          {email}
        </a>
      </li>
      {contact?.phone && (
        <li>
          <a href={`tel:${contact.phone.replace(/[^+0-9]/g, '')}`} className={`${row} underline`}>
            <Phone size={18} aria-hidden />
            {contact.phone}
          </a>
        </li>
      )}
      {whatsapp && (
        <li>
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className={`${row} underline`}
          >
            <MessageCircle size={18} aria-hidden />
            {t('WhatsApp')} · {contact?.whatsapp}
          </a>
        </li>
      )}
      {contact?.address && (
        <li className={row}>
          <MapPin size={18} aria-hidden />
          {contact.address}
        </li>
      )}
    </ul>
  );
}

/** Sends a message to the team's inbox in the admin dashboard. Signed-in people have their details filled in. */
export function ContactForm() {
  const { t } = useI18n();
  const { user } = useSession();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user)
      setForm((previous) => ({
        ...previous,
        name: previous.name || user.name,
        email: previous.email || user.email,
      }));
  }, [user]);
  const update = (field: keyof typeof form, next: string) =>
    setForm((previous) => ({ ...previous, [field]: next }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/contact', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSent(true);
      setForm((previous) => ({ ...previous, subject: '', message: '' }));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-bold">{t('Send us a message')}</h2>
      <p className="mt-2 text-sm text-slate-600">
        {t('We read every message and answer by email, usually within a few days.')}
      </p>
      {sent ? (
        <div role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">{t('Thank you, your message has been sent.')}</p>
          <button
            type="button"
            className="mt-2 min-h-11 font-semibold underline"
            onClick={() => setSent(false)}
          >
            {t('Send another message')}
          </button>
        </div>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              {t('Your name')}
              <input
                required
                maxLength={80}
                autoComplete="name"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                className="field-input"
              />
            </label>
            <label className="field-label">
              {t('Email')}
              <input
                required
                type="email"
                maxLength={254}
                autoComplete="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                className="field-input"
              />
            </label>
          </div>
          <label className="field-label">
            {t('Subject')}
            <input
              required
              minLength={3}
              maxLength={120}
              value={form.subject}
              onChange={(event) => update('subject', event.target.value)}
              className="field-input"
            />
          </label>
          <label className="field-label">
            {t('Message')}
            <textarea
              required
              minLength={10}
              maxLength={4000}
              rows={5}
              value={form.message}
              onChange={(event) => update('message', event.target.value)}
              className="field-input"
            />
          </label>
          {/* Hidden from people; robots that fill every field give themselves away. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={form.website}
            onChange={(event) => update('website', event.target.value)}
            className="hidden"
          />
          {error && (
            <p role="alert" className="error-message">
              {t(error)}
            </p>
          )}
          <button disabled={busy} className="primary-button flex items-center gap-2">
            <Send size={17} aria-hidden />
            {busy ? t('Sending…') : t('Send message')}
          </button>
        </form>
      )}
    </section>
  );
}
