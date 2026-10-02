import { useI18n } from '../../i18n/I18nProvider';
import { useEffect, useRef } from 'react';
import { Heart, X, ArrowUpRight, Star } from 'lucide-react';
import type { Place, User } from '../../types';
import { PlacePhoto } from '../ui/PlacePhoto';
import { getPlaceTheme } from '../../utils/emoji';
interface Props {
  places: Place[];
  selectedId: number;
  onSelect: (place: Place) => void;
  onClose: () => void;
  isFavorite: (id: number) => boolean;
  onToggleFavorite: (place: Place) => void;
  onShowDetails: () => void;
  mapsUrl: (place: Place) => string;
  user: User | null;
  onLoginClick: () => void;
}
/** A swipeable row along the map: the chosen place in full, its neighbours as compact cards. */
export function PlaceCarousel({ places, selectedId, ...actions }: Props) {
  const { t, language } = useI18n();
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const card = row.current?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!card) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ block: 'nearest', inline: 'center', behavior: calm ? 'auto' : 'smooth' });
  }, [selectedId]);
  return (
    <section aria-label={t('Nearby places')} className="place-carousel">
      <div ref={row} className="place-carousel-row">
        {places.map((place) => {
          if (place.id !== selectedId) {
            const theme = getPlaceTheme(place);
            const rating = place.communityCount ? place.communityRating : place.rating;
            return (
              <button
                key={place.id}
                type="button"
                data-selected="false"
                aria-label={t('Show {name} on map', { name: place.name })}
                onClick={() => actions.onSelect(place)}
                className="place-mini"
              >
                <span
                  aria-hidden="true"
                  className="place-mini-tile"
                  style={{ background: `color-mix(in srgb, ${theme.color} 18%, white)` }}
                >
                  {theme.emoji}
                </span>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-sm font-bold">{place.name}</span>
                  <span className="block truncate text-xs text-slate-600">
                    {place.location}
                    {place.distance !== undefined && ` · ${place.distance.toFixed(1)} km`}
                  </span>
                  {!!rating && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-700">
                      <Star
                        size={12}
                        className="fill-amber-500 text-amber-500"
                        aria-hidden="true"
                      />
                      {rating.toFixed(1)}
                    </span>
                  )}
                </span>
              </button>
            );
          }
          const favorite = actions.isFavorite(place.id);
          return (
            <article
              key={place.id}
              data-selected="true"
              aria-label={place.name}
              className="place-focus"
            >
              <PlacePhoto place={place} className="h-28" priority />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-orange-700">
                      {place.location}
                    </p>
                    <h2 className="text-base font-bold leading-tight">{place.name}</h2>
                  </div>
                  <div className="-mr-2 -mt-2 flex shrink-0">
                    <button
                      aria-label={favorite ? t('Remove favorite') : t('Save favorite')}
                      aria-pressed={favorite}
                      className="icon-button"
                      onClick={() =>
                        actions.user ? actions.onToggleFavorite(place) : actions.onLoginClick()
                      }
                    >
                      <Heart
                        size={20}
                        className={favorite ? 'fill-red-600 text-red-600' : 'text-slate-600'}
                      />
                    </button>
                    <button
                      aria-label={t('Close selected place')}
                      onClick={actions.onClose}
                      className="icon-button"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                  {language === 'fr' && place.descriptionFr
                    ? place.descriptionFr
                    : place.description}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={actions.onShowDetails} className="secondary-button">
                    {t('View details')}
                  </button>
                  {place.access !== 'restricted' && (
                    <a
                      href={actions.mapsUrl(place)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-button flex items-center justify-center gap-1"
                    >
                      {t('Directions')}
                      <ArrowUpRight size={17} />
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
