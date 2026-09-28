<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlaceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $p = $this->resource;
        $image = $p['image'] ?? null;

        return array_filter([
            'id' => (int) $p['id'], 'name' => $p['name'], 'type' => $p['type'],
            'lat' => (float) $p['lat'], 'lng' => (float) $p['lng'], 'location' => $p['location'],
            'description' => $p['description'], 'descriptionFr' => $p['description_fr'] ?? null,
            'access' => $p['access'] ?? 'unknown', 'sources' => $p['sources'] ?? [],
            'photoCredit' => $p['photo_credit'] ?? null, 'tags' => $p['tags'] ?? [],
            'rating' => isset($p['rating']) ? (float) $p['rating'] : null, 'hours' => $p['hours'] ?? null,
            'image' => $image && (str_starts_with($image, 'https://') || preg_match('#^/photos/[a-zA-Z0-9._-]+$#', $image)) ? $image : null,
            'distance' => $p['distance'] ?? null,
        ], fn ($value) => $value !== null);
    }
}
