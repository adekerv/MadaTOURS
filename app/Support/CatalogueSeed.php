<?php

namespace App\Support;

class CatalogueSeed
{
    /** Shared by Artisan seeding and the portable SQL Editor export. */
    public function sql(): string
    {
        $places = json_decode(file_get_contents(database_path('data/places.json')), true, flags: JSON_THROW_ON_ERROR);
        $json = str_replace("'", "''", json_encode($places, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return <<<SQL
SELECT pg_advisory_xact_lock(23092026);
DO \$seed\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mt_metadata WHERE key = 'catalogue_seeded') THEN
    INSERT INTO public.mt_places(id,name,type,lat,lng,location,description,description_fr,rating,hours,tags,image,photo_credit,sources,access,published)
    SELECT p.id,p.name,p.type,p.lat,p.lng,p.location,p.description,p.description_fr,p.rating,p.hours,COALESCE(p.tags,'[]'::jsonb),p.image,p.photo_credit,COALESCE(p.sources,'[]'::jsonb),COALESCE(p.access,'unknown'),COALESCE(p.published,true)
    FROM jsonb_to_recordset('{$json}'::jsonb) AS p(id bigint,name text,type text,lat double precision,lng double precision,location text,description text,description_fr text,rating double precision,hours text,tags jsonb,image text,photo_credit jsonb,sources jsonb,access text,published boolean)
    ON CONFLICT(id) DO NOTHING;
    PERFORM setval(pg_get_serial_sequence('public.mt_places','id'),GREATEST(COALESCE((SELECT max(id) FROM public.mt_places),1),(SELECT last_value FROM public.mt_places_id_seq)),true);
    INSERT INTO public.mt_metadata(key,value) VALUES('catalogue_seeded','1');
  END IF;
END;
\$seed\$;
SQL;
    }
}
