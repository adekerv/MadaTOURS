# Catalogue verification

The starter catalogue contains 24 records: 17 public and 7 drafts. Each published record has a source URL, a September 23, 2026 check date, and a list of the fields supported by that source. A source supporting a name or address does not establish all other details. Coordinates remain approximate; confirm the entrance with the venue.

Unsupported numerical ratings, stock photographs and unverified opening hours were removed. Only source-backed hours for Habitation Clément and Jardin de Balata remain. Three actual location photographs are bundled with attribution; see [photo credits](../public/photos/CREDITS.md). Other places use neutral placeholders until suitable venue photos are obtained.

## Specific corrections

- Cascade de Didier is marked restricted following the local tourism authority's nature map. It is excluded from day-plan additions and directions. It remains visible as an access warning, not a recommended hike.
- Montagne Pelée uses its geographical name and a general mountain description rather than implying one verified trail entrance.
- Laser West's listing follows its official West Paradise destination.
- Hippopotamus uses its La Galleria identity; Torii Sushi spelling follows the tourism listing.
- Balata's map position was corrected from the original catalogue, but is still an approximate site point.

## Draft entries needing owner verification

Piliers du Sud, Cinéma Le Rex, Plaza Bowling d’Acajou, the unspecified McDonald's branch, Burger King Ducos, Chez Fredo Sainte-Luce and Le Balaou Sainte-Luce remain unpublished because their exact identity/location could not be adequately corroborated. This does not mean they are closed or nonexistent. Their records remain in the seed and database for review.

Before publishing a draft, confirm its official name, location/entrance, operating status, category and description. Add direct sources with checked dates and field names. Then update the Supabase record, including `published=true`. The current admin UI adds/deletes entries; detailed source and publication editing is performed in Supabase Table Editor.

To update the starter catalogue, edit `src/data/places.json`, then run `npm run db:prepare`. Existing databases intentionally do not overwrite their catalogue on setup reruns; apply reviewed content updates separately. Obtain additional licensed photos with clear authorship and retain their license requirements.
