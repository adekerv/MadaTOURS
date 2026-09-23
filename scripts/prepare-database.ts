import { readFile, writeFile } from 'node:fs/promises';
import places from '../src/data/places.json';
const migration = await readFile(
  new URL('../supabase/migrations/202609230001_madatours.sql', import.meta.url),
  'utf8',
);
const json = JSON.stringify(places).replaceAll("'", "''");
const sql = `BEGIN;\nSELECT pg_advisory_xact_lock(23092026);\n${migration}\n
-- Seed once. Re-running setup preserves edits and deliberately deleted places.
DO $seed$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mt_metadata WHERE key = 'catalogue_seeded') THEN
    INSERT INTO public.mt_places(id,name,type,lat,lng,location,description,description_fr,rating,hours,tags,image,photo_credit,sources,access,published)
    SELECT p.id,p.name,p.type,p.lat,p.lng,p.location,p.description,p.description_fr,p.rating,p.hours,COALESCE(p.tags,'[]'::jsonb),p.image,p.photo_credit,COALESCE(p.sources,'[]'::jsonb),COALESCE(p.access,'unknown'),COALESCE(p.published,true)
    FROM jsonb_to_recordset('${json}'::jsonb) AS p(id bigint,name text,type text,lat double precision,lng double precision,location text,description text,description_fr text,rating double precision,hours text,tags jsonb,image text,photo_credit jsonb,sources jsonb,access text,published boolean)
    ON CONFLICT(id) DO NOTHING;
    PERFORM setval(pg_get_serial_sequence('public.mt_places','id'),GREATEST(COALESCE((SELECT max(id) FROM public.mt_places),1),(SELECT last_value FROM public.mt_places_id_seq)),true);
    INSERT INTO public.mt_metadata(key,value) VALUES('catalogue_seeded','1');
  END IF;
END;
$seed$;
COMMIT;\n`;
await writeFile(new URL('../supabase/setup.sql', import.meta.url), sql);
console.log(
  'Prepared supabase/setup.sql. Review it, then run it in your Supabase SQL Editor. No remote changes were made.',
);
