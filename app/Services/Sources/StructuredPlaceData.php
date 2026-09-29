<?php

namespace App\Services\Sources;

use DOMDocument;
use DOMXPath;
use Illuminate\Support\Str;

class StructuredPlaceData
{
    public function extract(string $html, string $placeName): array
    {
        $document = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        $nodes = (new DOMXPath($document))->query('//script[@type="application/ld+json"]');
        foreach ($nodes as $node) {
            $data = json_decode($node->textContent, true);
            foreach ($this->entities(is_array($data) ? $data : []) as $entity) {
                // Exact normalized names avoid silently enriching a venue from a directory's other listing.
                if ($this->name($entity['name'] ?? '') !== $this->name($placeName)) {
                    continue;
                }
                $periods = $this->hours($entity['openingHoursSpecification'] ?? []);
                $image = $entity['image'] ?? null;
                if (is_array($image) && array_is_list($image)) {
                    $image = $image[0] ?? null;
                }
                $photo = is_array($image) ? ($image['contentUrl'] ?? $image['url'] ?? null) : (is_string($image) ? $image : null);
                $license = is_array($image) ? ($image['license'] ?? null) : null;
                $credit = is_array($image) ? ($image['creator'] ?? $image['author'] ?? $image['copyrightHolder'] ?? null) : null;
                $author = is_array($credit) ? ($credit['name'] ?? null) : $credit;

                return ['periods' => $periods, 'image' => is_string($photo) && str_starts_with($photo, 'https://') ? $photo : null,
                    'license' => is_string($license) ? $license : null, 'author' => is_string($author) ? mb_substr($author, 0, 200) : null];
            }
        }

        return [];
    }

    private function name(mixed $value): string
    {
        return is_string($value) ? preg_replace('/[^a-z0-9]/', '', strtolower(Str::ascii($value))) : '';
    }

    private function entities(array $data): array
    {
        if (array_is_list($data)) {
            return array_merge(...array_map(fn ($item) => is_array($item) ? $this->entities($item) : [], $data));
        }

        return [$data, ...$this->entities(is_array($data['@graph'] ?? null) ? $data['@graph'] : [])];
    }

    public function hours(array $specifications): array
    {
        if (! array_is_list($specifications)) {
            $specifications = [$specifications];
        }
        $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        $periods = [];
        foreach (array_slice($specifications, 0, 28) as $spec) {
            // Seasonal validity needs manual review; avoid publishing a stale seasonal schedule.
            if (! is_array($spec) || isset($spec['validFrom']) || isset($spec['validThrough'])) {
                continue;
            }
            $opens = $this->minutes($spec['opens'] ?? '');
            $closes = $this->minutes($spec['closes'] ?? '');
            if ($opens === null || $closes === null || $opens === $closes) {
                continue;
            }
            foreach ((array) ($spec['dayOfWeek'] ?? []) as $value) {
                $day = array_search(basename((string) $value), $days, true);
                if ($day === false) {
                    continue;
                }
                $periods[] = ['day' => $day, 'opens' => $opens, 'closes' => $closes < $opens ? 1440 : $closes];
                if ($closes < $opens && $closes > 0) {
                    $periods[] = ['day' => ($day + 1) % 7, 'opens' => 0, 'closes' => $closes];
                }
            }
        }

        return array_slice($periods, 0, 28);
    }

    private function minutes(mixed $value): ?int
    {
        if (! is_string($value) || ! preg_match('/^(\d{2}):(\d{2})(?::00)?$/', $value, $m) || (int) $m[1] > 24 || (int) $m[2] > 59 || ((int) $m[1] === 24 && (int) $m[2] !== 0)) {
            return null;
        }

        return (int) $m[1] * 60 + (int) $m[2];
    }
}
