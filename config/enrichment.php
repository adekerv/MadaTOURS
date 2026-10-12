<?php

return [
    'google_key' => env('GOOGLE_PLACES_API_KEY'),
    // A hard database-backed daily request limit, shared by cron and admin actions.
    'google_daily_limit' => max(0, min(100, (int) env('GOOGLE_MATCH_DAILY_LIMIT', 10))),
    // Places matched per run of the daily task. Keep it at or below the daily limit.
    'google_batch' => max(1, min(50, (int) env('GOOGLE_MATCH_BATCH', 10))),
];
