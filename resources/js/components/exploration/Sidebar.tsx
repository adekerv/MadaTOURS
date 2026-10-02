import { useI18n } from '../../i18n/I18nProvider';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import type { Place, User } from '../../types';
import { PlaceCard } from './PlaceCard';
import { FilterControls, type FilterProps } from './FilterControls';
import { useEffect, useState } from 'react';
import { PlaceCardSkeleton } from '../ui/PlacePhoto';
interface Props extends FilterProps {
  loading: boolean;
  filteredPlaces: Place[];
  selectedPlace: Place | null;
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  onPlaceSelect: (place: Place) => void;
  onShowDetails: (place: Place) => void;
  isFavorite: (id: number) => boolean;
  onResetRadar: () => void;
  user: User | null;
  onAdminClick: () => void;
}
export function Sidebar(props: Props) {
  const { t } = useI18n();
  const [visibleCount, setVisibleCount] = useState(30);
  const { loading, filteredPlaces, selectedPlace, onPlaceSelect, onShowDetails, isFavorite } =
    props;
  const { onResetRadar, user, onAdminClick } = props;
  useEffect(() => setVisibleCount(30), [filteredPlaces]);
  // A pin picked on the map may sit beyond the first page of cards: reveal it so it can scroll into view.
  useEffect(() => {
    if (!selectedPlace) return;
    const index = filteredPlaces.findIndex((place) => place.id === selectedPlace.id);
    if (index >= 0) setVisibleCount((count) => Math.max(count, index + 1));
  }, [selectedPlace, filteredPlaces]);
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
      <FilterControls {...props} />
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
                isHovered={props.hoveredId === place.id}
                onHover={props.onHover}
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
