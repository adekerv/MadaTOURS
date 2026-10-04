<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** A tour as the app reads it. The road line is present only when one was worked out. */
class TourResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $row = $this->resource;

        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'nameFr' => $row['name_fr'] ?? null,
            'description' => $row['description'],
            'descriptionFr' => $row['description_fr'] ?? null,
            'published' => (bool) $row['published'],
            'stops' => $row['stops'],
            'route' => ! empty($row['route_geojson']) ? [
                'geometry' => $row['route_geojson'],
                'distanceM' => $row['route_distance_m'],
                'durationS' => $row['route_duration_s'],
            ] : null,
            'routeSource' => ! empty($row['route_geojson']) ? 'road' : 'straight',
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }
}
