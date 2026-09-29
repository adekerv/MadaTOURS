<?php

namespace App\Services\Supabase;

use App\Exceptions\ApiException;
use Illuminate\Http\Request;

class AuthService
{
    public function __construct(private SupabaseClient $client, private Request $request) {}

    public function token(): ?string
    {
        $session = $this->request->session()->get('supabase');
        if (! $session) {
            return null;
        }
        if (($session['expires_at'] ?? 0) <= time() + 60) {
            try {
                $session = $this->client->request('POST', '/auth/v1/token?grant_type=refresh_token', ['refresh_token' => $session['refresh_token']]);
                $this->store($session, false);
            } catch (ApiException $error) {
                if (in_array($error->status, [400, 401])) {
                    $this->clear();
                    throw new ApiException(401, 'Please sign in to continue.');
                }
                throw $error;
            }
        }

        return $session['access_token'];
    }

    public function user(): array
    {
        $token = $this->token();
        if (! $token) {
            throw new ApiException(401, 'Please sign in to continue.');
        }
        // Validate remotely on every protected request; session data never grants a role.
        $user = $this->client->request('GET', '/auth/v1/user', token: $token);
        $profiles = $this->client->request('GET', '/rest/v1/mt_profiles', ['select' => 'role,email_verified_at', 'id' => 'eq.'.$user['id']], $token);
        if (empty($profiles)) {
            throw new ApiException(503, 'Your account profile is not available.');
        }

        $name = $user['user_metadata']['display_name'] ?? null;
        $name = is_string($name) ? trim(preg_replace('/[\p{C}<>]/u', '', $name)) : '';

        return [
            'id' => $user['id'],
            'name' => mb_substr($name ?: (strtok($user['email'] ?? '', '@') ?: 'Explorer'), 0, 80),
            'email' => $user['email'] ?? '',
            'emailVerified' => ! empty($profiles[0]['email_verified_at']),
            'role' => $profiles[0]['role'] === 'admin' ? 'admin' : 'user',
        ];
    }

    public function authenticate(string $path, array $input): array
    {
        $data = $this->client->request('POST', '/auth/v1/'.$path, $input);
        if (isset($data['access_token'], $data['refresh_token'])) {
            $this->store($data);
        }

        return $data;
    }

    private function store(array $data, bool $regenerate = true): void
    {
        if ($regenerate) {
            $this->request->session()->regenerate(true);
        }
        $this->request->session()->put('supabase', [
            'access_token' => $data['access_token'], 'refresh_token' => $data['refresh_token'],
            'expires_at' => $data['expires_at'] ?? time() + ($data['expires_in'] ?? 3600),
        ]);
    }

    public function logout(string $scope = 'local'): void
    {
        try {
            if ($token = $this->token()) {
                $this->client->request('POST', '/auth/v1/logout?scope='.$scope, token: $token);
            }
        } catch (ApiException $error) {
            if ($error->status !== 401) {
                throw $error;
            }
        } finally {
            $this->clear();
        }
    }

    public function clear(): void
    {
        $this->request->session()->invalidate();
        $this->request->session()->regenerateToken();
    }

    public function limit(string $kind, string $identity): void
    {
        foreach ([[$kind.':ip:'.$this->request->ip(), 30], [$kind.':identity:'.$identity, 10]] as [$identifier, $ceiling]) {
            $allowed = $this->client->request('POST', '/rest/v1/rpc/mt_check_rate_limit', ['identifier' => hash('sha256', $identifier), 'ceiling' => $ceiling], admin: true);
            if ($allowed !== true) {
                throw new ApiException(429, 'Too many attempts. Please try again in 15 minutes.');
            }
        }
    }
}
