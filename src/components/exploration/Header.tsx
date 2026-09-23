import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSelect } from '../ui/LanguageSelect';
import { ArrowLeft, LocateFixed } from 'lucide-react';
import type { UserLocation } from '../../types';
export function Header({
  onBack,
  userLocation,
  onGetLocation,
}: {
  onBack: () => void;
  userLocation: UserLocation | null;
  onGetLocation: () => void;
}) {
  const { t } = useI18n();
  return (
    <header className="explore-header flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="icon-button" aria-label={t('Back to home')}>
          <ArrowLeft size={21} />
        </button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">{t('Explore Martinique')}</h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            {t('Find your next favorite place')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LanguageSelect />
        <button
          onClick={onGetLocation}
          className="secondary-button flex shrink-0 items-center gap-2"
          aria-label={t('Choose search location')}
        >
          <LocateFixed size={18} />
          <span className="hidden sm:inline">
            {userLocation?.manual ? t('Search location') : t('Your location')}
          </span>
        </button>
      </div>
    </header>
  );
}
