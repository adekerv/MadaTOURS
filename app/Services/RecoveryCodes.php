<?php

namespace App\Services;

use App\Services\Supabase\SupabaseClient;
use Illuminate\Support\Facades\Hash;

/**
 * One-time codes that let someone reset a forgotten password without any email.
 * The readable codes exist only in the response that issues them; the database keeps hashes.
 */
class RecoveryCodes
{
    public const COUNT = 8;

    private const LENGTH = 10;

    /** Thirty characters with no look-alikes (no 0, 1, I, L, O or U): about 49 bits per code. */
    private const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

    /** A fixed hash, checked when an email has no codes, so an unknown address costs as much time as a wrong code. */
    private const FILLER = '$2y$10$dfA5WfEB6X4Vu3MoIC.KQebUm0oUHLxBzx3A0mp/WCBLBwP8S3TNi';

    public function __construct(private SupabaseClient $client) {}

    /**
     * Replaces the account's codes with a fresh set, in one database step.
     *
     * @return list<string> Eight codes written like "K7QM2-WX4TP"
     */
    public function replace(string $userId): array
    {
        $codes = [];
        while (count($codes) < self::COUNT) {
            $code = '';
            for ($i = 0; $i < self::LENGTH; $i++) {
                $code .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
            $codes[$code] = true;
        }
        $codes = array_keys($codes);
        $hashes = array_map(fn ($code) => Hash::driver('bcrypt')->make($code, ['rounds' => config('supabase.recovery_code_cost')]), $codes);
        $this->client->request('POST', '/rest/v1/rpc/mt_replace_recovery_codes', ['target' => $userId, 'hashes' => $hashes], admin: true);

        return array_map(fn ($code) => substr($code, 0, 5).'-'.substr($code, 5), $codes);
    }

    public function remaining(string $userId): int
    {
        return (int) $this->client->request('POST', '/rest/v1/rpc/mt_recovery_codes_left', ['target' => $userId], admin: true);
    }

    /**
     * Uses up the code if it belongs to the account that owns this email. Returns that account's id and the
     * code's id, or null for a wrong code, an unknown email or an account without codes, which look identical.
     *
     * @return array{userId: string, codeId: int}|null
     */
    public function consume(string $email, string $code): ?array
    {
        $candidates = $this->client->request('POST', '/rest/v1/rpc/mt_recovery_candidates', ['account_email' => $email], admin: true) ?: [];
        $code = self::normalize($code);
        if (! $candidates) {
            Hash::driver('bcrypt')->check($code, self::FILLER);

            return null;
        }
        $match = null;
        // Every code is checked, matched or not, so the time taken does not say which one was right.
        foreach ($candidates as $candidate) {
            if (Hash::driver('bcrypt')->check($code, $candidate['hash']) && $match === null) {
                $match = $candidate;
            }
        }
        if ($match === null) {
            return null;
        }
        $used = $this->client->request('POST', '/rest/v1/rpc/mt_consume_recovery_code', ['code_id' => $match['codeId']], admin: true);

        return $used === true ? ['userId' => $match['userId'], 'codeId' => (int) $match['codeId']] : null;
    }

    /** Gives a code back after a reset failed part-way, so the person can try again with it. */
    public function restore(int $codeId): void
    {
        $this->client->request('PATCH', '/rest/v1/mt_recovery_codes?id=eq.'.$codeId, ['used_at' => null], admin: true);
    }

    /** Signs the account out everywhere, so a stolen session does not outlive the reset. */
    public function revokeSessions(string $userId): void
    {
        $this->client->request('POST', '/rest/v1/rpc/mt_revoke_user_sessions', ['target' => $userId], admin: true);
    }

    public static function normalize(string $input): string
    {
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $input));
    }
}
