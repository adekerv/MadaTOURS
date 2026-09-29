import { useState } from 'react';
import { MapPin } from 'lucide-react';
import type { Place } from '../../types';
import { useI18n } from '../../i18n/I18nProvider';

export function PlacePhoto({
  place,
  className = 'h-36',
  priority = false,
}: {
  place: Place;
  className?: string;
  priority?: boolean;
}) {
  const { t } = useI18n();
  const [imageState, setImageState] = useState({ src: '', loaded: false, failed: false });
  // The fallback is clearly labelled: a licensed island landscape is not a venue photograph.
  const src = place.image || '/photos/salines.jpg';
  const loaded = imageState.src === src && imageState.loaded;
  const failed = imageState.src === src && imageState.failed;
  return (
    <div className={`relative overflow-hidden bg-orange-100 ${className}`}>
      {!failed ? (
        <img
          src={src}
          alt={place.image ? place.name : t('Étang des Salines landscape')}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          width="960"
          height="640"
          onLoad={() => setImageState({ src, loaded: true, failed: false })}
          onError={() => setImageState({ src, loaded: false, failed: true })}
          className={`h-full w-full object-cover transition-[filter,opacity] duration-300 ${loaded ? 'blur-0 opacity-100' : 'blur-sm opacity-30'}`}
        />
      ) : (
        <div className="grid h-full place-items-center text-orange-700">
          <MapPin size={32} />
        </div>
      )}
      {!loaded && !failed && <div aria-hidden="true" className="skeleton absolute inset-0" />}
      {(!place.image || failed) && (
        <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 px-2 py-1 text-[10px] text-white">
          {t(failed ? 'Photo unavailable' : 'Martinique scenery · illustrative photo')}
        </span>
      )}
    </div>
  );
}
export function PlaceCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="skeleton h-36" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton h-11 rounded-xl" />
      </div>
    </div>
  );
}
