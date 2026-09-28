<?php

return [
    'url' => rtrim(env('SUPABASE_URL', ''), '/'),
    'publishable_key' => env('SUPABASE_PUBLISHABLE_KEY', ''),
    'secret_key' => env('SUPABASE_SECRET_KEY', ''),
    'timeout' => (int) env('SUPABASE_TIMEOUT', 12),
    'allowed_origins' => array_filter(array_map('trim', explode(',', env('ALLOWED_ORIGINS', 'capacitor://localhost,https://localhost')))),
    'app_origin' => env('APP_ORIGIN', env('APP_URL', 'http://localhost:8000')),
];
