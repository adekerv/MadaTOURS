import { useI18n } from '../i18n/I18nProvider';
import {
  Compass,
  ArrowUpRight,
  Utensils,
  Mountain,
  Gamepad2,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
  Heart,
  Calendar,
} from 'lucide-react';
import type { ExploreParams, Place, User } from '../types';
import { SavedPlaceCard } from './home/SavedPlaceCard';
import { SearchBar } from './home/SearchBar';
import { LanguageSelect } from './ui/LanguageSelect';
import { WeatherWidget } from './home/WeatherWidget';
interface Props {
  onPlanDay: () => void;
  onOfflineClick: () => void;
  onStart: (params?: ExploreParams) => void;
  places: Place[];
  favorites: Place[];
  revisits: Place[];
  onRemoveFavorite: (place: Place) => void;
  onRemoveRevisit: (place: Place) => void;
  user: User | null;
  sessionLoading: boolean;
  collectionsLoading: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  onAdminClick: () => void;
  onAccountClick: () => void;
}
const features = [
  {
    title: 'A taste of Martinique',
    subtitle: 'LOCAL FLAVORS',
    description: 'Explore Creole kitchens, seaside terraces, and places to share a good meal.',
    icon: Utensils,
    filter: 'restaurant',
    sortBy: 'rating',
    action: 'Find restaurants',
  },
  {
    title: 'Take the scenic route',
    subtitle: 'OUT INTO NATURE',
    description: 'Discover mountain trails, lush forests, and a different view of the island.',
    icon: Mountain,
    filter: 'activity',
    sortBy: 'hiking',
    action: 'Explore hikes',
  },
  {
    title: 'Make a day of it',
    subtitle: 'SOMETHING FOR EVERYONE',
    description: 'Find cinemas, go-karting, and activities for time with friends and family.',
    icon: Gamepad2,
    filter: 'activity',
    sortBy: 'entertainment',
    action: 'Find activities',
  },
] as const;
export function Homepage({
  onStart,
  onPlanDay,
  onOfflineClick,
  places,
  favorites,
  revisits,
  onRemoveFavorite,
  onRemoveRevisit,
  user,
  sessionLoading,
  collectionsLoading,
  onLoginClick,
  onLogout,
  onAdminClick,
  onAccountClick,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="home-shell mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 py-5">
        <a
          href="#"
          aria-label={t('MadaTours home')}
          className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-slate-900"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-orange-600 text-white">
            <Compass size={23} />
          </span>
          MADA<span className="-ml-2 font-serif italic text-orange-600">TOURS</span>
        </a>
        <nav aria-label={t('Account')} className="lg:order-2 flex items-center gap-1 sm:gap-2">
          <LanguageSelect />
          {sessionLoading ? (
            <span role="status" className="text-sm text-slate-500">
              {t('Connecting…')}
            </span>
          ) : user ? (
            <>
              {user.role === 'admin' && (
                <button
                  onClick={onAdminClick}
                  className="icon-button"
                  aria-label={t('Manage places')}
                >
                  <ShieldCheck size={21} />
                </button>
              )}
              <button
                onClick={onAccountClick}
                className="icon-button"
                aria-label={t('Your account')}
              >
                <Settings size={21} />
              </button>
              <button onClick={onLogout} className="icon-button" aria-label={t('Sign out')}>
                <LogOut size={21} />
              </button>
            </>
          ) : (
            <button onClick={onLoginClick} className="secondary-button flex items-center gap-2">
              <LogIn size={17} />
              <span>{t('Sign in')}</span>
            </button>
          )}
        </nav>
        <div className="w-full lg:order-none lg:ml-auto lg:mr-4 lg:max-w-sm">
          <SearchBar
            places={places}
            onSelectPlace={(place) => onStart({ filter: place.type, selectedPlaceId: place.id })}
          />
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="relative py-10 sm:py-16 lg:py-20 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-orange-100/40 blur-3xl"
          />
          <p className="mb-5 flex justify-center items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">
            <Compass size={16} />
            {t('Your island, your adventure')}
          </p>
          <h1 className="mx-auto max-w-4xl text-[clamp(2.5rem,7vw,5.6rem)] font-bold leading-[1.05] tracking-tight text-slate-900">
            {t('A little closer to')}
            <br />
            <span className="font-serif italic text-orange-600">Martinique.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-slate-600">
            {t(
              'Find your next favorite beach, a new trail, or a table by the sea. Explore the island at your own pace.',
            )}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onStart()}
              className="primary-button flex items-center gap-3 px-7"
            >
              {t('Explore the island')}
              <ArrowUpRight size={20} />
            </button>
            <a href="#discover" className="secondary-button flex items-center">
              {t('Find something to do')}
            </a>
          </div>
          <div className="mx-auto mt-8 max-w-xl">
            <WeatherWidget />
          </div>
        </section>
        <section
          id="discover"
          aria-labelledby="discover-title"
          className="pb-12 sm:pb-16 scroll-mt-5"
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
            <h2 id="discover-title" className="text-2xl sm:text-3xl font-bold tracking-tight">
              {t('Where will today take you?')}
            </h2>
            <span className="text-sm text-slate-500">{t('Ideas for your next outing')}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map(
              ({ title, subtitle, description, icon: Icon, filter, sortBy, action }, i) => (
                <button
                  key={t(title)}
                  onClick={() => onStart({ filter, sortBy, radius: 100 })}
                  className={`group flex min-w-0 flex-col items-start rounded-3xl border p-6 sm:p-7 text-left transition-colors ${i === 1 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200 hover:border-orange-300'}`}
                >
                  <span
                    className={`mb-6 grid size-12 place-items-center rounded-2xl ${i === 1 ? 'bg-white/10 text-orange-300' : 'bg-orange-50 text-orange-700'}`}
                  >
                    <Icon size={24} />
                  </span>
                  <span
                    className={`text-xs font-semibold tracking-widest ${i === 1 ? 'text-orange-300' : 'text-orange-700'}`}
                  >
                    {t(subtitle)}
                  </span>
                  <h3 className="mt-3 text-2xl font-bold leading-tight">{t(title)}</h3>
                  <p
                    className={`mt-3 mb-7 text-sm leading-relaxed ${i === 1 ? 'text-slate-300' : 'text-slate-600'}`}
                  >
                    {t(description)}
                  </p>
                  <span className="mt-auto flex items-center gap-2 text-sm font-semibold">
                    {t(action)}
                    <ArrowUpRight size={17} />
                  </span>
                </button>
              ),
            )}
          </div>
        </section>
        <section className="mb-10 rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
          <h2 className="text-2xl font-bold">{t('A few stops. A day to remember.')}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
            {t('Arrange your stops, add notes, and keep your plan on this device.')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="primary-button" onClick={onPlanDay}>
              {t('Plan a day')}
            </button>
            <button className="secondary-button text-slate-900" onClick={onOfflineClick}>
              {t('Open offline places')}
            </button>
          </div>
        </section>
        {user ? (
          <section
            aria-label={t('Your saved places')}
            className="space-y-12 border-t border-slate-200 py-10"
          >
            {collectionsLoading && (
              <p role="status" className="text-slate-600">
                {t('Loading your saved places…')}
              </p>
            )}
            {[
              {
                title: t('Your favorites'),
                list: favorites,
                icon: Heart,
                remove: onRemoveFavorite,
              },
              {
                title: t('Places to revisit'),
                list: revisits,
                icon: Calendar,
                remove: onRemoveRevisit,
              },
            ].map(
              ({ title, list, icon: Icon, remove }) =>
                list.length > 0 && (
                  <div key={t(title)}>
                    <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold">
                      <Icon className="text-orange-600" size={23} />
                      {t(title)}
                      <span className="text-base text-slate-500">{list.length}</span>
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map((place) => (
                        <SavedPlaceCard
                          key={place.id}
                          place={place}
                          onRemove={remove}
                          onLocate={() =>
                            onStart({ filter: place.type, selectedPlaceId: place.id })
                          }
                        />
                      ))}
                    </div>
                  </div>
                ),
            )}
            {!collectionsLoading && !favorites.length && !revisits.length && (
              <div className="rounded-3xl bg-orange-50 p-7 text-center">
                <Heart className="mx-auto mb-3 text-orange-600" />
                <h2 className="text-xl font-bold">{t('Start your island list')}</h2>
                <p className="mx-auto mt-2 max-w-md text-slate-600">
                  {t(
                    'Tap the heart on any place to save it here. Your next adventure will be easy to find.',
                  )}
                </p>
                <button onClick={() => onStart()} className="primary-button mt-5">
                  {t('Find a place')}
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="mb-10 flex flex-col items-start gap-5 rounded-3xl bg-orange-50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {t('Keep your island favorites close.')}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                {t(
                  'Explore freely. Create a free account when you want to save places or plan a return visit.',
                )}
              </p>
            </div>
            <button onClick={onLoginClick} className="primary-button shrink-0">
              {t('Create an account')}
            </button>
          </section>
        )}
      </main>
      <footer className="border-t border-slate-200 py-7 text-sm text-slate-500 flex flex-wrap justify-between gap-3">
        <span>MadaTours © {new Date().getFullYear()}</span>
        <span>{t('Made for discovering Martinique')}</span>
      </footer>
    </div>
  );
}
