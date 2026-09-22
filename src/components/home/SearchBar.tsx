import { useState, useRef, useEffect, useId, type KeyboardEvent } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import type { Place } from '../../types';
import { matchesSearch } from '../../lib/places-utils';
export function SearchBar({
  places,
  onSelectPlace,
}: {
  places: Place[];
  onSelectPlace: (place: Place) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
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
          aria-label="Search places"
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
          placeholder="Search places, towns, activities…"
          className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
        />
        {query && (
          <button
            aria-label="Clear search"
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
      {expanded && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Matching places"
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
            <p role="status" className="p-5 text-sm text-slate-600">
              No places found. Try a town name or activity.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
