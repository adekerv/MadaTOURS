<?php

namespace App\Services\Sources;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class PublicSourceClient
{
    public function addresses(string $host): array
    {
        $records = dns_get_record($host, DNS_A | DNS_AAAA);

        return array_values(array_filter(array_map(fn ($r) => $r['ip'] ?? $r['ipv6'] ?? null, $records ?: [])));
    }

    public function validate(string $url): array
    {
        $parts = parse_url($url);
        $host = strtolower($parts['host'] ?? '');
        if (($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['pass']) || (($parts['port'] ?? 443) !== 443) || ! preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $host) || preg_match('/(^|\.)(google\.[a-z.]+|googleapis\.com|googleusercontent\.com|gstatic\.com|goo\.gl|maps\.app\.goo\.gl)$/', $host)) {
            throw new RuntimeException('Source URL is not permitted.');
        }
        $addresses = $this->addresses($host);
        if (! $addresses) {
            throw new RuntimeException('Source DNS is unavailable.');
        }
        foreach ($addresses as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) || str_starts_with(strtolower($ip), '::ffff:')) {
                throw new RuntimeException('Private network sources are forbidden.');
            }
        }

        return [$host, $addresses[0]];
    }

    public function get(string $url): Response
    {
        [$host, $ip] = $this->validate($url);

        // Pin the validated address to prevent DNS rebinding. Redirects are not followed.
        return Http::withUserAgent('MadaToursBot/1.0 (+https://mada-tours.vercel.app/#about)')->accept('text/html,text/plain,application/ld+json')->withoutRedirecting()->connectTimeout(5)->timeout(12)->withOptions([
            'curl' => [CURLOPT_RESOLVE => [$host.':443:'.(str_contains($ip, ':') ? '['.$ip.']' : $ip)]],
            'progress' => function ($total, $downloaded) {
                if ($total > 1048576 || $downloaded > 1048576) {
                    throw new RuntimeException('Source response is too large.');
                }
            },
        ])->get($url);
    }
}
