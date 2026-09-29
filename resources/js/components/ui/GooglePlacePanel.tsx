import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useI18n } from '../../i18n/I18nProvider';
import { useTheme } from '../../hooks/useTheme';
import type { Place } from '../../types';

export function GooglePlacePanel({ place }: { place: Place }) {
  const { t, language } = useI18n();
  const { dark } = useTheme();
  const frame = useRef<HTMLIFrameElement>(null);
  const [opened, setOpened] = useState(false);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState('loading');
  const [height, setHeight] = useState(460);
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const apiOrigin = Capacitor.isNativePlatform()
    ? import.meta.env.VITE_API_URL
    : window.location.origin;
  const canEmbed = Boolean(key && apiOrigin && place.googlePlaceId);
  const origin = apiOrigin ? new URL(apiOrigin).origin : window.location.origin;
  const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} Martinique`)}${place.googlePlaceId ? `&query_place_id=${encodeURIComponent(place.googlePlaceId)}` : ''}`;
  function initialize() {
    frame.current?.contentWindow?.postMessage(
      { type: 'madatours-google-init', key, placeId: place.googlePlaceId, language, dark },
      origin,
    );
  }
  useEffect(() => {
    if (!opened || !canEmbed) return;
    const listener = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== origin ||
        event.data?.type !== 'madatours-google'
      )
        return;
      if (event.data.status === 'loaded' || event.data.status === 'error')
        setStatus(event.data.status);
      if (typeof event.data.height === 'number')
        setHeight(Math.min(680, Math.max(300, event.data.height)));
    };
    window.addEventListener('message', listener);
    const timer = window.setTimeout(
      () => setStatus((previous) => (previous === 'loading' ? 'error' : previous)),
      20000,
    );
    return () => {
      window.removeEventListener('message', listener);
      window.clearTimeout(timer);
    };
  }, [opened, canEmbed, origin, language, retry]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: 'madatours-google-init', dark }, origin);
  }, [dark, origin]);
  return (
    <section
      className="space-y-3 rounded-2xl border border-orange-200 p-4"
      aria-label={t('Google photos, ratings and hours')}
    >
      <h3 className="font-semibold">{t('Google photos, ratings and hours')}</h3>
      {!opened && canEmbed && (
        <>
          <p className="text-sm text-slate-600">
            {t('Load current venue details from Google. Your browser will connect to Google.')}
          </p>
          <button
            className="primary-button"
            onClick={() => {
              setStatus('loading');
              setOpened(true);
            }}
          >
            {t('Load Google details')}
          </button>
        </>
      )}
      {opened && canEmbed && (
        <>
          {status === 'loading' && (
            <p role="status" className="skeleton min-h-11 rounded-xl p-3">
              {t('Loading Google details…')}
            </p>
          )}
          <iframe
            key={`${language}:${retry}`}
            ref={frame}
            title={t('Google photos, ratings and hours')}
            src={`${origin}/google-places.html?lang=${language}`}
            onLoad={initialize}
            className="w-full border-0"
            style={{ height }}
            referrerPolicy="strict-origin-when-cross-origin"
          />
          {status === 'error' && (
            <div role="status">
              <p className="text-sm text-slate-600">
                {t('Google details are unavailable. You can still view this venue on Google Maps.')}
              </p>
              <button
                className="secondary-button mt-2"
                onClick={() => {
                  setStatus('loading');
                  setRetry((v) => v + 1);
                }}
              >
                {t('Retry')}
              </button>
            </div>
          )}
        </>
      )}
      <a
        className="inline-flex min-h-11 items-center text-sm text-orange-800 underline"
        href={link}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('View on Google Maps')}
      </a>
    </section>
  );
}
