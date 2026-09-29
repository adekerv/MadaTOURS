import { useI18n } from '../../i18n/I18nProvider';
import { Search, RotateCcw, ShieldCheck } from 'lucide-react';
import type { Place, User } from '../../types';
import { PlaceCard } from './PlaceCard';
import { useEffect, useState } from 'react';
import { experiences } from '../../lib/catalogue';
import { PlaceCardSkeleton } from '../ui/PlacePhoto';
import { recentSearches, rememberSearch, clearSearches } from '../../lib/local-preferences';
interface Props {
  minRating: number;
  setMinRating: (value: number) => void;
  filter: 'all' | 'restaurant' | 'activity';
  setFilter: (filter: 'all' | 'restaurant' | 'activity') => void;
  radius: number;
  setRadius: (radius: number) => void;
  loading: boolean;
  filteredPlaces: Place[];
  selectedPlace: Place | null;
  onPlaceSelect: (place: Place) => void;
  onShowDetails: (place: Place) => void;
  isFavorite: (id: number) => boolean;
  onResetRadar: () => void;
  sortBy: 'default' | 'rating' | 'hiking' | 'entertainment';
  setSortBy: (sortBy: Props['sortBy']) => void;
  query: string;
  setQuery: (query: string) => void;
  user: User | null;
  onAdminClick: () => void;
  manual: boolean;
  towns: string[];
  town: string;
  setTown: (town: string) => void;
  experience: string;
  setExperience: (experience: string) => void;
}
export function Sidebar(props: Props) {
  const { t } = useI18n();
  const [visibleCount, setVisibleCount] = useState(30);
  const [history, setHistory] = useState(recentSearches);
  useEffect(() => setVisibleCount(30), [props.filteredPlaces]);
  const {
    filter,
    setFilter,
    radius,
    setRadius,
    loading,
    filteredPlaces,
    selectedPlace,
    onPlaceSelect,
    onShowDetails,
    isFavorite,
    onResetRadar,
    sortBy,
    setSortBy,
    query,
    setQuery,
    user,
    onAdminClick,
    manual,
  } = props;
  return (
    <aside
      aria-label={t('Places and filters')}
      className="h-full overflow-y-auto overscroll-contain bg-white p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{t('Discover places')}</h2>
        {user?.role === 'admin' && (
          <button onClick={onAdminClick} aria-label={t('Manage places')} className="icon-button">
            <ShieldCheck size={20} />
          </button>
        )}
      </div>
      <label className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
        <Search size={18} className="text-slate-500" />
        <input
          aria-label={t('Filter places')}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => setHistory(rememberSearch(query))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setHistory(rememberSearch(query));
          }}
          placeholder={t('Search this area')}
          className="w-full min-w-0 py-3 outline-none"
        />
      </label>
      {!query && history.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600">{t('Recent searches')}</p>
            <button
              className="px-2 text-xs text-orange-800 underline"
              onClick={() => {
                clearSearches();
                setHistory([]);
              }}
            >
              {t('Clear history')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((term) => (
              <button
                key={term}
                className="secondary-button max-w-full break-words"
                onClick={() => setQuery(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="field-label">
          {t('Town')}
          <select
            aria-label={t('Town')}
            className="field-input"
            value={props.town}
            onChange={(event) => props.setTown(event.target.value)}
          >
            <option value="">{t('All towns')}</option>
            {props.towns.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          {t('Experience')}
          <select
            aria-label={t('Experience')}
            className="field-input"
            value={props.experience}
            onChange={(event) => props.setExperience(event.target.value)}
          >
            <option value="">{t('All experiences')}</option>
            {experiences.map((item) => (
              <option key={item.id} value={item.id}>
                {t(item.label)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div aria-label={t('Place category')} className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {(['all', 'restaurant', 'activity'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`min-w-0 flex-1 rounded-lg px-1 text-sm font-semibold ${filter === value ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-600'}`}
          >
            {value === 'all' ? t('All') : value === 'restaurant' ? t('Food') : t('Activities')}
          </button>
        ))}
      </div>
      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-semibold">{t('Minimum community rating')}</legend>
        <div className="flex flex-wrap gap-2">
          {[0, 3, 4, 4.5].map((value) => (
            <button
              key={value}
              aria-pressed={props.minRating === value}
              onClick={() => props.setMinRating(value)}
              className={props.minRating === value ? 'primary-button' : 'secondary-button'}
            >
              {value ? `${value} ★ +` : t('Any rating')}
            </button>
          ))}
        </div>
      </fieldset>
      <details className="mb-4 rounded-xl bg-slate-50 p-3">
        <summary className="cursor-pointer py-1 text-sm font-semibold text-slate-700">
          {t('Distance and sorting')} · {radius} km
        </summary>
        <div className="mt-3">
          <label className="field-label mb-3">
            <span className="flex justify-between gap-2">
              <span>{t('Search radius')}</span>
              <span className="text-orange-700">{radius} km</span>
            </span>
            <input
              aria-label={t('Search radius')}
              type="range"
              min="1"
              max="100"
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="w-full accent-orange-600"
            />
          </label>
          <label className="field-label mb-4">
            {t('Show')}
            <select
              aria-label={t('Sort and interest')}
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as Props['sortBy'])}
              className="field-input"
            >
              <option value="default">{t('Closest to search center')}</option>
              <option value="rating">{t('Highest guide rating')}</option>
              <option value="hiking">{t('Hiking and nature trails')}</option>
              <option value="entertainment">{t('Entertainment')}</option>
            </select>
          </label>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">
            {t('Distances are straight-line estimates from')}{' '}
            {manual ? t('your chosen search center') : t('your device location')}.
          </p>
        </div>
      </details>
      <p role="status" className="mb-3 text-sm font-semibold text-slate-700">
        {loading
          ? t('Updating places…')
          : t(filteredPlaces.length === 1 ? '1 place found' : '{count} places found', {
              count: filteredPlaces.length,
            })}
      </p>
      <div className="place-results space-y-3">
        {loading && !filteredPlaces.length ? (
          <>
            <PlaceCardSkeleton />
            <PlaceCardSkeleton />
          </>
        ) : filteredPlaces.length ? (
          filteredPlaces
            .slice(0, visibleCount)
            .map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                isSelected={selectedPlace?.id === place.id}
                isFavorite={isFavorite(place.id)}
                onSelect={onPlaceSelect}
                onShowDetails={onShowDetails}
              />
            ))
        ) : (
          <div className="rounded-2xl bg-slate-50 p-5">
            <h3 className="font-semibold">{t('No places in this area')}</h3>
            <p className="my-3 text-sm text-slate-600">
              {t(
                'Try a wider radius or a different filter. If you are outside Martinique, browse the island instead.',
              )}
            </p>
            <button className="secondary-button w-full" onClick={onResetRadar}>
              {t('Browse all Martinique')}
            </button>
          </div>
        )}
      </div>
      {visibleCount < filteredPlaces.length && (
        <button
          className="secondary-button mt-4 w-full"
          onClick={() => setVisibleCount((count) => count + 30)}
        >
          {t('Show more places ({remaining} remaining)', {
            remaining: filteredPlaces.length - visibleCount,
          })}
        </button>
      )}
      <button
        onClick={onResetRadar}
        className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-semibold text-slate-600"
      >
        <RotateCcw size={15} />
        {t('Reset filters')}
      </button>
    </aside>
  );
}
