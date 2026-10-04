import { X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
export type ReviewPhoto = { id: string; reviewId: number; url: string };
/**
 * Photos on one review. They are only ever given to signed-in people, so the caller has none to pass
 * for a guest and nothing is drawn: no frame, no count and no hint that photos exist.
 */
export function ReviewPhotos({
  photos,
  author,
  canRemove,
  disabled,
  onRemove,
}: {
  photos: ReviewPhoto[];
  author: string;
  canRemove: boolean;
  disabled: boolean;
  onRemove: (photo: ReviewPhoto) => void;
}) {
  const { t } = useI18n();
  if (!photos.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {photos.map((photo) => (
        <li key={photo.id} className="relative">
          <a href={photo.url} target="_blank" rel="noopener noreferrer">
            <img
              src={photo.url}
              alt={t('Photo shared by {name}', { name: author })}
              loading="lazy"
              className="size-24 rounded-xl object-cover"
            />
          </a>
          {canRemove && (
            <button
              type="button"
              disabled={disabled}
              aria-label={t('Remove photo')}
              onClick={() => onRemove(photo)}
              className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full bg-white text-red-700 shadow ring-1 ring-slate-300"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
