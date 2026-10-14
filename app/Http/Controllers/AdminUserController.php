<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Services\RecoveryCodes;
use App\Services\SubmissionPhotos;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Accounts for administrators: list, look up, change roles, suspend, reset a password and delete. An administrator
 * can never do any of this to their own account, and another administrator must lose that role before being
 * suspended or deleted, so one click can never lock everyone out.
 */
class AdminUserController extends AdminController
{
    /** Suspensions run for a hundred years, the way Supabase Auth expresses "until lifted". */
    private const SUSPENSION = '876000h';

    public function index(Request $request): JsonResponse
    {
        $query = $this->listQuery($request, ['newest', 'oldest', 'name', 'email', 'active'], [
            'role' => ['nullable', Rule::in(['user', 'admin'])],
            'status' => ['nullable', Rule::in(['active', 'suspended'])],
        ]);

        return response()->json($this->page($this->rpc('mt_admin_users', [
            'search_text' => $query['search'], 'role_filter' => $query['filters']['role'] ?? '',
            'status_filter' => $query['filters']['status'] ?? '', 'sort_key' => $query['sort'],
            'page_offset' => $query['offset'], 'page_size' => $query['perPage'],
        ]), $query));
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->account($id));
    }

    public function role(Request $request, string $id): JsonResponse
    {
        $role = $request->validate(['role' => ['required', Rule::in(['user', 'admin'])]])['role'];
        $this->notSelf($request, $id, 'You cannot change your own role.');
        $account = $this->account($id);
        $this->rpc('mt_admin_set_role', ['target' => $id, 'new_role' => $role]);
        $this->log->record('users.role', ($role === 'admin' ? 'Made ' : 'Removed administrator access from ').$account['email'].($role === 'admin' ? ' an administrator' : ''), 'user', $id, ['role' => $role]);

        return response()->json($this->account($id));
    }

    public function suspend(Request $request, RecoveryCodes $sessions, string $id): JsonResponse
    {
        $this->notSelf($request, $id, 'You cannot suspend your own account.');
        $account = $this->account($id);
        $this->notAdmin($account);
        $this->client->request('PUT', '/auth/v1/admin/users/'.rawurlencode($id), ['ban_duration' => self::SUSPENSION], admin: true);
        $sessions->revokeSessions($id);
        $this->log->record('users.suspend', 'Suspended '.$account['email'], 'user', $id);

        return response()->json($this->account($id));
    }

    public function reactivate(string $id): JsonResponse
    {
        $account = $this->account($id);
        $this->client->request('PUT', '/auth/v1/admin/users/'.rawurlencode($id), ['ban_duration' => 'none'], admin: true);
        $this->log->record('users.reactivate', 'Reactivated '.$account['email'], 'user', $id);

        return response()->json($this->account($id));
    }

    /**
     * Sets a new random password, signs the account out everywhere and returns the password once, for the
     * administrator to pass on. It is never stored or logged here.
     */
    public function password(Request $request, RecoveryCodes $sessions, string $id): JsonResponse
    {
        $this->notSelf($request, $id, 'Change your own password from My account.');
        $account = $this->account($id);
        $password = self::readablePassword();
        $this->client->request('PUT', '/auth/v1/admin/users/'.rawurlencode($id), ['password' => $password], admin: true);
        try {
            $sessions->revokeSessions($id);
        } catch (ApiException) {
            // The password is replaced; old sessions still end when their tokens expire.
        }
        $this->log->record('users.password', 'Reset the password of '.$account['email'], 'user', $id);

        return response()->json(['password' => $password]);
    }

    public function destroy(Request $request, SubmissionPhotos $photos, string $id): JsonResponse
    {
        $this->notSelf($request, $id, 'You cannot delete your own account here.');
        $account = $this->account($id);
        $this->notAdmin($account);
        $this->client->request('DELETE', '/auth/v1/admin/users/'.rawurlencode($id), admin: true);
        try {
            $photos->cleanup($id);
        } catch (\Throwable) {
            // Files are private and publication links are already removed; the durable queue retries.
        }
        $this->log->record('users.delete', 'Deleted the account of '.$account['email'], 'user', $id);

        return response()->json(['success' => true]);
    }

    /** @return array<string, mixed> */
    private function account(string $id): array
    {
        validator(['id' => $id], ['id' => 'required|uuid'])->validate();

        return $this->rpc('mt_admin_user', ['target' => $id]);
    }

    private function notSelf(Request $request, string $id, string $message): void
    {
        if (strcasecmp($request->user()->id, $id) === 0) {
            throw new ApiException(409, $message);
        }
    }

    private function notAdmin(array $account): void
    {
        if (($account['role'] ?? null) === 'admin') {
            throw new ApiException(409, 'Remove administrator access from this account first.');
        }
    }

    /** Four groups of five characters without look-alikes: over 100 bits, and easy to read out or type. */
    private static function readablePassword(): string
    {
        $alphabet = 'ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz23456789';
        $groups = [];
        for ($group = 0; $group < 4; $group++) {
            $chunk = '';
            for ($i = 0; $i < 5; $i++) {
                $chunk .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $groups[] = $chunk;
        }

        return implode('-', $groups);
    }
}
