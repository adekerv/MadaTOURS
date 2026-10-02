<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function send(Request $request, AuthService $auth, SupabaseClient $client): JsonResponse
    {
        $email = $request->user()->email;
        $auth->limit('email-ownership', $email);
        $client->request('POST', '/auth/v1/otp', ['email' => $email, 'create_user' => false]);

        return response()->json(['success' => true]);
    }

    public function confirm(Request $request, AuthService $auth, SupabaseClient $client): JsonResponse
    {
        $input = $request->validate(['token' => 'required|string|regex:/^[0-9]{6,8}$/']);
        $original = $request->user();
        $auth->limit('email-ownership-verify', $original->email);
        $verified = $auth->authenticate('verify', ['email' => $original->email, 'token' => $input['token'], 'type' => 'email']);
        if (empty($verified['access_token']) || empty($verified['refresh_token'])) {
            throw new ApiException(502, 'The verification could not be completed. Please request a new code.');
        }
        $user = $auth->user();
        if ($user['id'] !== $original->id || $user['email'] !== $original->email) {
            $auth->clear();
            throw new ApiException(403, 'The verification does not match this account.');
        }
        // Only a successful provider OTP proves email ownership. Legacy auto-confirm is insufficient.
        $client->request('PATCH', '/rest/v1/mt_profiles?id=eq.'.rawurlencode($user['id']), ['email_verified_at' => now()->toIso8601String()], admin: true);

        return response()->json(['user' => $auth->user()]);
    }
}
