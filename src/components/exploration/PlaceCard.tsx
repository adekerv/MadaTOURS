import { Heart, MapPin } from 'lucide-react';
import type { Place } from '../../types';
export function PlaceCard({
  place,
  isSelected,
  isFavorite,
  onSelect,
  onShowDetails,
}: {
  place: Place;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (place: Place) => void;
  onShowDetails: (place: Place) => void;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${isSelected ? 'border-orange-600 bg-orange-50' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold leading-snug">{place.name}</h3>
        {isFavorite && (
          <Heart
            aria-label="Saved to favorites"
            size={16}
            className="shrink-0 fill-red-600 text-red-600"
          />
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {place.location}
        {place.distance !== undefined && ` · ${place.distance.toFixed(1)} km`}
      </p>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
        {place.description}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onSelect(place)}
          aria-label={`Show ${place.name} on map`}
          className="secondary-button flex justify-center items-center gap-1 text-sm"
        >
          <MapPin size={15} />
          Map
        </button>
        <button
          onClick={() => onShowDetails(place)}
          aria-label={`Details for ${place.name}`}
          className="primary-button text-sm"
        >
          Details
        </button>
      </div>
    </article>
  );
}
