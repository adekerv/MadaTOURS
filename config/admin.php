<?php

return [
    // The first administrator, created by `php artisan admin:seed`. Supabase Auth stores only a bcrypt hash of the
    // password; the plain value lives in the local environment file and nowhere else.
    'email' => strtolower(trim((string) env('ADMIN_EMAIL', ''))),
    'password' => (string) env('ADMIN_PASSWORD', ''),
    'name' => trim((string) env('ADMIN_NAME', 'Administrator')),
];
