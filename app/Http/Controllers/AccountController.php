<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function destroy(Request $request, AuthService $auth, SupabaseClient $client): JsonResponse
    {
        $input = $request->validate(['password' => ['required', 'string', 'max:128']]);
        $user = $request->user();
        $auth->limit('delete', $user->email);
        $data = $auth->authenticate('token?grant_type=password', ['email' => $user->email, 'password' => $input['password']]);
        if (($data['user']['id'] ?? null) !== $user->id) {
            throw new ApiException(401, 'Incorrect password. Your account has not been deleted.');
        }
        // Revoke refresh sessions first; deletion cascades profiles and saved places.
        $auth->logout('global');
        $client->request('DELETE', '/auth/v1/admin/users/'.$user->id, admin: true);

        return response()->json(['success' => true]);
    }
}
