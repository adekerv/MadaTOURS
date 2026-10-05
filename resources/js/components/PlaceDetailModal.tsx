import { lazy, Suspense, useState } from 'react';
import {
  Calendar,
  ExternalLink,
  Globe,
  Heart,
  Navigation,
  Phone,
  TriangleAlert,
} from 'lucide-react';
import { GooglePlacePanel } from './ui/GooglePlacePanel';
import { useI18n } from '../i18n/I18nProvider';
import { PlacePhoto } from './ui/PlacePhoto';
import type { Place, User } from '../types';
import { placeholderFor, creditLine } from '../lib/placeholders';
import { placeFacts, telHref } from '../lib/place-details';
import { usePlaceDetail } from '../hooks/usePlaceDetail';
import { PlaceCommunity } from './community/PlaceCommunity';
import { PracticalInfo } from './place/PracticalInfo';
import { Modal } from './ui/Modal';
const MiniMap = lazy(() => import('./place/MiniMap'));
const action = 'flex min-h-11 items-center justify-center gap-2 text-center';
export function PlaceDetailModal({
  place: listed,
  onClose,
  isFavorite,
  onToggleFavorite,
  isRevisit,
  onToggleRevisit,
  user,
  onLoginClick,
  googleMapsUrl,
  onRatingChanged,
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
  onRatingChanged: () => void;
}) {
  const { t, language } = useI18n();
  const { place, status } = usePlaceDetail(listed);
  const [failedPhoto, setFailedPhoto] = useState('');
  const showingPlaceholder = !place.image || failedPhoto === place.image;
  const illustrative = placeholderFor(place);
  const facts = placeFacts(place, language);
  const restricted = place.access === 'restricted';
  const tags = [...new Set(place.tags ?? [])];
  const dateFormat = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
  const checked = (place.sources ?? []).map((source) => source.checkedAt).sort();
  const latestCheck = checked[checked.length - 1];
  return (
    <Modal title={place.name} onClose={onClose} wide>
      <div className="space-y-6 p-5 sm:p-7">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-orange-800">
            {place.type === 'restaurant' ? t('Restaurant') : t('Activity')} · {place.location}
            {place.rating !== undefined && ` · ★ ${place.rating} / 5 ${t('guide rating')}`}
          </p>
          {!!tags.length && (
            <ul aria-label={t('Place tags')} className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li
                  key={t(tag)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {t(tag)}
                </li>
              ))}
            </ul>
          )}
        </header>
        <PlacePhoto
          place={place}
          className="h-44 overflow-hidden rounded-2xl sm:h-64"
          onOriginalError={() => setFailedPhoto(place.image || '')}
        />
        {place.listingStatus === 'needs_review' && (
          <p
            role="note"
            className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"
          >
            <TriangleAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
            {t("We couldn't confirm recent details. Check with the venue before going.")}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>:last-child:nth-child(odd)]:col-span-2 sm:[&>:last-child:nth-child(odd)]:col-span-1">
          {!restricted && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`primary-button ${action}`}
            >
              <Navigation size={18} aria-hidden="true" />
              {t('Directions')}
              <span className="sr-only">{t('(opens in a new tab)')}</span>
            </a>
          )}
          {facts.phone && (
            <a href={telHref(facts.phone)} className={`secondary-button ${action}`}>
              <Phone size={18} aria-hidden="true" />
              {t('Call {phone}', { phone: facts.phone })}
            </a>
          )}
          {facts.website && (
            <a
              href={facts.website}
              target="_blank"
              rel="noopener noreferrer"
              className={`secondary-button ${action}`}
            >
              <Globe size={18} aria-hidden="true" />
              {t('Website')}
              <span className="sr-only">{t('(opens in a new tab)')}</span>
            </a>
          )}
          <button
            onClick={() => (user ? onToggleFavorite(place) : onLoginClick())}
            aria-pressed={isFavorite}
            className={`secondary-button ${action}`}
          >
            <Heart
              size={18}
              aria-hidden="true"
              className={isFavorite ? 'fill-red-600 text-red-600' : ''}
            />
            {isFavorite ? t('Saved to favorites') : t('Save favorite')}
          </button>
        </div>
        {restricted && (
          <p role="note" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            {t(
              'Access is restricted. This place cannot be added to a day trip. Consult the source before planning a visit.',
            )}
          </p>
        )}
        <section aria-labelledby="about-place">
          <h3 id="about-place" className="mb-2 text-lg font-bold">
            {t('About')}
          </h3>
          <p className="leading-relaxed text-slate-700">{facts.about}</p>
        </section>
        {status !== 'ready' && (
          <p role="status" className="text-sm text-slate-600">
            {t(
              status === 'loading' ? 'Loading more details…' : 'More details could not be loaded.',
            )}
          </p>
        )}
        <PracticalInfo place={place} facts={facts} />
        <section aria-labelledby="place-map" className="space-y-2">
          <h3 id="place-map" className="text-lg font-bold">
            {t('On the map')}
          </h3>
          <Suspense fallback={<div className="detail-map skeleton" />}>
            <MiniMap
              lat={place.lat}
              lng={place.lng}
              label={t('Map showing the location of {name}', { name: place.name })}
            />
          </Suspense>
          <p className="text-xs leading-relaxed text-slate-600">
            {t('Map points are approximate. Confirm the entrance with the venue.')}
          </p>
        </section>
        <GooglePlacePanel key={`${place.id}:${language}`} place={place} />
        <PlaceCommunity
          key={`${place.id}:${user?.id || 'guest'}`}
          placeId={place.id}
          user={user}
          onLogin={onLoginClick}
          onRatingChanged={onRatingChanged}
          extraActions={
            <button
              onClick={() => (user ? onToggleRevisit(place) : onLoginClick())}
              aria-pressed={isRevisit}
              className="secondary-button flex items-center gap-2"
            >
              <Calendar size={18} aria-hidden="true" />
              {isRevisit ? t('On your revisit list') : t('Add to revisit list')}
            </button>
          }
        />
        {place.sources?.length ? (
          <details className="rounded-2xl bg-slate-50 p-4 text-sm">
            <summary className="cursor-pointer font-semibold">
              {t('Sources and updates')}
              <span className="font-normal text-slate-600">
                {' '}
                ·{' '}
                {t(place.sources.length === 1 ? '1 source' : '{count} sources', {
                  count: place.sources.length,
                })}
                {latestCheck &&
                  ` · ${t('checked {date}', { date: dateFormat.format(new Date(latestCheck)) })}`}
              </span>
            </summary>
            <ul className="mt-3 space-y-3">
              {place.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 font-semibold text-orange-800 underline"
                  >
                    {source.title}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                  <p className="text-xs text-slate-600">
                    {t('Source checked: {date}', {
                      date: dateFormat.format(new Date(source.checkedAt)),
                    })}{' '}
                    · {source.fields.map((field) => t(field)).join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          status === 'ready' && (
            <p className="text-sm text-amber-900">{t('Venue details still need verification.')}</p>
          )
        )}
        <p className="text-xs leading-relaxed text-slate-600">
          {place.photoCredit && !showingPlaceholder ? (
            <>
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
              ·{' '}
            </>
          ) : (
            creditLine(illustrative) && (
              <>
                {t('Photo')}: {t(creditLine(illustrative)!)}
                {illustrative.source && (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      className="underline"
                      href={illustrative.source}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('Photo source')}
                    </a>
                  </>
                )}
                {illustrative.license && (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      className="underline"
                      href={illustrative.license}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('Photo license')}
                    </a>
                  </>
                )}{' '}
                ·{' '}
              </>
            )
          )}
          {t('Displayed cropped to fit.')} ·{' '}
          <a href="#about" className="inline-flex min-h-11 items-center underline">
            {t('Photo credits')}
          </a>
        </p>
      </div>
    </Modal>
  );
}
