<?php

namespace App\Console\Commands;

use App\Exceptions\ApiException;
use App\Services\RecoveryCodes;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class ResetAccountPassword extends Command
{
    protected $signature = 'account:reset-password {email : Email of the account} {--new-codes : Also issue a fresh set of recovery codes and print them once}';

    protected $description = 'Set a new password for an account whose owner lost both the password and every recovery code';

    public function handle(SupabaseClient $client, RecoveryCodes $recovery): int
    {
        $email = strtolower(trim($this->argument('email')));
        if (Validator::make(['email' => $email], ['email' => 'required|email:rfc|max:254'])->fails()) {
            $this->error('Enter a valid email address.');

            return self::FAILURE;
        }
        $this->warn('This replaces the password and signs the account out everywhere. Only run it after you have checked the person yourself.');
        // Asked for here and never taken as an option, so it stays out of the shell history.
        $password = (string) $this->secret('New password (at least 12 characters)');
        if (strlen($password) < 12 || strlen($password) > 128) {
            $this->error('The password must be 12 to 128 characters.');

            return self::FAILURE;
        }
        if ($password !== (string) $this->secret('Repeat the new password')) {
            $this->error('The two passwords do not match.');

            return self::FAILURE;
        }

        try {
            $account = $this->find($client, $email);
            if (! $account) {
                $this->error('No account uses this email address.');

                return self::FAILURE;
            }
            $client->request('PUT', '/auth/v1/admin/users/'.rawurlencode($account['id']), ['password' => $password], admin: true);
            $recovery->revokeSessions($account['id']);
            $this->info('The password was replaced and every session of the account was signed out.');
            if ($this->option('new-codes')) {
                $this->line('New recovery codes (shown once, give them to the account owner):');
                foreach ($recovery->replace($account['id']) as $code) {
                    $this->line('  '.$code);
                }
            }

            return self::SUCCESS;
        } catch (ApiException $error) {
            $this->error($error->getMessage());

            return self::FAILURE;
        }
    }

    /** @return array{id: string}|null */
    private function find(SupabaseClient $client, string $email): ?array
    {
        for ($page = 1; ; $page++) {
            $users = $client->request('GET', '/auth/v1/admin/users', ['page' => $page, 'per_page' => 100], admin: true)['users'] ?? [];
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
