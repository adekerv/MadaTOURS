<?php

namespace App\Console\Commands;

use App\Exceptions\ApiException;
use App\Services\Supabase\AccountLookup;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class SeedAdmin extends Command
{
    protected $signature = 'admin:seed';

    protected $description = 'Create the administrator from ADMIN_EMAIL and ADMIN_PASSWORD when it does not exist yet';

    public function handle(SupabaseClient $client, AccountLookup $accounts): int
    {
        $email = (string) config('admin.email');
        $password = (string) config('admin.password');
        $name = (string) config('admin.name') ?: 'Administrator';
        if (Validator::make(compact('email', 'password', 'name'), [
            'email' => 'required|email:rfc|max:254',
            'password' => 'required|string|min:12|max:128',
            'name' => ['required', 'string', 'max:80', 'not_regex:/[\p{C}<>]/u'],
        ])->fails()) {
            $this->error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12 to 128 characters) in the environment file first.');

            return self::FAILURE;
        }
        if (preg_match('/password|admin|123456|qwerty|azerty/i', $password)) {
            $this->warn('ADMIN_PASSWORD is easy to guess. Sign in and change it from My account as soon as possible.');
        }

        try {
            $existing = $accounts->byEmail($email);
            if ($existing) {
                // Signing up is open to anyone, so an account with this address is only trusted when the configured
                // password opens it. Otherwise a stranger who registered the address first would become administrator.
                if (! $this->passwordOpens($client, $email, $password, $existing['id'])) {
                    $this->error('An account with this email already exists and ADMIN_PASSWORD does not sign in to it. Nothing was changed.');

                    return self::FAILURE;
                }
                $this->makeAdmin($client, $existing['id']);
                $this->info('The administrator already exists. Its role is confirmed and its password was not changed.');

                return self::SUCCESS;
            }
            $created = $client->request('POST', '/auth/v1/admin/users', [
                'email' => $email, 'password' => $password, 'email_confirm' => true,
                'user_metadata' => ['display_name' => $name],
            ], admin: true);
            $id = $created['id'] ?? $created['user']['id'] ?? null;
            if (! is_string($id) || $id === '') {
                throw new ApiException(503, 'The provider did not confirm the new account.');
            }
            $this->makeAdmin($client, $id);
            $this->info('Administrator '.$email.' created. Sign in with ADMIN_PASSWORD.');

            return self::SUCCESS;
        } catch (ApiException $error) {
            $this->error($error->getMessage());

            return self::FAILURE;
        }
    }

    private function passwordOpens(SupabaseClient $client, string $email, string $password, string $id): bool
    {
        try {
            $session = $client->request('POST', '/auth/v1/token?grant_type=password', compact('email', 'password'));
        } catch (ApiException $error) {
            if ($error->status === 400) {
                return false;
            }
            throw $error;
        }
        if (! empty($session['access_token'])) {
            $client->request('POST', '/auth/v1/logout?scope=local', token: $session['access_token']);
        }

        return ($session['user']['id'] ?? null) === $id;
    }

    private function makeAdmin(SupabaseClient $client, string $id): void
    {
        $profiles = $client->request('PATCH', '/rest/v1/mt_profiles?id=eq.'.rawurlencode($id), ['role' => 'admin'], admin: true, headers: ['Prefer' => 'return=representation']);
        if (($profiles[0]['role'] ?? null) !== 'admin') {
            throw new ApiException(503, 'The account exists but administrator access could not be confirmed. Apply the database setup first.');
        }
    }
}
