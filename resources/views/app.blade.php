<!doctype html>
@php
  $language = request('lang') === 'fr' ? 'fr' : 'en';
  $title = $language === 'fr' ? 'MadaTours — Découvrez la Martinique' : 'MadaTours — Discover Martinique';
  $description = $language === 'fr'
    ? 'Explorez les plages, restaurants et sentiers de Martinique. Composez votre journée, trouvez les lieux proches et gardez vos favoris.'
    : 'Explore Martinique’s beaches, restaurants and trails. Plan your day, find nearby places and keep your favorites close.';
  $origin = rtrim(config('supabase.app_origin') ?: config('app.url'), '/');
  $shareImage = $origin . ($language === 'fr' ? '/og-image-fr.png' : '/og-image.png');
@endphp
<html lang="{{ $language }}">
  <head>
    <script src="/theme.js"></script>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content"
    />
    <meta name="theme-color" content="#fdfcfb" />
    <meta name="description" content="{{ $description }}" />
    <link rel="canonical" href="{{ $origin }}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="MadaTours" />
    <meta property="og:title" content="{{ $title }}" />
    <meta property="og:description" content="{{ $description }}" />
    <meta property="og:url" content="{{ $origin }}/" />
    <meta property="og:locale" content="{{ $language === 'fr' ? 'fr_FR' : 'en_GB' }}" />
    <meta property="og:image" content="{{ $shareImage }}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="{{ $title }} — Jardin de Balata" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{{ $title }}" />
    <meta name="twitter:description" content="{{ $description }}" />
    <meta name="twitter:image" content="{{ $shareImage }}" />
    <meta name="twitter:image:alt" content="{{ $title }} — Jardin de Balata" />
    <title>{{ $title }}</title>
  </head>
  <body>
    <div id="root"></div>
    <noscript
      >MadaTours needs JavaScript to show its interactive map and saved places. Please enable
      JavaScript to continue.</noscript
    >
    @viteReactRefresh
    @vite('resources/js/main.tsx')
  </body>
</html>
