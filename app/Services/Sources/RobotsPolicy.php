<?php

namespace App\Services\Sources;

class RobotsPolicy
{
    public function delay(string $text): float
    {
        // Honor even non-standard crawl-delay directives conservatively across groups.
        preg_match_all('/^\s*crawl-delay\s*:\s*([0-9.]+)/mi', $text, $matches);

        return $matches[1] ? max(array_map('floatval', $matches[1])) : 0;
    }

    public function allows(string $text, string $path): bool
    {
        $groups = [];
        $agents = [];
        $rules = [];
        foreach (preg_split('/\r\n|\n|\r/', $text) as $line) {
            $line = trim(explode('#', $line, 2)[0]);
            if (! str_contains($line, ':')) {
                continue;
            }
            [$key, $value] = array_map('trim', explode(':', $line, 2));
            $key = strtolower($key);
            if ($key === 'user-agent') {
                if ($rules) {
                    $groups[] = [$agents, $rules];
                    $agents = $rules = [];
                }
                $agents[] = strtolower($value);
            } elseif (in_array($key, ['allow', 'disallow'], true) && $agents) {
                $rules[] = [$key, $value];
            }
        }
        $groups[] = [$agents, $rules];
        $specific = array_filter($groups, fn ($group) => in_array('madatoursbot', $group[0], true));
        $selected = $specific ?: array_filter($groups, fn ($group) => in_array('*', $group[0], true));
        $winner = -1;
        $allowed = true;
        $path = $this->normalize($path);
        foreach ($selected as [, $rules]) {
            foreach ($rules as [$kind, $pattern]) {
                if ($pattern === '') {
                    continue;
                }
                $pattern = $this->normalize($pattern);
                $end = str_ends_with($pattern, '$');
                $expression = str_replace('\\*', '.*', preg_quote($end ? substr($pattern, 0, -1) : $pattern, '~'));
                $length = strlen(str_replace(['*', '$'], '', $pattern));
                if (preg_match('~^'.$expression.($end ? '$' : '').'~', $path) && ($length > $winner || ($length === $winner && $kind === 'allow'))) {
                    $winner = $length;
                    $allowed = $kind === 'allow';
                }
            }
        }

        return $allowed;
    }

    private function normalize(string $value): string
    {
        $value = preg_replace_callback('/%([0-9a-f]{2})/i', fn ($m) => preg_match('/[a-z0-9._~-]/i', chr(hexdec($m[1]))) ? chr(hexdec($m[1])) : strtoupper($m[0]), $value);

        return preg_replace_callback('/[\x80-\xff]/', fn ($m) => rawurlencode($m[0]), $value);
    }
}
