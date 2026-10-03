import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env', '.env.local'], quiet: true });
export interface SourceRef {
  url: string;
  title: string;
  fields: string[];
  checkedAt: string;
}
export interface PlaceRecord {
  id: number;
  name: string;
  type: 'restaurant' | 'activity';
  lat: number;
  lng: number;
  location: string;
  description: string;
  description_fr: string | null;
  tags: string[];
  sources: SourceRef[];
  published: boolean;
  access: string;
  hours: string | null;
  details?: Record<string, unknown> | null;
  opening_periods?: { day: number; opens: number; closes: number }[] | null;
  listing_status?: string;
  archived?: boolean;
}
/** The maintainer's local calendar date, so a late-evening run is not stamped with tomorrow's UTC date. */
export const today = () => new Date().toLocaleDateString('sv-SE');
export function hasLiveDatabase() {
  return Boolean(
    process.env.SUPABASE_URL?.startsWith('https://') && process.env.SUPABASE_SECRET_KEY,
  );
}
export function liveClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
/** Every place, drafts included, from the live database when configured, otherwise from the bundled seed. */
export async function loadPlaces(
  options: { seed?: boolean } = {},
): Promise<{ places: PlaceRecord[]; origin: 'live' | 'seed' }> {
  if (!options.seed && hasLiveDatabase()) {
    const client = liveClient();
    const places: PlaceRecord[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from('mt_places')
        .select('*')
        .order('id')
        .range(offset, offset + 499);
      if (error) throw new Error(`Could not read places: ${error.message}`);
      places.push(...(data as PlaceRecord[]));
      if (data.length < 500) break;
    }
    return { places, origin: 'live' };
  }
  const seed = JSON.parse(await readFile('database/data/places.json', 'utf8')) as PlaceRecord[];
  return { places: seed, origin: 'seed' };
}
