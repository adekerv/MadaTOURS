/* global window, document, URLSearchParams, ResizeObserver */
// Google content stays inside Google's UI Kit. No values, photos or ratings are exported or cached.
let initialized = false;
let parentOrigin = '';
const report = (status) =>
  window.parent.postMessage(
    {
      type: 'madatours-google',
      status,
      height: Math.min(680, Math.max(300, document.body.scrollHeight)),
    },
    parentOrigin,
  );
window.addEventListener('message', (event) => {
  if (event.source !== window.parent || event.data?.type !== 'madatours-google-init') return;
  const { key, placeId, language, dark } = event.data;
  document.documentElement.classList.toggle('dark', dark === true);
  if (
    initialized ||
    typeof key !== 'string' ||
    !/^[A-Za-z0-9_-]{10,255}$/.test(placeId || '') ||
    !['en', 'fr'].includes(language)
  )
    return;
  initialized = true;
  parentOrigin = event.origin;
  document.documentElement.lang = language;
  window.gm_authFailure = () => report('error');
  window.initMadaToursGoogle = async () => {
    try {
      await window.google.maps.importLibrary('places');
      const details = document.createElement('gmp-place-details');
      const request = document.createElement('gmp-place-details-place-request');
      request.setAttribute('place', placeId);
      const config = document.createElement('gmp-place-content-config');
      for (const name of [
        'rating',
        'opening-hours',
        'website',
        'phone-number',
        'media',
        'attribution',
      ]) {
        const element = document.createElement(`gmp-place-${name}`);
        if (name === 'media') element.setAttribute('lightbox-preferred', '');
        config.append(element);
      }
      details.append(request, config);
      details.addEventListener('gmp-load', () => report('loaded'));
      details.addEventListener('gmp-error', () => report('error'));
      document.body.append(details);
      new ResizeObserver(() => report('resize')).observe(details);
    } catch {
      report('error');
    }
  };
  const params = new URLSearchParams({
    key,
    v: 'quarterly',
    loading: 'async',
    language,
    region: 'MQ',
    callback: 'initMadaToursGoogle',
  });
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
  script.async = true;
  script.onerror = () => report('error');
  document.head.append(script);
});
