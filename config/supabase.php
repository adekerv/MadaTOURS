<?php

return [
    'url' => rtrim(trim((string) env('SUPABASE_URL', '')), '/'),
    'publishable_key' => trim((string) env('SUPABASE_PUBLISHABLE_KEY', '')),
    'secret_key' => trim((string) env('SUPABASE_SECRET_KEY', '')),
    'timeout' => (int) env('SUPABASE_TIMEOUT', 12),
    // Sign-in, sign-up and account attempts allowed per IP address in each 15-minute window.
    // The database function rejects anything outside 1-100, so the value is clamped to that range.
    'auth_attempts_per_ip' => max(1, min(100, (int) env('AUTH_ATTEMPTS_PER_IP', 30))),
    // bcrypt cost for recovery codes: eight are hashed at signup, and a reset checks at most eight.
    'recovery_code_cost' => max(4, min(14, (int) env('RECOVERY_CODE_COST', 10))),
    'allowed_origins' => array_values(array_filter([
        ...array_map('trim', explode(',', env('ALLOWED_ORIGINS', 'capacitor://localhost,https://localhost'))),
        // Vercel system variables: the production domain and this deployment's own URL.
        env('VERCEL_PROJECT_PRODUCTION_URL') ? 'https://'.env('VERCEL_PROJECT_PRODUCTION_URL') : null,
        env('VERCEL_URL') ? 'https://'.env('VERCEL_URL') : null,
        env('VERCEL_BRANCH_URL') ? 'https://'.env('VERCEL_BRANCH_URL') : null,
    ])),
    // Trimmed: dashboard values can carry a stray newline that would break redirects.
    'app_origin' => trim((string) env('APP_ORIGIN', env('APP_URL', 'http://localhost:8000'))),
];
