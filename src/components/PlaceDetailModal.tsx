import { useI18n } from '../i18n/I18nProvider';
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
  const { t, language } = useI18n();
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
          {place.image && !imageError
            ? (place.photoCredit?.caption ?? t('Illustrative photo'))
            : t('No venue photo yet')}
        </span>
      </div>
      <div className="space-y-5 p-5 sm:p-7">
        <p className="text-sm font-semibold text-orange-700">
          {place.type === 'restaurant' ? t('Restaurant') : t('Activity')} · {place.location}
        </p>
        <p className="leading-relaxed text-slate-700">
          {language === 'fr' && place.descriptionFr ? place.descriptionFr : place.description}
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="flex items-center gap-2 text-sm text-slate-600">
              <Star size={17} />
              {t('Guide rating')}
            </dt>
            <dd className="mt-1 font-semibold">
              {place.rating !== undefined ? `${place.rating} / 5` : t('Not rated')}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="flex items-center gap-2 text-sm text-slate-600">
              <Clock size={17} />
              {t('Listed hours')}
            </dt>
            <dd className="mt-1 font-semibold">{place.hours || t('Check with the venue')}</dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-slate-500">
          {t(
            'Check the source for current hours and access. Map points are approximate; confirm the entrance with the venue.',
          )}
        </p>
        {!!place.tags?.length && (
          <ul aria-label={t('Place tags')} className="flex flex-wrap gap-2">
            {[...new Set(place.tags)].map((tag) => (
              <li
                key={t(tag)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                {t(tag)}
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
            {isFavorite ? t('Saved to favorites') : t('Save favorite')}
          </button>
          <button
            onClick={() => (user ? onToggleRevisit(place) : onLoginClick())}
            aria-pressed={isRevisit}
            className="secondary-button flex items-center justify-center gap-2"
          >
            <Calendar size={18} />
            {isRevisit ? t('On your revisit list') : t('Add to revisit list')}
          </button>
        </div>
        {!user && (
          <p className="text-center text-sm text-slate-600">
            {t('Sign in when you want to save a place.')}
          </p>
        )}
        {place.sources?.length ? (
          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="font-semibold">{t('Sources and updates')}</h3>
            <ul className="mt-2 space-y-3">
              {place.sources.map((source) => (
                <li key={source.url} className="text-sm">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-orange-700 underline"
                  >
                    {source.title}
                  </a>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('Source checked: {date}', { date: source.checkedAt })} ·{' '}
                    {source.fields.map((field) => t(field)).join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-sm text-amber-800">{t('Venue details still need verification.')}</p>
        )}
        {place.photoCredit && (
          <p className="text-xs leading-relaxed text-slate-500">
            {t('Photo')}:{' '}
            <a
              href={place.photoCredit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {place.photoCredit.author}
            </a>{' '}
            ·{' '}
            <a
              href={place.photoCredit.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {place.photoCredit.license}
            </a>{' '}
            · {t('Displayed cropped to fit.')}
          </p>
        )}
        {place.access === 'restricted' ? (
          <p role="note" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            {t(
              'Access is restricted. This place cannot be added to a day trip. Consult the source before planning a visit.',
            )}
          </p>
        ) : (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="primary-button flex w-full items-center justify-center gap-2"
          >
            {t('Get directions')}
            <ExternalLink size={18} />
          </a>
        )}
      </div>
    </Modal>
  );
}
