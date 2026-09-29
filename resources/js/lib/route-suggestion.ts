import type { Place, UserLocation } from '../types';
import { calculateDistance } from './places-utils';
export type TravelMode = 'drive' | 'walk';
export type SuggestedStop = {
  placeId: number;
  minutes: number;
  arrival: number;
  travel: number;
  wait: number;
  reason: string;
  hoursKnown: boolean;
  closed: boolean;
};
export function travelEstimate(a: UserLocation, b: UserLocation, mode: TravelMode) {
  const km = calculateDistance(a.lat, a.lng, b.lat, b.lng);
  return Math.ceil(
    ((km * (mode === 'walk' ? 1.25 : 1.4)) / (mode === 'walk' ? 4 : 30)) * 60 +
      (mode === 'drive' ? 5 : 0),
  );
}
function opening(place: Place, day: number, arrival: number, duration: number) {
  const periods = place.openingPeriods?.filter((p) => p.day === day);
  if (!place.openingPeriods?.length) return { known: false, wait: 0, closed: false };
  const possible = periods
    ?.map((p) => ({ wait: Math.max(0, p.opens - arrival), end: p.closes }))
    .filter((p) => arrival + p.wait + duration <= p.end && p.wait <= 45)
    .sort((a, b) => a.wait - b.wait)[0];
  return { known: true, wait: possible?.wait ?? 0, closed: !possible };
}
export function routeSchedule(
  stops: { placeId: number; minutes: number }[],
  places: Place[],
  origin: UserLocation,
  mode: TravelMode,
  day: number,
  startMinutes: number,
): SuggestedStop[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  let cursor = origin;
  let time = startMinutes;
  return stops.flatMap((stop) => {
    const place = byId.get(stop.placeId);
    if (!place) return [];
    const travel = travelEstimate(cursor, place, mode);
    const hours = opening(place, day, time + travel, stop.minutes);
    const arrival = time + travel + hours.wait;
    const lunch = place.type === 'restaurant' && arrival >= 11.5 * 60 && arrival <= 14.5 * 60;
    time = arrival + stop.minutes;
    cursor = place;
    return [
      {
        ...stop,
        arrival,
        travel,
        wait: hours.wait,
        hoursKnown: hours.known,
        closed: hours.closed,
        reason: hours.closed
          ? 'This stop may be closed at the estimated arrival time.'
          : lunch
            ? 'A meal stop around lunchtime.'
            : hours.wait
              ? 'A short wait keeps this visit inside its listed hours.'
              : 'Nearby stops are grouped to reduce travel.',
      },
    ];
  });
}
export function suggestRoute(
  places: Place[],
  origin: UserLocation,
  mode: TravelMode,
  day: number,
  startMinutes = 9 * 60,
): SuggestedStop[] {
  let remaining = places.filter(
    (p) =>
      p.access !== 'restricted' &&
      calculateDistance(origin.lat, origin.lng, p.lat, p.lng) <= (mode === 'walk' ? 5 : 25),
  );
  const stops: { placeId: number; minutes: number }[] = [];
  let cursor = origin;
  let time = startMinutes;
  let meal = false;
  while (stops.length < 5 && remaining.length) {
    const ranked = remaining
      .map((place) => {
        const travel = travelEstimate(cursor, place, mode);
        const minutes = 60;
        const hours = opening(place, day, time + travel, minutes);
        const arrival = time + travel + hours.wait;
        const lunch = arrival >= 11.5 * 60 && arrival <= 14.5 * 60;
        const penalty =
          place.type === 'restaurant' ? (meal ? 180 : lunch ? -35 : 90) : lunch && !meal ? 25 : 0;
        return { place, travel, minutes, hours, arrival, score: travel + hours.wait + penalty };
      })
      .filter(
        (c) =>
          !c.hours.closed &&
          c.arrival + c.minutes <= startMinutes + 6 * 60 &&
          c.arrival + c.minutes < 24 * 60,
      )
      .sort((a, b) => a.score - b.score || a.place.id - b.place.id);
    const next = ranked[0];
    if (!next) break;
    stops.push({ placeId: next.place.id, minutes: next.minutes });
    time = next.arrival + next.minutes;
    cursor = next.place;
    meal ||= next.place.type === 'restaurant';
    remaining = remaining.filter((p) => p.id !== next.place.id);
  }
  return routeSchedule(stops, places, origin, mode, day, startMinutes);
}
