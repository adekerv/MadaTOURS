import { coastline } from '../../lib/martinique-coast';
const at = (id: string) => coastline.landmarks.find((item) => item.id === id)!.at;
const route = (from: string, to: string, bend = 0.12) => {
  const [ax, ay] = at(from);
  const [bx, by] = at(to);
  // A gentle arc, so the dotted lines read as journeys rather than rulers.
  const cx = (ax + bx) / 2 - (by - ay) * bend;
  const cy = (ay + by) / 2 + (bx - ax) * bend;
  return `M${ax} ${ay}Q${cx} ${cy} ${bx} ${by}`;
};
const routes = [
  route('fort-de-france', 'saint-pierre'),
  route('saint-pierre', 'montagne-pelee', -0.1),
  route('fort-de-france', 'les-salines', -0.1),
];
/** Martinique's real outline, drawn from OpenStreetMap coastline data, as a quiet hero texture. */
export function CoastlineArt() {
  return (
    <div aria-hidden="true" className="coast-art">
      <svg viewBox={coastline.viewBox} focusable="false">
        <path className="coast-line" d={coastline.path} pathLength={1} />
        <g className="coast-extras">
          {routes.map((d) => (
            <path key={d} className="coast-route" d={d} />
          ))}
          {coastline.landmarks.map(({ id, at: [x, y] }) => (
            <g key={id}>
              <circle className="coast-halo" cx={x} cy={y} r={6} />
              <circle className="coast-dot" cx={x} cy={y} r={2.4} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
