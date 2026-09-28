import { useState, type FormEvent } from 'react';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import copy from '../../../content/information.json';
import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSelect } from '../ui/LanguageSelect';
import { SiteFooter } from '../ui/SiteFooter';
export type InformationRoute = keyof typeof copy.en;
export const contactEmail = 'adejkervin@protonmail.com';
export function InformationPage({
  page,
  onAccount,
  signedIn,
}: {
  page: InformationRoute;
  onAccount: () => void;
  signedIn: boolean;
}) {
  const { language, t } = useI18n();
  const content = copy[language][page];
  return (
    <div className="home-shell info-page mx-auto max-w-4xl px-4 sm:px-7">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-4">
        <a href="#" className="flex items-center gap-2 font-semibold text-orange-800">
          <ArrowLeft size={20} />
          {t('Back to home')}
        </a>
        <LanguageSelect />
      </header>
      <main id="main-content" tabIndex={-1} className="py-8 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">MADATOURS</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{content.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">{content.intro}</p>
        <div className="mt-8 space-y-7">
          {content.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold">{section.title}</h2>
              <p className="mt-3 leading-relaxed text-slate-600">{section.body}</p>
            </section>
          ))}
        </div>
        {page === 'about' && (
          <>
            <section className="mt-8 rounded-3xl bg-orange-50 p-5">
              <h2 className="text-xl font-bold">{t('Photo credits')}</h2>
              <ul className="mt-3 space-y-3 text-sm">
                <li>
                  Jardin de Balata · Box-Off-Dreams, Julie ·{' '}
                  <a
                    href="https://commons.wikimedia.org/wiki/File:Jardin_de_Balata.jpg"
                    target="_blank"
                    rel="noreferrer"
                    className="text-orange-800 underline"
                  >
                    {t('Public domain')}
                  </a>
                </li>
                <li>
                  Habitation Clément · Jeremy Gross ·{' '}
                  <a
                    href="https://commons.wikimedia.org/wiki/File:Habitation_Cl%C3%A9ment.jpg"
                    target="_blank"
                    rel="noreferrer"
                    className="text-orange-800 underline"
                  >
                    {t('Photo source')}
                  </a>{' '}
                  ·{' '}
                  <a
                    href="https://creativecommons.org/licenses/by-sa/3.0/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-orange-800 underline"
                  >
                    CC BY-SA 3.0
                  </a>
                </li>
                <li>
                  Étang des Salines · Hervé NICOLAS ·{' '}
                  <a
                    href="https://commons.wikimedia.org/wiki/File:Etang_des_Salines_(Martinique).jpg"
                    target="_blank"
                    rel="noreferrer"
                    className="text-orange-800 underline"
                  >
                    {t('Photo source')}
                  </a>{' '}
                  ·{' '}
                  <a
                    href="https://creativecommons.org/licenses/by-sa/4.0/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-orange-800 underline"
                  >
                    CC BY-SA 4.0
                  </a>
                </li>
              </ul>
              <p className="mt-2 text-xs text-slate-600">{t('Displayed cropped to fit.')}</p>
            </section>
            <SuggestionForm />
          </>
        )}
        {page === 'contact' && (
          <>
            <a href={`mailto:${contactEmail}`} className="mt-5 gap-2 text-orange-800 underline">
              <Mail size={18} />
              {contactEmail}
            </a>
            <SuggestionForm />
          </>
        )}
        {page === 'delete-account' && (
          <button className="primary-button mt-6" onClick={onAccount}>
            {t(signedIn ? 'Open account settings' : 'Sign in to manage your account')}
          </button>
        )}
        {page === 'privacy' && (
          <a href="#delete-account" className="mt-5 font-semibold text-orange-800 underline">
            {t('Delete account')}
          </a>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
function SuggestionForm() {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = [
      `${t('Place name')}: ${data.get('place')}`,
      `${t('Town')}: ${data.get('town')}`,
      `${t('Source link')}: ${data.get('source')}`,
      `${t('Your suggestion')}: ${data.get('message')}`,
    ].join('\n\n');
    setDraft(
      `mailto:${contactEmail}?subject=${encodeURIComponent(t('MadaTours — place suggestion'))}&body=${encodeURIComponent(body)}`,
    );
  };
  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-bold">{t('Suggest a place')}</h2>
      <p className="mt-2 text-sm text-slate-600">
        {t(
          'Prepare a suggestion, then send it from your email app. Nothing is sent automatically.',
        )}
      </p>
      <form className="mt-5 space-y-4" onSubmit={submit} onChange={() => setDraft('')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            {t('Place name')}
            <input name="place" className="field-input" required maxLength={120} />
          </label>
          <label className="field-label">
            {t('Town')}
            <input name="town" className="field-input" required maxLength={100} />
          </label>
        </div>
        <label className="field-label">
          {t('Source link')}
          <input
            type="url"
            name="source"
            className="field-input"
            required
            maxLength={500}
            placeholder="https://"
          />
        </label>
        <label className="field-label">
          {t('Your suggestion')}
          <textarea name="message" className="field-input" rows={4} required maxLength={1500} />
        </label>
        <button className="primary-button flex items-center gap-2">
          <Send size={17} />
          {t('Prepare email suggestion')}
        </button>
        {draft && (
          <div role="status" className="rounded-2xl bg-green-50 p-4">
            <p className="text-sm text-green-900">
              {t('Your draft is ready. Send it in your email app to share it with us.')}
            </p>
            <a href={draft} className="mt-2 font-semibold text-orange-800 underline">
              {t('Open email draft')}
            </a>
          </div>
        )}
      </form>
    </section>
  );
}
