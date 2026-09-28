<?php

namespace App\Console\Commands;

use App\Exceptions\ApiException;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class CreateAdmin extends Command
{
    protected $signature = 'admin:create {email : Administrator email} {--name=Administrator : Display name} {--replace-password : Explicitly replace the password of an existing account}';

    protected $description = 'Provision an administrator and save a generated password in a private, Git-ignored file';

    public function handle(SupabaseClient $client): int
    {
        $email = strtolower(trim($this->argument('email')));
        $name = trim($this->option('name'));
        if (Validator::make(compact('email', 'name'), ['email' => 'required|email:rfc|max:254', 'name' => ['required', 'string', 'max:80', 'not_regex:/[\p{C}<>]/u']])->fails()) {
            $this->error('Enter a valid email and display name.');

            return self::FAILURE;
        }

        try {
            $existing = null;
            for ($page = 1; ; $page++) {
                $users = $client->request('GET', '/auth/v1/admin/users', ['page' => $page, 'per_page' => 100], admin: true)['users'] ?? [];
                foreach ($users as $user) {
                    if (strtolower($user['email'] ?? '') === $email) {
                        $existing = $user;
                        break 2;
                    }
                }
                if (count($users) < 100) {
                    break;
                }
            }
            if ($existing && ! $this->option('replace-password')) {
                $this->error('This account already exists. Use --replace-password only when a password replacement is intended.');

                return self::FAILURE;
            }

            $password = rtrim(strtr(base64_encode(random_bytes(30)), '+/', '-_'), '=');
            $directory = base_path('.data/admin-credentials');
            $file = $directory.'/'.date('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json';
            $record = ['email' => $email, 'password' => $password, 'name' => $name, 'status' => 'pending', 'created_at' => now()->toIso8601String()];
            // Save before changing the provider, so a lost response never loses the generated password.
            $mask = umask(0077);
            try {
                if (! is_dir($directory) && ! mkdir($directory, 0700, true)) {
                    throw new \RuntimeException('Cannot create the private credentials directory.');
                }
                $handle = fopen($file, 'x');
                if (! $handle) {
                    throw new \RuntimeException('Cannot create the private credentials file.');
                }
                try {
                    if (fwrite($handle, json_encode($record, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)."\n") === false) {
                        throw new \RuntimeException('Cannot save the generated credentials.');
                    }
                } finally {
                    fclose($handle);
                }
            } finally {
                umask($mask);
            }

            $payload = [
                'email' => $email, 'password' => $password, 'email_confirm' => true,
                'user_metadata' => [...($existing['user_metadata'] ?? []), 'display_name' => $name],
            ];
            $result = $client->request($existing ? 'PUT' : 'POST', '/auth/v1/admin/users'.($existing ? '/'.$existing['id'] : ''), $payload, admin: true);
            $id = $result['id'] ?? $result['user']['id'] ?? null;
            if (! is_string($id) || ! $id || ($existing && $id !== $existing['id'])) {
                throw new ApiException(503, 'The provider did not confirm the selected account.');
            }
            $profiles = $client->request('PATCH', '/rest/v1/mt_profiles?id=eq.'.rawurlencode($id), ['role' => 'admin'], admin: true, headers: ['Prefer' => 'return=representation']);
            if (($profiles[0]['id'] ?? null) !== $id || ($profiles[0]['role'] ?? null) !== 'admin') {
                throw new ApiException(503, 'The account was saved but administrator access could not be confirmed.');
            }
            $session = $client->request('POST', '/auth/v1/token?grant_type=password', compact('email', 'password'));
            if (($session['user']['id'] ?? null) !== $id || empty($session['access_token'])) {
                throw new ApiException(503, 'The account was saved but password sign-in could not be confirmed.');
            }
            $client->request('POST', '/auth/v1/logout?scope=global', token: $session['access_token']);
            $record['status'] = 'verified';
            $record['user_id'] = $id;
            if (file_put_contents($file, json_encode($record, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)."\n", LOCK_EX) === false) {
                throw new \RuntimeException('Could not update the private credentials receipt.');
            }
            $this->info('Administrator access and the generated password were verified. Sign in again to use the account.');
            $this->line('Private credentials: '.$file);
            $this->comment('This file is excluded from Git. Move the password to your password manager, then remove the local copy.');

            return self::SUCCESS;
        } catch (ApiException $error) {
            $this->error($error->getMessage());
        } catch (\Throwable) {
            $this->error('Administrator setup could not be completed. No credentials were printed.');
        }
        if (isset($file) && is_file($file)) {
            $this->warn('The provider may have changed. Keep this private recovery file: '.$file);
        }

        return self::FAILURE;
    }
}
