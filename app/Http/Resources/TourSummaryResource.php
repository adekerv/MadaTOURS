<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/**
 * A tour as the lists need it. The road line can be thousands of points, so lists carry only its length and time,
 * and the tour's own page asks for the full tour (TourResource) when it opens.
 */
class TourSummaryResource extends TourResource
{
    public function toArray(Request $request): array
    {
        $tour = parent::toArray($request);
        if ($tour['route']) {
            unset($tour['route']['geometry']);
        }

        return $tour;
    }
}
