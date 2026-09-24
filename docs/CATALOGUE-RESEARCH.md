# Catalogue expansion — September 24, 2026

Published batch: **337 published additions — 65 restaurants and 272 activities**. The full public catalogue now contains **354 places (72 restaurants, 282 activities)** across **29 communes**. Ten drafts remain unpublished: seven older entries and three new records withheld during the final map-point review. The initial import inserted 340 records; 337 remain public. Seven existing entries received source-backed map-point corrections; their IDs were retained.

## Research method and limits

Research checked 397 public Martinique tourism-board pages and 66 Terres du Centre restaurant pages. Search results were used to discover official sources; the records cite the tourism-board or local tourism-office pages themselves. The source date means the page was consulted, not that someone contacted or visited every business or established it is currently open.

Sources include the [Martinique tourism board](https://www.martinique.org/fr/bars-restaurants/restaurants), its culture, nature, wellness and sports directories, and [Terres du Centre](https://terresducentremartinique.fr/se-restaurer/). Individual links and supported fields are included in every new listing. Factual names, addresses, published business telephone numbers and map points are recorded; English and French summaries were written for this guide. Marketing descriptions and directory photographs were not copied.

Listings cover restaurants, beaches, gardens, heritage, museums, rum estates, food experiences, boating, diving, watersports, guided outings, sports, wellness and nightlife. This is a substantial directory expansion, not an exhaustive inventory of Martinique. Operating status, prices, seasonal availability, transport, accessibility and suitable licensed venue photographs remain ongoing editorial work. No unverified numerical ratings, hours or prices were invented for new entries.

Map points for providers can be their office or contact point. Confirm the actual departure, meeting point or entrance directly. Natural-site listings do not guarantee safe conditions or unrestricted access. Existing restrictions, including Cascade de Didier, remain in place.

Duplicate and related listings were consolidated where supported: Denebola, Habitation Clément, HSE, Depaz, RDV Caraïbes, Lagon Évasion and Les Salines. Tartane is grouped under La Trinité in the commune filter, and apostrophe variants do not split a commune into two filters.

## Apply to an existing Supabase database

The live project has already received this batch. Do not paste secrets into chat or commit `.env.local`.

```sh
# Read-only preview using SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local:
npm run catalogue:import
# Apply only if the preview has reviewed pending additions/corrections:
npm run catalogue:import -- --apply
# For a deliberate maintainer refresh of the bundled venue seed:
npm run catalogue:import -- --apply --sync-seed
npm run db:prepare
```

The importer validates the batch, backs up venue rows to ignored `.data/catalogue-import/`, lets PostgreSQL assign IDs, and records source-to-ID receipts in `mt_metadata`. It does not modify accounts or saved places. Completed import receipts prevent reruns from recreating deliberately deleted entries. Existing corrections require matching before-values and are guarded again during the update. Conflicts stop for review.

Run only one importer at a time. A local exclusive lock prevents overlapping runs on the same machine; it is not a distributed lock. If a process is interrupted, first confirm it has stopped before removing its lock. Additions are a single insert request; receipts and corrections are separate requests. After a network failure, preview and inspect the database before retrying. Successful inserts can be recognized by their source links if the receipt write was interrupted. Do not automatically restore the entire backup over newer edits.

`--sync-seed` copies venue fields (including unpublished venue drafts) into the local starter seed; review its diff before committing. It does not export user tables. A brand-new database gets the expanded seed via `supabase/setup.sql`. Setup reruns intentionally preserve existing edits/deletions and do not perform this import.

## Listings held for clarification

These source issues were found during research. Exclusion does not establish that a business is closed.

| Listing                                                                                                        | Why held                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [Bao Beach](https://www.martinique.org/fr/bars-restaurants/restaurants/bao-beach)                              | Directory latitude and longitude are reversed; entrance point needs independent confirmation.                  |
| [Gwa-Gwa Resto](https://www.martinique.org/fr/bars-restaurants/restaurants/gwa-gwa-resto)                      | Missing coordinates.                                                                                           |
| [Le P'ti Bateau](https://www.martinique.org/fr/bars-restaurants/restaurants/le-pti-bateau)                     | Missing coordinates.                                                                                           |
| [Hector Charpentier](https://www.martinique.org/fr/que-faire/culture-patrimoine/hector-charpentier)            | Source heading names Hector but description names Henri; identity needs clarification.                         |
| [L'herboristerie Créole](https://www.martinique.org/fr/que-faire/sites-naturels-publics/lherboristerie-creole) | Listed Gros-Morne venue has a coordinate in the Lamentin area; verify the visitor address.                     |
| [Sun And Sup](https://www.martinique.org/fr/que-faire/sports-activites-nautiques/sun-and-sup)                  | Town/map point indicate Le Robert but described departures are in Le Marin; meeting point needs clarification. |
| [Habitation La Salle](https://www.martinique.org/fr/que-faire/culture-patrimoine/habitation-la-salle)          | Generic island-centre map point conflicts with the venue town.                                                 |
| [Musee Du Pere Pinchon](https://www.martinique.org/fr/que-faire/culture-patrimoine/musee-du-pere-pinchon)      | Generic island-centre map point conflicts with the venue town.                                                 |
| [Rando/Training/Brunch](https://www.martinique.org/fr/que-faire/randonnees/randotrainingbrunch)                | Organiser and meeting point need clarification; the map uses the same point as Les Pitons du Carbet.           |

Rando Training Brunch also needs an identifiable organiser and confirmed meeting point before inclusion. La Mandoline’s own site announced an annual closure until October 1 at the time of research; its map point and reopening should be confirmed in a future pass.

## Further restaurant leads

The following tourism-office pages are leads, not published recommendations. Their identity, visitor address and map point still need individual review; some may overlap with venues already present under another name.

- [Apicius](https://terresducentremartinique.fr/restaurant/apicius/)
- [Baywatch Marina](https://terresducentremartinique.fr/restaurant/baywatch-marina/)
- [Bleu Marine](https://terresducentremartinique.fr/restaurant/bleu-marine/)
- [Boa Rosa](https://terresducentremartinique.fr/restaurant/boa-rosa/)
- [Bolibar](https://terresducentremartinique.fr/restaurant/bolibar/)
- [Boule de neige](https://terresducentremartinique.fr/restaurant/boule-de-neige/)
- [Brasserie du Théâtre](https://terresducentremartinique.fr/restaurant/brasserie-du-theatre/)
- [Chez Carole](https://terresducentremartinique.fr/restaurant/chez-carole/)
- [Chez Geneviève](https://terresducentremartinique.fr/restaurant/chez-genevieve/)
- [Chez Hector](https://terresducentremartinique.fr/restaurant/chez-hector/)
- [Chez Luis](https://terresducentremartinique.fr/restaurant/chez-luis/)
- [Churrasco Steak House](https://terresducentremartinique.fr/restaurant/churrasco-steak-house/)
- [Club Seven](https://terresducentremartinique.fr/restaurant/club-seven/)
- [Comtesse du Barry](https://terresducentremartinique.fr/restaurant/comtesse-du-barry/)
- [Djol Dou](https://terresducentremartinique.fr/restaurant/djol-dou/)
- [Favela](https://terresducentremartinique.fr/restaurant/favela/)
- [Fuji Sushi](https://terresducentremartinique.fr/restaurant/fuji-sushi/)
- [Ganesh Store](https://terresducentremartinique.fr/restaurant/ganesh-store/)
- [Grenade & Basilic](https://terresducentremartinique.fr/restaurant/grenade-basilic/)
- [Hippopotamus](https://terresducentremartinique.fr/restaurant/hippopotamus/)
- [La Boucherie](https://terresducentremartinique.fr/restaurant/la-boucherie/)
- [La Ferme Perrine](https://terresducentremartinique.fr/restaurant/la-ferme-de-perrine/)
- [La Luciole](https://terresducentremartinique.fr/restaurant/la-luciole/)
- [La Tavola Italiana](https://terresducentremartinique.fr/restaurant/la-tavola-italiana/)
- [L'Ardoise Bistrot](https://terresducentremartinique.fr/restaurant/lardoise-bistrot/)
- [L'arobase](https://terresducentremartinique.fr/restaurant/larobase/)
- [Le Central](https://terresducentremartinique.fr/restaurant/le-central/)
- [Le Château](https://terresducentremartinique.fr/restaurant/le-chateau/)
- [Le Cloud](https://terresducentremartinique.fr/restaurant/le-cloud/)
- [Le Dôme](https://terresducentremartinique.fr/restaurant/le-dome/)
- [Le Jardin des Alizés](https://terresducentremartinique.fr/restaurant/le-jardin-des-alizees-squash-htl/)
- [Le Joséphine](https://terresducentremartinique.fr/restaurant/le-josephine/)
- [Le Laurier](https://terresducentremartinique.fr/restaurant/le-laurier/)
- [Le Metro](https://terresducentremartinique.fr/restaurant/le-metro/)
- [Le Spice](https://terresducentremartinique.fr/restaurant/le-spice/)
- [Le Ti Saint Louis](https://terresducentremartinique.fr/restaurant/le-ti-saint-louis/)
- [LE TIBO](https://terresducentremartinique.fr/restaurant/le-tibo/)
- [Les Fines Bouches](https://terresducentremartinique.fr/restaurant/les-fines-bouches/)
- [Mille et une Brindilles](https://terresducentremartinique.fr/restaurant/mille-et-une-brindilles/)
- [Nuevo Mejico](https://terresducentremartinique.fr/restaurant/nuevo-mejico/)
- [Sri Ganesha](https://terresducentremartinique.fr/restaurant/sri-ganesha/)
- [Sunset 972](https://terresducentremartinique.fr/restaurant/sunset-972/)
- [Sushi Wave](https://terresducentremartinique.fr/restaurant/sushi-wave/)
- [Tata Suzette](https://terresducentremartinique.fr/restaurant/tata-suzette/)
- [The Yellow](https://terresducentremartinique.fr/restaurant/the-yellow/)
- [Torii Sushi](https://terresducentremartinique.fr/restaurant/torii-sushi-2/)
- [Torii Sushi](https://terresducentremartinique.fr/restaurant/torii-sushi/)
- [Villa Factory](https://terresducentremartinique.fr/restaurant/villa-factory/)

## Published additions by commune

| Commune           | Added places |
| ----------------- | -----------: |
| Case-Pilote       |            5 |
| Ducos             |            5 |
| Fort-de-France    |           33 |
| Grand’Rivière     |            2 |
| Gros-Morne        |            4 |
| La Trinité        |            9 |
| Le Carbet         |           15 |
| Le Diamant        |            8 |
| Le François       |           28 |
| Le Lamentin       |           13 |
| Le Lorrain        |            1 |
| Le Marin          |           33 |
| Le Morne-Rouge    |            5 |
| Le Morne-Vert     |            1 |
| Le Prêcheur       |            4 |
| Le Robert         |           13 |
| Le Vauclin        |           11 |
| Les Anses-d’Arlet |           19 |
| Les Trois-Îlets   |           42 |
| L’Ajoupa-Bouillon |            1 |
| Macouba           |            1 |
| Rivière-Pilote    |            6 |
| Rivière-Salée     |            2 |
| Saint-Joseph      |            6 |
| Saint-Pierre      |           13 |
| Sainte-Anne       |           20 |
| Sainte-Luce       |           17 |
| Sainte-Marie      |            7 |
| Schœlcher         |           13 |
