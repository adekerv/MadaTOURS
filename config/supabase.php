<?php

return [
    'url' => rtrim(trim((string) env('SUPABASE_URL', '')), '/'),
    'publishable_key' => trim((string) env('SUPABASE_PUBLISHABLE_KEY', '')),
    'secret_key' => trim((string) env('SUPABASE_SECRET_KEY', '')),
    'timeout' => (int) env('SUPABASE_TIMEOUT', 12),
    'allowed_origins' => array_values(array_filter([
        ...array_map('trim', explode(',', env('ALLOWED_ORIGINS', 'capacitor://localhost,https://localhost'))),
        // Vercel system variables: the production domain and this deployment's own URL.
        env('VERCEL_PROJECT_PRODUCTION_URL') ? 'https://'.env('VERCEL_PROJECT_PRODUCTION_URL') : null,
        env('VERCEL_URL') ? 'https://'.env('VERCEL_URL') : null,
        env('VERCEL_BRANCH_URL') ? 'https://'.env('VERCEL_BRANCH_URL') : null,
    ])),
    'app_origin' => env('APP_ORIGIN', env('APP_URL', 'http://localhost:8000')),
];
