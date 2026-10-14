<?php

namespace App\Services;

use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The admin activity log. The database records which administrator acted from the session, so an entry can never
 * name someone else. A log that cannot be written never undoes or blocks the action it describes.
 */
class AdminLog
{
    public function __construct(private SupabaseClient $client, private AuthService $auth) {}

    /**
     * @param  string  $action  "area.verb", for example "users.suspend"
     * @param  array<string, scalar|null>  $details  Small facts worth keeping; never passwords or tokens
     */
    public function record(string $action, string $summary, ?string $targetType = null, string|int|null $targetId = null, array $details = []): void
    {
        try {
            $this->client->request('POST', '/rest/v1/rpc/mt_admin_log_write', [
                'action' => $action,
                'target_type' => $targetType,
                'target_id' => $targetId === null ? null : (string) $targetId,
                'summary' => mb_substr($summary, 0, 300),
                'details' => (object) $details,
            ], $this->auth->token());
        } catch (Throwable) {
            Log::warning('An admin action could not be added to the activity log.', ['action' => $action]);
        }
    }
}
