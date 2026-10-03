import { writeFile, readFile } from 'node:fs/promises';
/**
 * Builds the homepage coastline from real OpenStreetMap data (ODbL, © OpenStreetMap contributors).
 *   npm run coastline:build               fetch from Overpass
 *   npm run coastline:build -- --from=raw.json   reuse a saved Overpass response
 * Output: resources/js/lib/martinique-coast.ts. Review the printed checks before committing.
 */
const args = process.argv.slice(2);
const from = args.find((arg) => arg.startsWith('--from='))?.slice('--from='.length);
const query =
  '[out:json][timeout:60];way["natural"="coastline"](14.37,-61.25,14.90,-60.78);out geom;';
interface Way {
  nodes: number[];
  geometry: { lat: number; lon: number }[];
}
async function load(): Promise<Way[]> {
  const raw = from
    ? await readFile(from, 'utf8')
    : await (
        await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'MadaToursBuild/1.0 (homepage coastline; github.com/adekerv/MadaTOURS)',
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(90000),
        })
      ).text();
  const data = JSON.parse(raw) as { elements: (Way & { type: string })[] };
  return data.elements.filter((element) => element.type === 'way' && element.geometry?.length > 1);
}
// Local equirectangular projection in kilometres, scaled at Martinique's latitude.
const lat0 = 14.65;
const lon0 = -61.02;
const kmPerDegree = 111.195;
type Point = [number, number];
const project = (lat: number, lon: number): Point => [
  (lon - lon0) * kmPerDegree * Math.cos((lat0 * Math.PI) / 180),
  -(lat - lat0) * kmPerDegree,
];
/** Joins coastline ways end-to-end into closed rings, using OSM node ids so no guesswork is involved. */
function rings(ways: Way[]): Point[][] {
  const unused = new Set(ways.keys());
  const byEnd = new Map<number, number[]>();
  ways.forEach((way, index) => {
    for (const node of [way.nodes[0], way.nodes[way.nodes.length - 1]])
      byEnd.set(node, [...(byEnd.get(node) ?? []), index]);
  });
  const result: Point[][] = [];
  while (unused.size) {
    const start = unused.values().next().value as number;
    unused.delete(start);
    let chain = ways[start].geometry.map((p) => project(p.lat, p.lon));
    let tail = ways[start].nodes[ways[start].nodes.length - 1];
    const head = ways[start].nodes[0];
    while (tail !== head) {
      const next = (byEnd.get(tail) ?? []).find((index) => unused.has(index));
      if (next === undefined) break;
      unused.delete(next);
      const way = ways[next];
      const forward = way.nodes[0] === tail;
      const points = way.geometry.map((p) => project(p.lat, p.lon));
      chain = chain.concat((forward ? points : points.reverse()).slice(1));
      tail = forward ? way.nodes[way.nodes.length - 1] : way.nodes[0];
    }
    if (tail === head) result.push(chain);
  }
  return result;
}
const area = (ring: Point[]) =>
  Math.abs(
    ring.reduce((sum, [x, y], i) => {
      const [nx, ny] = ring[(i + 1) % ring.length];
      return sum + (x * ny - nx * y);
    }, 0) / 2,
  );
function simplify(points: Point[], epsilon: number): Point[] {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let far = -1;
    let worst = epsilon;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const distance =
        Math.abs((by - ay) * points[i][0] - (bx - ax) * points[i][1] + bx * ay - by * ax) / length;
      if (distance > worst) {
        worst = distance;
        far = i;
      }
    }
    if (far > -1) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
const all = rings(await load());
const sized = all.map((ring) => ({ ring, km2: area(ring) })).sort((a, b) => b.km2 - a.km2);
const island = sized[0];
// Martinique covers about 1,128 km². A wrong stitch or a missing way would be far off.
if (island.km2 < 1050 || island.km2 > 1200)
  throw new Error(`Main island area ${island.km2.toFixed(0)} km² is not Martinique's ~1,128 km².`);
const kept = sized.filter((item) => item.km2 >= 1.5);
// A closed ring has identical ends, so split it at the point farthest from the start first.
function simplifyRing(ring: Point[], epsilon: number): Point[] {
  const open = ring.slice(0, -1);
  let split = 1;
  for (let i = 1; i < open.length; i++)
    if (
      Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]) >
      Math.hypot(open[split][0] - open[0][0], open[split][1] - open[0][1])
    )
      split = i;
  return [
    ...simplify(open.slice(0, split + 1), epsilon).slice(0, -1),
    ...simplify([...open.slice(split), open[0]], epsilon).slice(0, -1),
  ];
}
const simplified = kept.map((item) => simplifyRing(item.ring, 0.05));
const xs = simplified.flat().map((p) => p[0]);
const ys = simplified.flat().map((p) => p[1]);
const pad = 3;
const minX = Math.min(...xs) - pad;
const minY = Math.min(...ys) - pad;
const scale = 10;
const fix = (value: number) => Math.round(value * scale * 10) / 10;
const place = ([x, y]: Point): Point => [fix(x - minX), fix(y - minY)];
const coast = simplified
  .map((ring) => 'M' + ring.map((p) => place(p).join(' ')).join('L') + 'Z')
  .join('');
const width = fix(Math.max(...xs) + pad - minX);
const height = fix(Math.max(...ys) + pad - minY);
const landmarks = [
  { id: 'fort-de-france', lat: 14.6161, lng: -61.0588 },
  { id: 'saint-pierre', lat: 14.7415, lng: -61.1775 },
  { id: 'montagne-pelee', lat: 14.8111, lng: -61.1644 },
  { id: 'les-salines', lat: 14.4025, lng: -60.8758 },
].map((item) => ({ id: item.id, at: place(project(item.lat, item.lng)) }));
const pointCount = simplified.reduce((sum, ring) => sum + ring.length, 0);
const source = `// Generated by scripts/build-coastline.ts from OpenStreetMap coastline ways (natural=coastline).
// © OpenStreetMap contributors, available under the Open Database License (ODbL). Do not edit.
export const coastline = {
  viewBox: '0 0 ${width} ${height}',
  width: ${width},
  height: ${height},
  path: '${coast}',
  landmarks: ${JSON.stringify(landmarks)},
} as const;
`;
await writeFile('resources/js/lib/martinique-coast.ts', source);
console.log(
  `Rings found ${all.length}; kept ${kept.length} (>= 1.5 km²). Main island ${island.km2.toFixed(0)} km² (expected ~1,128).`,
);
console.log(
  `Extent ${(Math.max(...xs) - Math.min(...xs)).toFixed(1)} x ${(Math.max(...ys) - Math.min(...ys)).toFixed(1)} km; ${pointCount} points; path ${(coast.length / 1024).toFixed(1)} KB.`,
);
console.log('Landmarks:', JSON.stringify(landmarks));
