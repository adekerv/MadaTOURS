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
    public function toArray(Request $request): array
    {
        return Arr::except(parent::toArray($request), ['details', 'sources']);
    }
}
