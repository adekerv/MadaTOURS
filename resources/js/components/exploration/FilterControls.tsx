import { useI18n } from '../../i18n/I18nProvider';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { experiences } from '../../lib/catalogue';
import { recentSearches, rememberSearch, clearSearches } from '../../lib/local-preferences';
export interface FilterProps {
  minRating: number;
  setMinRating: (value: number) => void;
  filter: 'all' | 'restaurant' | 'activity';
  setFilter: (filter: 'all' | 'restaurant' | 'activity') => void;
  radius: number;
  setRadius: (radius: number) => void;
  sortBy: 'default' | 'rating' | 'hiking' | 'entertainment';
  setSortBy: (sortBy: FilterProps['sortBy']) => void;
  query: string;
  setQuery: (query: string) => void;
  manual: boolean;
  towns: string[];
  town: string;
  setTown: (town: string) => void;
  experience: string;
  setExperience: (experience: string) => void;
}
/** Search and filter fields shared by the desktop sidebar and the mobile map sheet. */
export function FilterControls(props: FilterProps) {
  const { t } = useI18n();
  const [history, setHistory] = useState(recentSearches);
  const { filter, setFilter, radius, setRadius, sortBy, setSortBy, query, setQuery, manual } =
    props;
  return (
    <>
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
              onChange={(event) => setSortBy(event.target.value as FilterProps['sortBy'])}
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
    </>
  );
}
