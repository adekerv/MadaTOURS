<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Services\AdminLog;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Site content administrators edit without touching code: the homepage hero, contact details, social links and an
 * announcement banner. Empty fields fall back to the app's own wording.
 */
class SiteSettingsController extends Controller
{
    private const PHONE = 'regex:/^\+?[0-9 ().-]{6,30}$/';

    private const LINK = 'regex:/^(https:\/\/[^\s<>"]{3,300}|#[a-z0-9-]{1,40})$/i';

    public function __construct(private SupabaseClient $client) {}

    public function show(): JsonResponse
    {
        $row = $this->client->request('GET', '/rest/v1/mt_site_settings', ['select' => 'content,updated_at', 'id' => 'eq.1'])[0] ?? null;

        return response()->json(self::normalize($row['content'] ?? []) + ['updatedAt' => $row['updated_at'] ?? null]);
    }

    public function update(Request $request, AuthService $auth, AdminLog $log): JsonResponse
    {
        Gate::authorize('administer');
        $input = $request->validate([
            'hero.title' => ['nullable', 'string', 'max:120', 'not_regex:/[\p{C}<>]/u'],
            'hero.titleFr' => ['nullable', 'string', 'max:120', 'not_regex:/[\p{C}<>]/u'],
            'hero.subtitle' => ['nullable', 'string', 'max:300', 'not_regex:/[\p{C}<>]/u'],
            'hero.subtitleFr' => ['nullable', 'string', 'max:300', 'not_regex:/[\p{C}<>]/u'],
            'hero.image' => ['nullable', 'string', 'max:2000', 'regex:/^(https:\/\/[^\s<>"]+|\/photos\/[^\s<>"]+)$/'],
            'contact.email' => ['nullable', 'email:rfc', 'max:254'],
            'contact.phone' => ['nullable', self::PHONE],
            'contact.whatsapp' => ['nullable', self::PHONE],
            'contact.address' => ['nullable', 'string', 'max:300', 'not_regex:/[<>]/u'],
            'social.instagram' => ['nullable', 'url:https', 'max:300'],
            'social.facebook' => ['nullable', 'url:https', 'max:300'],
            'social.tiktok' => ['nullable', 'url:https', 'max:300'],
            'social.youtube' => ['nullable', 'url:https', 'max:300'],
            'announcement.enabled' => ['boolean'],
            'announcement.text' => ['nullable', 'required_if_accepted:announcement.enabled', 'string', 'max:200', 'not_regex:/[\p{C}<>]/u'],
            'announcement.textFr' => ['nullable', 'string', 'max:200', 'not_regex:/[\p{C}<>]/u'],
            'announcement.link' => ['nullable', self::LINK],
            'announcement.tone' => ['nullable', 'in:info,warning,success'],
        ], [
            'contact.phone.regex' => 'Enter the phone number with digits, spaces and an optional +.',
            'contact.whatsapp.regex' => 'Enter the WhatsApp number with digits, spaces and an optional +.',
            'announcement.text.required_if_accepted' => 'Write the announcement before turning it on.',
            'announcement.link.regex' => 'The announcement link must start with https:// or #.',
            'hero.image.regex' => 'The image address must start with https://.',
            'social.*.url' => 'Social links must be full addresses starting with https://.',
        ]);
        $content = self::normalize($input);
        $rows = $this->client->request('PATCH', '/rest/v1/mt_site_settings?id=eq.1', ['content' => $content, 'updated_at' => now()->toIso8601String()], $auth->token(), headers: ['Prefer' => 'return=representation']);
        if (! $rows) {
            throw new ApiException(503, 'The site settings are not set up yet. Apply the database setup first.');
        }
        $log->record('settings.update', 'Updated the site content', 'settings', 1);

        return response()->json($content + ['updatedAt' => $rows[0]['updated_at'] ?? null]);
    }

    /** Every known field, trimmed, with null for anything empty; unknown keys are dropped. */
    private static function normalize(array $content): array
    {
        $text = fn ($value) => is_string($value) && trim($value) !== '' ? trim($value) : null;
        $pick = fn (string $group, array $keys) => array_combine($keys, array_map(fn ($key) => $text($content[$group][$key] ?? null), $keys));

        return [
            'hero' => $pick('hero', ['title', 'titleFr', 'subtitle', 'subtitleFr', 'image']),
            'contact' => $pick('contact', ['email', 'phone', 'whatsapp', 'address']),
            'social' => $pick('social', ['instagram', 'facebook', 'tiktok', 'youtube']),
            'announcement' => [
                'enabled' => (bool) ($content['announcement']['enabled'] ?? false),
                ...$pick('announcement', ['text', 'textFr', 'link']),
                'tone' => in_array($content['announcement']['tone'] ?? null, ['info', 'warning', 'success'], true) ? $content['announcement']['tone'] : 'info',
            ],
        ];
    }
}
