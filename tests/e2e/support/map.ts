import type { Page } from '@playwright/test';
import { coastline } from '../../../resources/js/lib/martinique-coast';

/**
 * A local stand-in for the map's tiles, so browser tests and screenshots show a real map without any network.
 * The style is built from the repository's own OpenStreetMap coastline (the homepage artwork): the island's
 * outline is turned back into longitude and latitude and drawn as land on a sea background.
 */
const lat0 = 14.65;
const lon0 = -61.02;
const kmPerDegree = 111.195;
const project = (lat: number, lon: number) => [
  (lon - lon0) * kmPerDegree * Math.cos((lat0 * Math.PI) / 180),
  -(lat - lat0) * kmPerDegree,
];
// The coastline script recorded where four known places landed, which gives the offset it applied.
const known: Record<string, [number, number]> = {
  'fort-de-france': [14.6161, -61.0588],
  'saint-pierre': [14.7415, -61.1775],
  'montagne-pelee': [14.8111, -61.1644],
  'les-salines': [14.4025, -60.8758],
};
const offsets = coastline.landmarks.map((landmark) => {
  const [x, y] = project(...known[landmark.id]);
  return [x - landmark.at[0] / 10, y - landmark.at[1] / 10];
});
const minX = offsets.reduce((sum, [x]) => sum + x, 0) / offsets.length;
const minY = offsets.reduce((sum, [, y]) => sum + y, 0) / offsets.length;
const toLngLat = ([a, b]: number[]) => [
  lon0 + (a / 10 + minX) / (kmPerDegree * Math.cos((lat0 * Math.PI) / 180)),
  lat0 - (b / 10 + minY) / kmPerDegree,
];
const land = {
  type: 'FeatureCollection',
  features: coastline.path
    .split('Z')
    .filter(Boolean)
    .map((ring) => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            ...ring
              .slice(1)
              .split('L')
              .map((point) => toLngLat(point.split(' ').map(Number))),
          ].concat([toLngLat(ring.slice(1).split('L')[0].split(' ').map(Number))]),
        ],
      },
    })),
};
export const seaColor = '#a8d4ee';
export const landColor = '#efe9dc';
export const fixtureStyle = {
  version: 8,
  name: 'MadaTours test fixture',
  sources: { land: { type: 'geojson', data: land } },
  layers: [
    { id: 'sea', type: 'background', paint: { 'background-color': seaColor } },
    { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': landColor } },
    {
      id: 'coast',
      type: 'line',
      source: 'land',
      paint: { 'line-color': '#7fa6c2', 'line-width': 1.5 },
    },
  ],
};

/** Serves the fixture style in place of OpenFreeMap, and turns every other tile request away. */
export async function stubMap(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.request().url().includes('/styles/')
      ? route.fulfill({ json: fixtureStyle, headers: { 'access-control-allow-origin': '*' } })
      : route.abort(),
  );
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
}

/** How many pixels of a PNG screenshot are close to each colour, read back through the browser. */
export async function countColors(page: Page, png: Buffer, colors: string[]) {
  return page.evaluate(
    async ({ data, colors }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const targets = colors.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
      const found = colors.map(() => 0);
      for (let i = 0; i < pixels.length; i += 4)
        targets.forEach((target, index) => {
          if (
            Math.abs(pixels[i] - target[0]) < 6 &&
            Math.abs(pixels[i + 1] - target[1]) < 6 &&
            Math.abs(pixels[i + 2] - target[2]) < 6
          )
            found[index]++;
        });
      return found;
    },
    { data: png.toString('base64'), colors },
  );
}
