import { Heart, X, ArrowUpRight } from 'lucide-react';
import type { Place, User } from '../../types';
export function SelectedPlaceOverlay({
  place,
  isVisible,
  onClose,
  isFavorite,
  onToggleFavorite,
  onShowDetails,
  googleMapsUrl,
  user,
  onLoginClick,
}: {
  place: Place | null;
  isVisible: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (place: Place) => void;
  onShowDetails: () => void;
  googleMapsUrl: string;
  user: User | null;
  onLoginClick: () => void;
}) {
  if (!isVisible || !place) return null;
  return (
    <section
      aria-label={place.name}
      className="selected-place-overlay absolute z-[600] rounded-3xl border border-slate-200 bg-white p-4 shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-orange-700">{place.location}</p>
          <h2 className="mt-1 text-lg font-bold leading-tight">{place.name}</h2>
        </div>
        <div className="flex shrink-0">
          <button
            aria-label={isFavorite ? 'Remove favorite' : 'Save favorite'}
            aria-pressed={isFavorite}
            className="icon-button"
            onClick={() => (user ? onToggleFavorite(place) : onLoginClick())}
          >
            <Heart
              size={20}
              className={isFavorite ? 'fill-red-600 text-red-600' : 'text-slate-600'}
            />
          </button>
          <button aria-label="Close selected place" onClick={onClose} className="icon-button">
            <X size={20} />
          </button>
        </div>
      </div>
      <p className="my-3 line-clamp-2 text-sm text-slate-600">{place.description}</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onShowDetails} className="secondary-button">
          View details
        </button>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="primary-button flex items-center justify-center gap-1"
        >
          Directions
          <ArrowUpRight size={17} />
        </a>
      </div>
    </section>
  );
}
