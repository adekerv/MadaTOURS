import { useState, type CSSProperties } from 'react';
import { placeholderFor, type Placeholder } from '../../lib/placeholders';
import type { Place } from '../../types';
import { useI18n } from '../../i18n/I18nProvider';

/** The subject's icon, colour and label: shown when there is no photo to show. Needs no network request. */
export function PlaceTile({
  subject,
  className = '',
}: {
  subject: Placeholder;
  className?: string;
}) {
  const { language } = useI18n();
  const label = subject.label[language === 'fr' ? 'fr' : 'en'];
  return (
    <div
      role="img"
      aria-label={label}
      style={{ '--pin': subject.color } as CSSProperties}
      className={`place-tile flex flex-col items-center justify-center gap-2 px-3 text-center ${className}`}
    >
      <span aria-hidden="true" className="place-tile-icon">
        {subject.emoji}
      </span>
      <span aria-hidden="true" className="text-xs font-semibold leading-tight">
        {label}
      </span>
    </div>
  );
}

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
  const { t, language } = useI18n();
  const subject = placeholderFor(place);
  const [failedOriginal, setFailedOriginal] = useState('');
  const [imageState, setImageState] = useState({ src: '', loaded: false, failed: false });
  const own = !!place.image && failedOriginal !== place.image;
  const original = place.image?.startsWith('/photos/community/')
    ? `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${place.image}`
    : place.image;
  const src = own ? original! : subject.src;
  const loaded = imageState.src === src && imageState.loaded;
  const failed = imageState.src === src && imageState.failed;
  if (!src || failed) return <PlaceTile subject={subject} className={className} />;
  const badge = subject.credit?.ai
    ? t('AI-generated image · not this place')
    : t('Illustrative photo · not this place');
  return (
    <div className={`relative overflow-hidden bg-orange-100 ${className}`}>
      <img
        src={src}
        alt={own ? place.name : `${subject.label[language === 'fr' ? 'fr' : 'en']} · ${badge}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        width="960"
        height="640"
        onLoad={() => setImageState({ src, loaded: true, failed: false })}
        onError={() => {
          if (own) {
            setFailedOriginal(place.image!);
            onOriginalError?.();
          } else setImageState({ src, loaded: false, failed: true });
        }}
        className={`h-full w-full object-cover transition-[filter,opacity] duration-300 ${loaded ? 'blur-0 opacity-100' : 'blur-sm opacity-30'}`}
      />
      {!loaded && <div aria-hidden="true" className="skeleton absolute inset-0" />}
      {!own && (
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-full bg-slate-900/75 px-2 py-0.5 text-[10px] leading-4 text-white"
        >
          {badge}
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
