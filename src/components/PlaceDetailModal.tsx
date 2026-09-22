import { Heart, Calendar, ExternalLink, Clock, Star, MapPin } from 'lucide-react';
import { useState } from 'react';
import type { Place, User } from '../types';
import { Modal } from './ui/Modal';
export function PlaceDetailModal({
  place,
  onClose,
  isFavorite,
  onToggleFavorite,
  isRevisit,
  onToggleRevisit,
  user,
  onLoginClick,
  googleMapsUrl,
}: {
  place: Place;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (place: Place) => void;
  isRevisit: boolean;
  onToggleRevisit: (place: Place) => void;
  user: User | null;
  onLoginClick: () => void;
  googleMapsUrl: string;
}) {
  const [imageError, setImageError] = useState(false);
  return (
    <Modal title={place.name} onClose={onClose} wide>
      <div className="relative h-40 bg-orange-50 sm:h-56">
        {place.image && !imageError ? (
          <img
            src={place.image}
            onError={() => setImageError(true)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-orange-600">
            <MapPin size={48} />
          </div>
        )}
        <span className="absolute bottom-2 right-3 rounded bg-white/90 px-2 py-1 text-xs text-slate-700">
          Illustrative photo
        </span>
      </div>
      <div className="space-y-5 p-5 sm:p-7">
        <p className="text-sm font-semibold text-orange-700">
          {place.type === 'restaurant' ? 'Restaurant' : 'Activity'} · {place.location}
        </p>
        <p className="leading-relaxed text-slate-700">{place.description}</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="flex items-center gap-2 text-sm text-slate-600">
              <Star size={17} />
              Guide rating
            </dt>
            <dd className="mt-1 font-semibold">
              {place.rating !== undefined ? `${place.rating} / 5` : 'Not rated'}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="flex items-center gap-2 text-sm text-slate-600">
              <Clock size={17} />
              Listed hours
            </dt>
            <dd className="mt-1 font-semibold">{place.hours || 'Check with the venue'}</dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-slate-500">
          Guide details and ratings are supplied with this catalogue, not live visitor reviews.
          Confirm opening hours, access, and trail conditions before visiting.
        </p>
        {!!place.tags?.length && (
          <ul aria-label="Place tags" className="flex flex-wrap gap-2">
            {[...new Set(place.tags)].map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => (user ? onToggleFavorite(place) : onLoginClick())}
            aria-pressed={isFavorite}
            className="secondary-button flex items-center justify-center gap-2"
          >
            <Heart size={18} className={isFavorite ? 'fill-red-600 text-red-600' : ''} />
            {isFavorite ? 'Saved to favorites' : 'Save favorite'}
          </button>
          <button
            onClick={() => (user ? onToggleRevisit(place) : onLoginClick())}
            aria-pressed={isRevisit}
            className="secondary-button flex items-center justify-center gap-2"
          >
            <Calendar size={18} />
            {isRevisit ? 'On your revisit list' : 'Add to revisit list'}
          </button>
        </div>
        {!user && (
          <p className="text-center text-sm text-slate-600">
            Sign in when you want to save a place.
          </p>
        )}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="primary-button flex w-full items-center justify-center gap-2"
        >
          Get directions
          <ExternalLink size={18} />
        </a>
      </div>
    </Modal>
  );
}
