import { useI18n } from '../../i18n/I18nProvider';
export function SiteFooter({ onSignup }: { onSignup?: () => void }) {
  const { t } = useI18n();
  return (
    <footer className="site-footer mt-8 border-t border-slate-200 py-7 text-sm text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="font-semibold text-slate-900">MadaTours © {new Date().getFullYear()}</p>
          <p className="mt-2 max-w-sm">
            {t('Discover freely. An account keeps your favorites with you across devices.')}
          </p>
          {onSignup && (
            <button onClick={onSignup} className="mt-2 font-semibold text-orange-800 underline">
              {t('Create an account')}
            </button>
          )}
        </div>
        <nav aria-label={t('Information')} className="flex max-w-md flex-wrap gap-x-5 gap-y-1">
          {[
            ['about', 'About'],
            ['contact', 'Contact'],
            ['privacy', 'Privacy Policy'],
            ['terms', 'Terms'],
            ['settings', 'Account settings'],
            ['delete-account', 'Delete account'],
          ].map(([page, label]) => (
            <a key={page} href={`#${page}`} className="inline-flex min-h-11 items-center underline">
              {t(label)}
            </a>
          ))}
        </nav>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-3">
        <span>{t('Weather and map data:')}</span>
        <a
          className="inline-flex min-h-11 items-center underline"
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
        >
          Open-Meteo
        </a>
        <span aria-hidden="true">·</span>
        <a
          className="inline-flex min-h-11 items-center underline"
          href="https://openfreemap.org/"
          target="_blank"
          rel="noreferrer"
        >
          OpenFreeMap
        </a>
        <span aria-hidden="true">·</span>
        <a
          className="inline-flex min-h-11 items-center underline"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
        <a className="inline-flex min-h-11 items-center underline" href="#about">
          {t('Photo credits')}
        </a>
      </div>
    </footer>
  );
}
