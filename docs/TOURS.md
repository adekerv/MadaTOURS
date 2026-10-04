# Tours and road routes

A **tour** is an ordered route between published places that an administrator curates. Published tours appear in the
"Island tours" section of the homepage; a visitor opens one to see the route on a map and the stops in order.

## Saving a tour

Administrators manage tours in **Manage places → Tours** (`resources/js/components/admin/TourManager.tsx`). The API is
admin-only for writes (`app/Http/Controllers/TourController.php`) and the `mt_tours` table enforces the same rule in
Postgres with row-level security (`database/schema/tours.sql`).

| Route                                     | What it does                          |
| ----------------------------------------- | ------------------------------------- |
| `GET /api/tours`                          | Published tours, public, no session.  |
| `GET /api/moderation/tours`               | Every tour including drafts (admin).  |
| `POST /api/tours`, `POST /api/tours/{id}` | Create or edit (admin).               |
| `POST /api/tours/{id}/route`              | Ask for the road route again (admin). |
| `DELETE /api/tours/{id}`                  | Delete (admin).                       |

## How the road route works

When a tour is saved, the server asks [OpenRouteService](https://openrouteservice.org) once for the driving route
through its stops (`app/Services/OpenRouteService.php`, `app/Services/TourRoutes.php`) and stores the answer on the
tour: the GeoJSON line, the distance and the driving time. Visitors never trigger routing; the map draws the stored
line (`resources/js/components/planner/TripRouteMap.tsx`).

- **Only changed stops ask again.** A fingerprint of the stops in order is stored with the route. Renaming a tour,
  changing visit times or publishing it reuses the stored road. Reordering or changing the places asks once more.
- **A failure never blocks saving.** With no `ORS_API_KEY`, a refused request, an outage or an answer that is not a
  route, the tour is saved with no road line and the map draws straight lines between the stops. The reason is logged
  as a warning (never the key). The fingerprint is left empty, so saving the tour again after the key is added tries
  again.
- **Recalculate.** The admin list has a "Recalculate route" button per tour, and
  `php artisan tours:compute-routes` fills in every tour that has no road route yet (`--all` redoes every tour,
  `--id=3` limits it to one). The command pauses `ORS_DELAY_MS` (1600 ms) between tours to stay under the free plan's
  per-minute limit.
- **A place removed later** is shown as "This place is no longer listed", and the map then draws straight lines
  between the remaining stops, because the stored road would still pass through the missing place.

### Configuration

| Variable       | Default                                   | Meaning                                                                                                                                                                  |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ORS_API_KEY`  | empty                                     | Free key from openrouteservice.org. Never commit it.                                                                                                                     |
| `ORS_BASE_URL` | `https://api.heigit.org/openrouteservice` | OpenRouteService moved from `api.openrouteservice.org` (shutdown window November 2026); the same key works on the new host. Only change this for a self-hosted instance. |
| `ORS_TIMEOUT`  | `10`                                      | Seconds to wait for an answer.                                                                                                                                           |
| `ORS_DELAY_MS` | `1600`                                    | Pause between tours when computing in bulk.                                                                                                                              |

OpenRouteService asks that routes it provides are credited: "© openrouteservice.org by HeiGIT | Map data © OpenStreetMap
contributors". The credit is under the map in each tour with a road route, in the site footer, and in the About and
Privacy pages. Only the coordinates of a tour's stops leave the server, and only when an administrator saves a tour.

## Maps on tablets

Phones keep a still route map so a finger moving over it scrolls the page. Tablets (a touch device whose screen is at
least 600 CSS pixels on its short side, `resources/js/lib/touch.ts`) get an interactive map: two fingers move and zoom
it, one finger still scrolls the page, and a short hint ("Use two fingers to move the map") appears when one finger
swipes over the map. Zoom buttons are shown as an alternative to the gestures. Desktop keeps drag, buttons and no
wheel zoom.

## Tests

- `tests/Feature/TourTest.php`: fakes the routing HTTP calls (success, missing key, failure, malformed answer,
  unchanged stops, recalculation, the command, permissions, validation).
- `tests/tours.test.ts`: the same flows through real Laravel and PostgreSQL with row-level security.
- `tests/e2e/tours.spec.ts`: an administrator saves a tour in the browser, visitors see the road, a routing outage
  falls back to straight lines, tablet gestures through Chromium's touch input, and the phone map stays still.
- `tests/support/provider.ts` stands in for OpenRouteService; `POST /__test/ors` switches it between `ok`, `fail` and
  `garbage`.
