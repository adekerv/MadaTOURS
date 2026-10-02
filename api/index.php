<?php

/*
 * Vercel serverless entry point (vercel-php runtime). The deployment filesystem is
 * read-only apart from /tmp, and instances share nothing, so Laravel writes caches
 * to /tmp and keeps the session in an encrypted cookie. Variables set in the
 * Vercel dashboard always win over these defaults.
 */
$storage = '/tmp/storage';
foreach (['app', 'framework/cache/data', 'framework/views', 'framework/sessions', 'logs'] as $dir) {
    if (! is_dir("$storage/$dir")) {
        @mkdir("$storage/$dir", 0700, true);
    }
}
$defaults = [
    'LARAVEL_STORAGE_PATH' => $storage,
    'APP_ENV' => 'production',
    'APP_DEBUG' => 'false',
    'APP_CONFIG_CACHE' => '/tmp/config.php',
    'APP_EVENTS_CACHE' => '/tmp/events.php',
    'APP_PACKAGES_CACHE' => '/tmp/packages.php',
    'APP_ROUTES_CACHE' => '/tmp/routes.php',
    'APP_SERVICES_CACHE' => '/tmp/services.php',
    'VIEW_COMPILED_PATH' => "$storage/framework/views",
    'LOG_CHANNEL' => 'stderr',
    'SESSION_DRIVER' => 'cookie',
    // EncryptCookies already encrypts and signs the session cookie. Encrypting the
    // payload twice pushes a signed-in session past the browser's 4 KB cookie limit.
    'SESSION_ENCRYPT' => 'false',
    'SESSION_SECURE_COOKIE' => 'true',
    'CACHE_STORE' => 'file',
    // The function is reachable only through Vercel's edge proxy.
    'TRUSTED_PROXIES' => '*',
];
foreach ($defaults as $key => $value) {
    if (getenv($key) === false) {
        putenv("$key=$value");
        $_ENV[$key] = $_SERVER[$key] = $value;
    }
}

// Laravel derives its base URL from the script path. Running from api/index.php would
// make it strip "/api" from every request, so present the public front controller.
$_SERVER['SCRIPT_FILENAME'] = realpath(__DIR__.'/../public/index.php');
$_SERVER['SCRIPT_NAME'] = $_SERVER['PHP_SELF'] = '/index.php';

require __DIR__.'/../public/index.php';
