<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\AccountRequest;
use App\Services\SubmissionPhotos;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;

class AccountController extends Controller
{
    public function __construct(private AuthService $auth, private SupabaseClient $client) {}

    /** Name and language live in Supabase user metadata; a database trigger copies the name to the public profile. */
    public function profile(AccountRequest $request): JsonResponse
    {
        $input = $request->validated();
        $changes = array_filter(['display_name' => $input['name'] ?? null, 'language' => $input['language'] ?? null], fn ($value) => $value !== null);
        if ($changes === []) {
            throw new ApiException(400, 'Enter a name or choose a language.');
        }
        $this->auth->limit('account', $request->user()->id);
        $this->client->request('PUT', '/auth/v1/user', ['data' => $changes], $this->auth->token());

        return response()->json(['user' => $this->auth->user()]);
    }

    /**
     * The new address is usable immediately but starts unverified, so verified-only features
     * stay locked until its owner confirms a code. The flag is cleared before the address
     * changes: a failure in between leaves the account unverified, never wrongly verified.
     */
    public function email(AccountRequest $request): JsonResponse
    {
        $input = $request->validated();
        $user = $request->user();
        if ($user->hasPassword === false) {
            throw new ApiException(409, 'Your email address comes from your Google account, so it cannot be changed here.');
        }
        if ($input['email'] === strtolower($user->email)) {
            throw new ApiException(400, 'This is already your email address.');
        }
        $this->auth->limit('email-change', $user->id);
        $this->confirmPassword($user, $input['password']);

        $path = rawurlencode($user->id);
        $this->client->request('PATCH', '/rest/v1/mt_profiles?id=eq.'.$path, ['email_verified_at' => null], admin: true);
        $this->client->request('PUT', '/auth/v1/admin/users/'.$path, ['email' => $input['email'], 'email_confirm' => true], admin: true);
        try {
            $this->client->request('POST', '/auth/v1/otp', ['email' => $input['email'], 'create_user' => false]);
            $sent = true;
        } catch (ApiException) {
            $sent = false;
        }

        return response()->json(['user' => $this->auth->user(), 'verificationSent' => $sent]);
    }

    public function destroy(AccountRequest $request, SubmissionPhotos $photos): JsonResponse
    {
        $input = $request->validated();
        $user = $request->user();
        $this->auth->limit('delete', $user->email);
        if ($user->hasPassword !== false) {
            $this->confirmPassword($user, $input['password']);
        }
        // Revoke refresh sessions first; deletion cascades profiles and saved places.
        $this->auth->logout('global');
        $this->client->request('DELETE', '/auth/v1/admin/users/'.$user->id, admin: true);

        try {
            $photos->cleanup($user->id);
        } catch (\Throwable) {
            // Files are private and publication links are already removed; the durable queue retries.
        }

        return response()->json(['success' => true]);
    }

    private function confirmPassword(object $user, string $password): void
    {
        try {
            $data = $this->auth->authenticate('token?grant_type=password', ['email' => $user->email, 'password' => $password]);
        } catch (ApiException $error) {
            // The provider's wording talks about emails and codes; here only the password can be wrong.
            throw $error->status === 400 ? $this->wrongPassword() : $error;
        }
        if (($data['user']['id'] ?? null) !== $user->id) {
            throw $this->wrongPassword();
        }
    }

    private function wrongPassword(): ApiException
    {
        return new ApiException(400, 'Incorrect password. Nothing was changed.');
    }
}
