<?php

namespace Tests\Unit;

use App\Services\PlaceSearch;
use PHPUnit\Framework\TestCase;

class PlaceSearchTest extends TestCase
{
    public function test_radius_filters_and_sorts_by_distance_with_stable_ties(): void
    {
        $places = [
            ['id' => 3, 'lat' => 0, 'lng' => 1],
            ['id' => 2, 'lat' => 0, 'lng' => 0],
            ['id' => 1, 'lat' => 0, 'lng' => 0],
        ];
        $results = (new PlaceSearch)->nearby($places, 0, 0, 100);
        $this->assertSame([1, 2], array_column($results, 'id'));
        $this->assertEquals(0, $results[0]['distance']);
        $results = (new PlaceSearch)->nearby($places, 0, 0, 120);
        $this->assertEqualsWithDelta(111.195, $results[2]['distance'], 0.01);
        $this->assertArrayNotHasKey('distance', $places[0]);
    }

    public function test_antipodal_coordinates_have_a_finite_distance(): void
    {
        $results = (new PlaceSearch)->nearby([['id' => 1, 'lat' => -90, 'lng' => 180]], 90, 0, 21000);
        $this->assertTrue(is_finite($results[0]['distance']));
    }
}
