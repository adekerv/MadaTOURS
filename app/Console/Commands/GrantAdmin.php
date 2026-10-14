<?php

namespace App\Console\Commands;

use App\Exceptions\ApiException;
use App\Services\Supabase\AccountLookup;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class GrantAdmin extends Command
{
    protected $signature = 'admin:grant {email : Email of an existing verified account}';

    protected $description = 'Grant catalogue administration to an existing verified Supabase account';

    public function handle(SupabaseClient $client, AccountLookup $accounts): int
    {
        $email = strtolower(trim($this->argument('email')));
        if (Validator::make(['email' => $email], ['email' => 'required|email:rfc|max:254'])->fails()) {
            $this->error('Enter a valid account email.');

            return self::FAILURE;
        }

        try {
            $user = $accounts->byEmail($email);
            if ($user) {
                if (empty($user['email_confirmed_at'])) {
                    $this->error('Verify the account email before granting administrator access.');

                    return self::FAILURE;
                }
                $rows = $client->request('PATCH', '/rest/v1/mt_profiles?id=eq.'.rawurlencode($user['id']), ['role' => 'admin'], admin: true, headers: ['Prefer' => 'return=representation']);
                if (($rows[0]['role'] ?? null) !== 'admin') {
                    $this->error('The account profile is missing. Run the database migrations first.');

                    return self::FAILURE;
                }
                $this->info('Administrator access granted. Reload the application to refresh its role.');

                return self::SUCCESS;
            }
            $this->error('Create and verify this account in the application first.');
        } catch (ApiException $error) {
            $this->error($error->getMessage());
        }

        return self::FAILURE;
    }
}
