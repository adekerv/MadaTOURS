import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { api } from '../../lib/api';
import { PlacePhoto, PlaceCardSkeleton } from '../ui/PlacePhoto';
import type { Place } from '../../types';
export function MustGo({ places, catalogueLoading }: { places: Place[]; catalogueLoading: boolean }) {
  const { t } = useI18n();
  const [ids, setIds] = useState<number[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    api<{ picks: { place_id: number }[] }>('/daily-picks', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setIds(data.picks.map((p) => p.place_id));
        setStatus('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [revision]);
  const picks = ids
    .map((id) => places.find((p) => p.id === id))
    .filter((p): p is Place => !!p && p.access !== 'restricted' && (p.communityCount || 0) >= 3);
  return (
    <section className="my-10" aria-labelledby="must-go-title">
      <p className="text-xs font-bold uppercase tracking-widest text-orange-700">
        {t('Community favorites')}
      </p>
      <h2 id="must-go-title" className="mt-2 font-serif text-3xl font-bold">
        {t('Must go')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {t(
          'The daily top five by MadaTours community rating, with at least three reviews each. Google ratings remain separate.',
        )}
      </p>
      {status === 'error' ? (
        <div role="status" className="mt-5 rounded-2xl bg-orange-50 p-5">
          <p className="text-sm text-slate-700">{t('Community favorites are temporarily unavailable. You can still explore the guide.')}</p>
          <button className="secondary-button mt-3" onClick={() => setRevision((value) => value + 1)}>{t('Retry')}</button>
          <a href="#explore" className="secondary-button ml-3 mt-3 inline-flex items-center">{t('Explore places')}</a>
        </div>
      ) : status === 'loading' || (catalogueLoading && !places.length) ? (
        <div role="status" className="mt-5 grid gap-4 sm:grid-cols-3">
          <span className="sr-only">{t('Loading community favorites…')}</span>
          {[0, 1, 2].map((id) => <PlaceCardSkeleton key={id} />)}
        </div>
      ) : picks.length ? (
        <div className="home-entrance mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {picks.map((p) => (
            <a
              key={p.id}
              className="place-card overflow-hidden rounded-2xl border border-slate-200 bg-white"
              href={`#explore?filter=${p.type}&radius=50&place=${p.id}`}
            >
              <PlacePhoto place={p} className="h-36" />
              <div className="p-4">
                <h3 className="font-bold">{p.name}</h3>
                <p className="text-sm text-slate-600">{p.location}</p>
                <p className="mt-2 text-sm font-semibold text-orange-800">
                  {t('Community: {rating} / 5 · {count} reviews', {
                    rating: p.communityRating?.toFixed(1) || '—',
                    count: p.communityCount || 0,
                  })}
                </p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-orange-50 p-5">
          <p className="text-sm text-slate-700">
            {t(
              'The first community favorites will appear once places receive three reviews. Share a place you enjoyed to help others discover it.',
            )}
          </p>
          <a href="#explore" className="secondary-button mt-3 inline-flex items-center">
            {t('Explore places')}
          </a>
        </div>
      )}
    </section>
  );
}
