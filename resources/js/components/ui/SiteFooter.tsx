import { useI18n } from '../../i18n/I18nProvider';
import { useSiteSettings } from '../../lib/site';

const socialNames = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};
/**
 * Account links appear only for a signed-in visitor. Deleting an account lives in Account settings; the public
 * "Delete your account" page stays reachable at its address (app stores ask for one) and from the Privacy page.
 */
export function SiteFooter({
  onSignup,
  signedIn = false,
}: {
  onSignup?: () => void;
  signedIn?: boolean;
}) {
  const { t } = useI18n();
  const social = useSiteSettings()?.social;
  const socialLinks = social
    ? (Object.keys(socialNames) as (keyof typeof socialNames)[]).filter((key) => social[key])
    : [];
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
            ...(signedIn ? [['account', 'My account']] : []),
          ].map(([page, label]) => (
            <a key={page} href={`#${page}`} className="inline-flex min-h-11 items-center underline">
              {t(label)}
            </a>
          ))}
        </nav>
      </div>
      {socialLinks.length > 0 && (
        <nav aria-label={t('Follow MadaTours')} className="mt-4 flex flex-wrap gap-x-5">
          {socialLinks.map((key) => (
            <a
              key={key}
              href={social![key]!}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center font-semibold text-orange-800 underline"
            >
              {socialNames[key]}
            </a>
          ))}
        </nav>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-x-3">
        <span>{t('Weather, map and route data:')}</span>
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
        <span aria-hidden="true">·</span>
        <a
          className="inline-flex min-h-11 items-center underline"
          href="https://openrouteservice.org/"
          target="_blank"
          rel="noreferrer"
        >
          openrouteservice
        </a>
        <span aria-hidden="true">·</span>
        <a className="inline-flex min-h-11 items-center underline" href="#about">
          {t('Photo credits')}
        </a>
      </div>
    </footer>
  );
}
