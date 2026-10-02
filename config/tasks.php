<?php

return [
    // Shared secret for the external trigger. Leave empty to disable the HTTP endpoint.
    'secret' => env('RECURRING_TASKS_SECRET'),

    // Command => minimum minutes between runs. Every job is idempotent and bounded,
    // so a late or repeated trigger is safe. Google spend is also capped in the database.
    'recurring' => [
        'events:expire' => 5,
        'photos:cleanup' => 60,
        'sources:refresh' => 60,
        'google:match --limit=10' => 60,
        'places:rank' => 1440,
    ],
];
