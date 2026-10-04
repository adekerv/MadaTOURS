import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Route } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { api } from '../../lib/api';
import {
  formatRoute,
  parseTours,
  roadLine,
  tourDescription,
  tourName,
  tourRoute,
  type Tour,
} from '../../lib/tours';
import type { Place } from '../../types';
import { Modal } from '../ui/Modal';
const TripRouteMap = lazy(() => import('../planner/TripRouteMap'));

function RouteFacts({ tour }: { tour: Tour }) {
  const { t } = useI18n();
  const facts = formatRoute(tour);
  return (
    <>
      {t('{count} stops', { count: tour.stops.length })}
      {facts && (
        <>
          {' · '}
          {facts.minutes
            ? t('{km} km by road · about {minutes} min', { km: facts.km, minutes: facts.minutes })
            : t('{km} km by road', { km: facts.km })}
        </>
      )}
    </>
  );
}

function TourDialog({
  tour,
  places,
  onClose,
}: {
  tour: Tour;
  places: Place[];
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const route = useMemo(() => tourRoute(tour, places), [tour, places]);
  const road = roadLine(tour, route);
  const name = tourName(tour, language);
  return (
    <Modal title={name} onClose={onClose} wide>
      <div className="space-y-5 p-5 sm:p-7">
        <p className="text-slate-700">{tourDescription(tour, language)}</p>
        <p className="text-sm font-semibold text-orange-800">
          <RouteFacts tour={tour} />
        </p>
        {route.points.length > 0 && (
          <div className="trip-map-frame">
            <Suspense
              fallback={<div role="status" aria-label={t('Loading map…')} className="trip-map" />}
            >
              <TripRouteMap
                route={route}
                road={road}
                label={t('Route map: {stops}', {
                  stops: route.points.map((p) => `${p.order}. ${p.place.name}`).join(', '),
                })}
              />
            </Suspense>
          </div>
        )}
        <p className="text-xs text-slate-500">
          {road
            ? t(
                'The line follows the road between the stops. Check live directions before you set off.',
              )
            : t(
                'Stops are joined by straight lines in your visiting order. Check directions for road routes.',
              )}
        </p>
        <ol className="space-y-2">
          {tour.stops.map((stop, index) => {
            const place = places.find((candidate) => candidate.id === stop.placeId);
            return (
              <li
                key={stop.placeId}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-slate-200 p-3"
              >
                <span className="min-w-0 font-semibold">
                  {index + 1}. {place?.name ?? t('This place is no longer listed')}
                  {place && (
                    <span className="block text-sm font-normal text-slate-600">
                      {place.location}
                    </span>
                  )}
                </span>
                <span className="text-sm text-slate-600">
                  {t('{minutes} min', { minutes: stop.minutes })}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </Modal>
  );
}

/** Ready-made routes an administrator curated. Nothing is shown until there is a published tour. */
export function Tours({ places }: { places: Place[] }) {
  const { t, language } = useI18n();
  const [tours, setTours] = useState<Tour[]>([]);
  const [open, setOpen] = useState<Tour | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<unknown>('/tours', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setTours(parseTours(data));
      })
      // Tours are an extra: if they cannot load, the rest of the page is unaffected.
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!tours.length) return null;
  return (
    <section className="my-10" aria-labelledby="tours-title">
      <p className="text-xs font-bold uppercase tracking-widest text-orange-700">
        {t('Curated by MadaTours')}
      </p>
      <h2 id="tours-title" className="mt-2 font-serif text-3xl font-bold">
        {t('Island tours')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {t('Ready-made routes between our favorite places, with the road to follow.')}
      </p>
      <ul className="home-entrance mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tours.map((tour) => (
          <li key={tour.id}>
            <button
              type="button"
              onClick={() => setOpen(tour)}
              className="place-card flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left"
            >
              <Route className="text-orange-600" size={22} aria-hidden="true" />
              <h3 className="mt-3 text-lg font-bold">{tourName(tour, language)}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                {tourDescription(tour, language)}
              </p>
              <span className="mb-4 mt-3 text-sm font-semibold text-orange-800">
                <RouteFacts tour={tour} />
              </span>
              <span className="mt-auto flex items-center gap-2 text-sm font-semibold">
                {t('View the route')}
                <ArrowUpRight size={17} aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && <TourDialog tour={open} places={places} onClose={() => setOpen(null)} />}
    </section>
  );
}
