<?php

namespace App\Services\Supabase;

/** Finds Supabase Auth accounts by email through the admin API, which has no email filter of its own. */
class AccountLookup
{
    public function __construct(private SupabaseClient $client) {}

    /** @return array<string, mixed>|null The provider's account record, or null when no account uses the address */
    public function byEmail(string $email): ?array
    {
        $email = strtolower(trim($email));
        for ($page = 1; ; $page++) {
            $users = $this->client->request('GET', '/auth/v1/admin/users', ['page' => $page, 'per_page' => 100], admin: true)['users'] ?? [];
            foreach ($users as $user) {
                if (strtolower($user['email'] ?? '') === $email) {
                    return $user;
                }
            }
            if (count($users) < 100) {
                return null;
            }
        }
    }
}
