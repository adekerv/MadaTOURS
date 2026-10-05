import type { Place } from '../types';
import { calculateDistance } from './places-utils';
import { travelAllowance, type DayTrip } from './trips';
import type { Language } from '../i18n/core';

export type RoutePoint = {
  /** Position in the trip's list, starting at 1. Unlisted places keep their number so the map matches the list. */
  order: number;
  place: Place;
  minutes: number;
  /** Minutes after midnight on the start day (1440 or more means the next day); null without a start time. */
  arrive: number | null;
  leave: number | null;
};
export type RouteLeg = {
  from: RoutePoint;
  to: RoutePoint;
  km: number;
  /** Direction of travel in degrees clockwise from north. */
  bearing: number;
};
export type TripRoute = {
  points: RoutePoint[];
  /** Only consecutive stops that are both still listed are joined; the line stops at an unlisted place. */
  legs: RouteLeg[];
  start: number | null;
  finish: number | null;
  missing: boolean;
};

export function parseClock(value: string | undefined): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
export function formatClock(minutes: number) {
  const day = Math.floor(minutes / 1440);
  const inDay = minutes - day * 1440;
  const time = `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`;
  return { time, nextDay: day > 0 };
}
export function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLng = (to.lng - from.lng) * rad;
  const y = Math.sin(dLng) * Math.cos(to.lat * rad);
  const x =
    Math.cos(from.lat * rad) * Math.sin(to.lat * rad) -
    Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos(dLng);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

/**
 * The route a trip will follow: its stops in list order, with arrival times when a start
 * time is set. Times use the same travel allowance as the trip summary, so the finish time
 * here always equals the start plus the summary's estimated total.
 */
export function tripRoute(trip: Pick<DayTrip, 'stops' | 'startTime'>, places: Place[]): TripRoute {
  const byId = new Map(places.map((place) => [place.id, place]));
  const start = parseClock(trip.startTime);
  const points: RoutePoint[] = [];
  const legs: RouteLeg[] = [];
  let distance = 0;
  let transfers = 0;
  let visits = 0;
  let missing = false;
  let previous: RoutePoint | undefined;
  trip.stops.forEach((stop, index) => {
    const place = byId.get(stop.placeId);
    if (!place) {
      missing = true;
      visits += stop.minutes;
      previous = undefined;
      return;
    }
    const km = previous
      ? calculateDistance(previous.place.lat, previous.place.lng, place.lat, place.lng)
      : 0;
    if (previous) {
      distance += km;
      transfers++;
    }
    const arrive = start === null ? null : start + visits + travelAllowance(distance, transfers);
    const point: RoutePoint = {
      order: index + 1,
      place,
      minutes: stop.minutes,
      arrive,
      leave: arrive === null ? null : arrive + stop.minutes,
    };
    if (previous)
      legs.push({ from: previous, to: point, km, bearing: bearing(previous.place, place) });
    points.push(point);
    visits += stop.minutes;
    previous = point;
  });
  return {
    points,
    legs,
    start,
    finish: start === null ? null : start + visits + travelAllowance(distance, transfers),
    missing,
  };
}

/** "Sat 4 Oct · 09:00", just the time, just the date, or null when neither is set. */
export function formatStart(
  date: string,
  startTime: string | undefined,
  language: Language,
): string | null {
  const time = parseClock(startTime) === null ? null : startTime!;
  const day = date
    ? new Intl.DateTimeFormat(language, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Martinique',
      }).format(new Date(`${date}T12:00:00-04:00`))
    : null;
  return [day, time].filter(Boolean).join(' · ') || null;
}
