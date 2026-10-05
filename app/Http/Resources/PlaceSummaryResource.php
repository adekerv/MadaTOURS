<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Support\Arr;

/**
 * A place as the lists and the map need it. The practical details and the source list are about two thirds of a
 * place's size and only the place page shows them, so the page asks for the full place (PlaceResource) when opened.
 */
class PlaceSummaryResource extends PlaceResource
{
    /** The columns the list needs, so the database never sends the details and sources at all. */
    public const COLUMNS = 'id,name,type,lat,lng,location,description,description_fr,access,photo_credit,tags,rating,hours,image,community_rating,community_count,google_place_id,opening_periods,hours_source,hours_updated_at,listing_status';

    public function toArray(Request $request): array
    {
        return Arr::except(parent::toArray($request), ['details', 'sources']);
    }
}
