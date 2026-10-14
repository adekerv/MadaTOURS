# Catalogue verification

The catalogue contains 364 records: 354 public (72 restaurants and 282 activities) and 10 drafts. The September 24 expansion added 337 source-backed public entries across 29 communes. Each published record has a source URL, a check date, and a list of the fields supported by that source. A source supporting a name or address does not establish all other details. Coordinates remain approximate; confirm the entrance with the venue.

Unsupported numerical ratings were removed. Opening hours appear only when a cited source states them, labelled as the source's own words unless the source gives a structured schedule (see [source facts](SOURCES-AND-AUDIT.md)). Forty published places show a real photograph of the place itself, mostly from Wikimedia Commons, each credited in [photo credits](../public/photos/CREDITS.md). A photo supplied by a business is shown only with a recorded permission, managed under **Photos** in the admin dashboard, and visitors can report a wrong photo.

Stock photographs are used again, but solely as labelled illustrations. A place without its own photo shows either an icon tile or a free-licence stock photo of its activity or landscape, badged “Illustrative photo · not this place” (AI images: “AI-generated image · not this place”). A stock photo is never presented as a venue's photo and never shows a recognisable named place. Restaurants, heritage sites, distilleries, yole, bèlè and art keep icon tiles until the place's own photo is obtained. Each place's subject is set in `resources/content/photo-subjects.json`; the images, labels and credits are in `resources/content/photo-library.json` (see [photo library credits](../public/assets/placeholders/CREDITS.md)).

## Specific corrections

- Cascade de Didier is marked restricted following the local tourism authority's nature map. It is excluded from day-plan additions and directions. It remains visible as an access warning, not a recommended hike.
- Montagne Pelée uses its geographical name and a general mountain description rather than implying one verified trail entrance.
- Laser West's listing follows its official West Paradise destination.
- Hippopotamus uses its La Galleria identity; Torii Sushi spelling follows the tourism listing.
- Balata's map position was corrected from the original catalogue, but is still an approximate site point.

## Draft entries needing owner verification

Piliers du Sud, Cinéma Le Rex, Plaza Bowling d’Acajou, the unspecified McDonald's branch, Burger King Ducos, Chez Fredo Sainte-Luce and Le Balaou Sainte-Luce remain unpublished because their exact identity/location could not be adequately corroborated. This does not mean they are closed or nonexistent. Their records remain in the seed and database for review. Three newly researched records (Habitation La Salle, Musée du Père Pinchon and Rando/Training/Brunch) are also held as drafts because their source map points need correction.

Before publishing a draft, confirm its official name, location/entrance, operating status, category and description. Add direct sources with checked dates and field names. Then update the Supabase record, including `published=true`. The current admin UI adds/deletes entries; detailed source and publication editing is performed in Supabase Table Editor.

The current seed includes the expansion. Run `npm run db:prepare` after reviewed seed changes. Existing databases intentionally do not overwrite their catalogue on setup reruns. The reviewed expansion can be applied with `npm run catalogue:import -- --apply`; see [research and import instructions](CATALOGUE-RESEARCH.md). Obtain additional licensed photos with clear authorship and retain their license requirements.
