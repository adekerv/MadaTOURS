# Maps

Every map in the app is a Leaflet map. Its base layer comes from `resources/js/lib/basemap.ts`.

## Tiles

- **Source:** [OpenFreeMap](https://openfreemap.org) vector tiles (style `liberty`), free, no API key, and explicitly
  fine for production. The data is OpenStreetMap (ODbL) through OpenMapTiles.
- **Drawing:** [MapLibre GL JS](https://maplibre.org) renders the tiles inside Leaflet through
  `@maplibre/maplibre-gl-leaflet`, so markers, clusters, routes and gestures are still Leaflet. MapLibre is pinned
  to v5. The engine is about 318 KB gzipped and loads only when a map opens, in its own chunk.
- **Attribution:** "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" is passed to Leaflet's attribution control,
  and the site footer credits both.
- **Dark theme:** the same style, darkened by the `.map-tiles-dark` CSS filter.
- **No WebGL:** devices that cannot draw vector tiles fall back to the OpenStreetMap raster tiles automatically.
- **Zoom limits:** a vector layer does not tell Leaflet its maximum zoom, so each map sets `minZoom` and `maxZoom`
  from `basemap.ts`. Without that Leaflet throws "Map has no maxZoom specified".

## Security headers

The app and the host set no `Content-Security-Policy` today (checked in the code, `vercel.json` and the live
responses), so nothing blocks the tile domain. If you add one, allow:

- `connect-src https://tiles.openfreemap.org` (style, tile and TileJSON requests) and `img-src data: blob:`
- `worker-src blob:` (MapLibre runs its tile worker from a blob) and `child-src blob:` for older browsers
- `font-src` and `img-src` for `https://tiles.openfreemap.org` if you move to a style with glyphs or sprites hosted there

## Tests

Browser tests never reach OpenFreeMap. `tests/e2e/support/map.ts` serves a fixture style in place of
`https://tiles.openfreemap.org/styles/*` and turns every other tile request away. The style is built from the
repository's own OpenStreetMap coastline (`resources/js/lib/martinique-coast.ts`, which also draws the homepage art):
the outline is turned back into longitude and latitude and drawn as land on a sea background, so screenshots show
Martinique. `stubMap(page)` installs it; `countColors` lets a test prove a map really drew.
