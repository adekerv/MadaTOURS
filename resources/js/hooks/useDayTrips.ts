import { useState } from 'react';
import { tripsSchema, type DayTrip } from '../lib/trips';
const key = 'madatours:trips:v1';
function readTrips(): DayTrip[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? tripsSchema.parse(JSON.parse(raw)).trips : [];
  } catch {
    return [];
  }
}
export function useDayTrips() {
  const [trips, setTrips] = useState(readTrips);
  const [storageError, setStorageError] = useState(false);
  const saveTrips = (next: DayTrip[]) => {
    const data = tripsSchema.parse({ version: 1, trips: next });
    setTrips(data.trips);
    try {
      localStorage.setItem(key, JSON.stringify(data));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  return { trips, saveTrips, storageError };
}
