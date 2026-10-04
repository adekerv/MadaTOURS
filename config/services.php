<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Road routes between a tour's stops. Without a key the app keeps drawing straight lines.
    'openrouteservice' => [
        'key' => env('ORS_API_KEY'),
        'url' => rtrim((string) env('ORS_BASE_URL', 'https://api.openrouteservice.org'), '/'),
        'timeout' => (int) env('ORS_TIMEOUT', 10),
        // Pause between requests when routes are worked out in bulk, to stay under the free plan's per-minute limit.
        'delay_ms' => (int) env('ORS_DELAY_MS', 1600),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
