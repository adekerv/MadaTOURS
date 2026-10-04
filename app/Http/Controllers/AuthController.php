<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\AuthRequest;
use App\Services\RecoveryCodes;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use App\Services\WelcomeMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function __construct(private AuthService $auth, private SupabaseClient $client) {}

    /** Starts Google sign-in. The PKCE verifier stays in the server session and never reaches the browser. */
    public function google(Request $request): RedirectResponse
    {
        // The verifier cookie only exists on the host that starts the flow, so always start on the app origin.
        if ($request->getHost() !== parse_url($this->origin(), PHP_URL_HOST)) {
            return redirect()->away($this->origin().'/api/auth/google');
        }
        try {
            $this->auth->limit('oauth', (string) $request->ip());
        } catch (ApiException) {
            return $this->returnToApp('rate_limited');
        }
        $verifier = Str::random(64);
        $request->session()->put('oauth_verifier', $verifier);
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

        return redirect()->away(config('supabase.url').'/auth/v1/authorize?'.http_build_query([
            'provider' => 'google',
            'redirect_to' => $this->origin().'/api/auth/google/callback',
            'code_challenge' => $challenge,
            'code_challenge_method' => 's256',
        ]));
    }

    public function googleCallback(Request $request): RedirectResponse
    {
        $verifier = $request->session()->pull('oauth_verifier');
        $code = $request->query('code');
        if (! is_string($verifier) || ! is_string($code) || $code === '' || strlen($code) > 512) {
            return $this->returnToApp($request->query('error') === 'access_denied' ? 'cancelled' : 'failed');
        }
        try {
            $session = $this->auth->authenticate('token?grant_type=pkce', ['auth_code' => $code, 'code_verifier' => $verifier]);
            if (empty($session['access_token'])) {
                throw new ApiException(502, 'Google sign-in did not return a session.');
            }
            $this->finishGoogleAccount($this->auth->token());
        } catch (ApiException) {
            $this->auth->clear();

            return $this->returnToApp('failed');
        }

        return $this->returnToApp();
    }

    /**
     * Google has proven the address, so the account counts as verified. If the same address was
     * registered earlier with a password that was never proven, that password may belong to
     * someone else: replace it and end every other session before the owner takes over.
     */
    private function finishGoogleAccount(string $token): void
    {
        $user = $this->client->request('GET', '/auth/v1/user', token: $token);
        $google = collect($user['identities'] ?? [])->first(fn ($identity) => ($identity['provider'] ?? '') === 'google');
        $email = strtolower($user['email'] ?? '');
        if (! $google || $email === '' || strtolower($google['identity_data']['email'] ?? '') !== $email || ($google['identity_data']['email_verified'] ?? false) !== true) {
            return;
        }
        $profile = $this->client->request('GET', '/rest/v1/mt_profiles', ['select' => 'email_verified_at', 'id' => 'eq.'.$user['id']], admin: true);
        if (! empty($profile) && empty($profile[0]['email_verified_at'])) {
            $hasPassword = collect($user['identities'] ?? [])->contains(fn ($identity) => ($identity['provider'] ?? '') === 'email');
            if ($hasPassword) {
                $this->client->request('PUT', '/auth/v1/admin/users/'.rawurlencode($user['id']), ['password' => Str::password(64)], admin: true);
                $this->client->request('POST', '/auth/v1/logout?scope=others', token: $token);
            }
            $this->client->request('PATCH', '/rest/v1/mt_profiles?id=eq.'.rawurlencode($user['id']).'&email_verified_at=is.null', ['email_verified_at' => now()->toIso8601String()], admin: true);
        }
        $metadata = $user['user_metadata'] ?? [];
        if (empty($metadata['display_name'])) {
            $name = $metadata['full_name'] ?? $metadata['name'] ?? '';
            $name = is_string($name) ? mb_substr(trim(preg_replace('/[\p{C}<>]/u', '', $name)), 0, 80) : '';
            if ($name !== '') {
                $this->client->request('PUT', '/auth/v1/user', ['data' => ['display_name' => $name]], $token);
            }
        }
    }

    private function origin(): string
    {
        return rtrim((string) config('supabase.app_origin'), '/');
    }

    private function returnToApp(?string $error = null): RedirectResponse
    {
        return redirect()->away($this->origin().'/?'.($error ? 'auth_error='.$error : 'signed_in=google'));
    }

    public function register(AuthRequest $request, WelcomeMessage $welcome, RecoveryCodes $recovery): JsonResponse
    {
        $input = $request->validated();
        $this->auth->limit('auth', $input['email']);
        $data = $this->auth->authenticate('signup', [
            'email' => $input['email'],
            'password' => $input['password'],
            'data' => ['display_name' => $input['name'], 'language' => $input['language'] ?? 'en'],
        ]);
        $user = isset($data['access_token']) ? $this->auth->user() : null;
        $codes = [];
        if ($user) {
            if ($user['email']) {
                $welcome->send($user, $input['language'] ?? 'en');
            }
            // The only way back into a password account without email. If this fails the account still works and
            // the person can issue codes from their settings, so signup is not turned into an error.
            try {
                $codes = $recovery->replace($user['id']);
            } catch (\Throwable) {
                Log::warning('Recovery codes could not be issued at signup.');
            }
        }

        return response()->json(['user' => $user, 'verificationRequired' => $user === null] + ($codes ? ['recoveryCodes' => $codes] : []), 201);
    }

    public function login(AuthRequest $request): JsonResponse
    {
        $input = $request->validated();
        $this->auth->limit('auth', $input['email']);
        $this->auth->authenticate('token?grant_type=password', $input);

        return response()->json(['user' => $this->auth->user()]);
    }

    /**
     * Resets a forgotten password with one of the account's recovery codes: no email is involved. A code is the only
     * thing between a stranger and an account, so attempts are few and every failure reads the same.
     */
    public function recover(AuthRequest $request, RecoveryCodes $codes): JsonResponse
    {
        $input = $request->validated();
        $this->auth->limit('recover', $input['email'], 5);
        $used = $codes->consume($input['email'], $input['code']);
        if ($used === null) {
            throw new ApiException(400, 'The email or recovery code is not valid.');
        }
        try {
            $this->client->request('PUT', '/auth/v1/admin/users/'.rawurlencode($used['userId']), ['password' => $input['password']], admin: true);
        } catch (\Throwable $error) {
            try {
                $codes->restore($used['codeId']);
            } catch (\Throwable) {
                // The reset already failed; the person can use another code.
            }
            throw $error;
        }
        try {
            $codes->revokeSessions($used['userId']);
        } catch (\Throwable) {
            Log::warning('Sessions could not be revoked after a password reset.');
        }

        return response()->json(['success' => true]);
    }

    public function session(): JsonResponse
    {
        try {
            return response()->json(['user' => $this->auth->user()]);
        } catch (ApiException $error) {
            if ($error->status !== 401) {
                throw $error;
            }
            $this->auth->clear();

            return response()->json(['user' => null]);
        }
    }

    public function logout(): JsonResponse
    {
        $this->auth->logout();

        return response()->json(['success' => true]);
    }
}
