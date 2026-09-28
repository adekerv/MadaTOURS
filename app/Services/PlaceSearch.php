<?php

namespace App\Services;

class PlaceSearch
{
    /** Filter the public catalogue using great-circle distance, in kilometres. */
    public function nearby(array $places, float $latitude, float $longitude, float $radius): array
    {
        foreach ($places as &$place) {
            $a = sin(deg2rad($place['lat'] - $latitude) / 2) ** 2
                + cos(deg2rad($latitude)) * cos(deg2rad($place['lat']))
                * sin(deg2rad($place['lng'] - $longitude) / 2) ** 2;
            $place['distance'] = 6371 * 2 * atan2(sqrt(min(1, $a)), sqrt(max(0, 1 - $a)));
        }
        unset($place);
        $places = array_values(array_filter($places, fn ($place) => $place['distance'] <= $radius));
        usort($places, fn ($a, $b) => [$a['distance'], $a['id']] <=> [$b['distance'], $b['id']]);

        return $places;
    }
}
