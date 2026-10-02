import { useI18n } from '../../i18n/I18nProvider';
import { useState, useRef, useEffect, useId, type KeyboardEvent } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import type { Place } from '../../types';
import { matchesSearch } from '../../lib/places-utils';
import { recentSearches, rememberSearch, clearSearches } from '../../lib/local-preferences';
import { exploreHash } from '../../lib/explore-route';
export function SearchBar({
  places,
  onSelectPlace,
}: {
  places: Place[];
  onSelectPlace: (place: Place) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [history, setHistory] = useState(recentSearches);
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const filtered = query.trim()
    ? places.filter((place) => matchesSearch(place, query)).slice(0, 8)
    : [];
  const expanded = open && !!query.trim();
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useEffect(() => {
    if (active >= 0)
      document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, id]);
  function select(place: Place) {
    setHistory(rememberSearch(query || place.name));
    onSelectPlace(place);
    setOpen(false);
    setQuery('');
    setActive(-1);
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((index) =>
        Math.max(0, Math.min(filtered.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
      );
    }
    if (event.key === 'Enter' && expanded && filtered[active]) {
      event.preventDefault();
      select(filtered[active]);
    } else if (event.key === 'Enter' && query.trim()) {
      // Typing then pressing Enter or Go (common on phones) shows every match in Explore.
      event.preventDefault();
      setHistory(rememberSearch(query));
      setOpen(false);
      location.hash = exploreHash({
        filter: 'all',
        radius: 100,
        query: query.trim().slice(0, 100),
      });
    }
  }
  return (
    <div
      ref={ref}
      className="relative w-full text-left"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 focus-within:border-orange-600">
        <Search size={19} className="shrink-0 text-slate-500" />
        <input
          ref={input}
          role="combobox"
          aria-label={t('Search places')}
          aria-expanded={expanded}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? `${id}-${active}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('Search places, towns, activities…')}
          className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
        />
        {query && (
          <button
            aria-label={t('Clear search')}
            className="icon-button"
            onClick={() => {
              setQuery('');
              setOpen(false);
              input.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>
      {open && !query.trim() && history.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t('Recent searches')}</p>
            <button
              className="px-2 text-sm text-orange-800 underline"
              onClick={() => {
                clearSearches();
                setHistory([]);
              }}
            >
              {t('Clear history')}
            </button>
          </div>
          {history.map((term) => (
            <button
              key={term}
              className="block min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-orange-50"
              onClick={() => {
                setQuery(term);
                setActive(-1);
                input.current?.focus();
              }}
            >
              {term}
            </button>
          ))}
        </div>
      )}
      {expanded && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={t('Matching places')}
            className="max-h-[min(50dvh,24rem)] overflow-y-auto"
          >
            {filtered.map((place, index) => (
              <li
                key={place.id}
                id={`${id}-${index}`}
                role="option"
                aria-selected={active === index}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => select(place)}
                className={`cursor-pointer px-4 py-3 ${active === index ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
              >
                <span className="block font-semibold text-slate-900">{place.name}</span>
                <span className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                  <MapPin size={12} />
                  {place.location}
                </span>
              </li>
            ))}
          </ul>
          {!filtered.length && (
            <div className="p-5">
              <Search aria-hidden="true" className="mb-2 text-orange-700" />
              <p role="status" className="text-sm text-slate-600">
                {t('No places found. Try a town name or activity.')}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {t('Try a shorter name, remove accents, or explore these ideas.')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Sainte-Anne', 'Fort-de-France', 'Balata'].map((term) => (
                  <button
                    key={term}
                    className="secondary-button"
                    onClick={() => {
                      setQuery(term);
                      input.current?.focus();
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
