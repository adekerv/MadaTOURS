<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\AuthRequest;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    public function __construct(private AuthService $auth, private SupabaseClient $client) {}

    public function register(AuthRequest $request): JsonResponse
    {
        $input = $request->validated();
        $this->auth->limit('auth', $input['email']);
        $data = $this->auth->authenticate('signup', $input);
        return response()->json(['user' => isset($data['access_token']) ? $this->auth->user() : null, 'verificationRequired' => !isset($data['access_token'])], 201);
    }

    public function login(AuthRequest $request): JsonResponse
    {
        $input = $request->validated();
        $this->auth->limit('auth', $input['email']);
        $this->auth->authenticate('token?grant_type=password', $input);
        return response()->json(['user' => $this->auth->user()]);
    }

    public function verify(AuthRequest $request): JsonResponse
    {
        $input = $request->validated();
        $this->auth->limit('verify', $input['email']);
        $this->auth->authenticate('verify', $input + ['type' => 'email']);
        return response()->json(['user' => $this->auth->user()]);
    }

    public function resend(AuthRequest $request): JsonResponse
    {
        $input = $request->validated();
        $this->auth->limit('email', $input['email']);
        $this->client->request('POST', '/auth/v1/resend', $input + ['type' => 'signup']);
        return response()->json(['success' => true]);
    }

    public function forgotPassword(AuthRequest $request): JsonResponse
    {
        $input = $request->validated();
        $this->auth->limit('email', $input['email']);
        $this->client->request('POST', '/auth/v1/recover', $input);
        return response()->json(['success' => true]);
    }

    public function resetPassword(AuthRequest $request): JsonResponse
    {
        $input = $request->validated();
        $this->auth->limit('verify', $input['email']);
        $this->auth->authenticate('verify', ['email' => $input['email'], 'token' => $input['token'], 'type' => 'recovery']);
        try {
            $this->client->request('PUT', '/auth/v1/user', ['password' => $input['password']], $this->auth->token());
        } finally {
            $this->auth->logout('global');
        }
        return response()->json(['success' => true]);
    }

    public function session(): JsonResponse
    {
        try { return response()->json(['user' => $this->auth->user()]); }
        catch (ApiException $error) {
            if ($error->status !== 401) throw $error;
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
