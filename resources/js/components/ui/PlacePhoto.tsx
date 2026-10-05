import { useState } from 'react';
import { placeholderFor, creditLine } from '../../lib/placeholders';
import { MapPin } from 'lucide-react';
import type { Place } from '../../types';
import { useI18n } from '../../i18n/I18nProvider';

export function PlacePhoto({
  place,
  className = 'h-36',
  priority = false,
  onOriginalError,
}: {
  place: Place;
  className?: string;
  priority?: boolean;
  onOriginalError?: () => void;
}) {
  const { t } = useI18n();
  const fallback = placeholderFor(place);
  const [failedOriginal, setFailedOriginal] = useState('');
  const [imageState, setImageState] = useState({ src: '', loaded: false, failed: false });
  const illustrative = !place.image || failedOriginal === place.image;
  const original = place.image?.startsWith('/photos/community/')
    ? `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${place.image}`
    : place.image;
  const src = illustrative ? fallback.src : original!;
  const loaded = imageState.src === src && imageState.loaded;
  const failed = imageState.src === src && imageState.failed;
  return (
    <div className={`relative overflow-hidden bg-orange-100 ${className}`}>
      {!failed ? (
        <img
          src={src}
          alt={illustrative ? t(fallback.label) : place.name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          width="960"
          height="640"
          onLoad={() => setImageState({ src, loaded: true, failed: false })}
          onError={() => {
            if (!illustrative) {
              setFailedOriginal(place.image!);
              onOriginalError?.();
            } else setImageState({ src, loaded: false, failed: true });
          }}
          className={`h-full w-full object-cover transition-[filter,opacity] duration-300 ${loaded ? 'blur-0 opacity-100' : 'blur-sm opacity-30'}`}
        />
      ) : (
        <div className="grid h-full place-items-center text-orange-700">
          <MapPin size={32} />
        </div>
      )}
      {!loaded && !failed && <div aria-hidden="true" className="skeleton absolute inset-0" />}
      {(illustrative || failed) && (
        <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 px-2 py-1 text-[10px] text-white">
          {t(failed ? 'Photo unavailable' : fallback.label)}
          {creditLine(fallback) && <span className="block">{t(creditLine(fallback)!)}</span>}
        </span>
      )}
    </div>
  );
}
/**
 * A card-shaped placeholder. The `pick` shape matches the homepage's place cards line for line, so the page below
 * does not jump down when the catalogue arrives.
 */
export function PlaceCardSkeleton({ pick = false }: { pick?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden border border-slate-200 bg-white ${pick ? 'rounded-3xl' : 'rounded-2xl'}`}
    >
      <div className={`skeleton ${pick ? 'h-48' : 'h-36'}`} />
      {pick ? (
        <div className="p-5">
          <div className="skeleton h-4 w-1/4 rounded" />
          <div className="skeleton mt-2 h-7 w-3/4 rounded" />
          <div className="skeleton mt-1 h-5 w-1/2 rounded" />
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="skeleton h-5 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
          <div className="skeleton h-11 rounded-xl" />
        </div>
      )}
    </div>
  );
}
