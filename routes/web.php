<?php

use App\Services\SubmissionPhotos;
use Illuminate\Support\Facades\Route;

Route::get('/photos/community/{id}.jpg', function (string $id, SubmissionPhotos $photos) {
    return response($photos->published($id), 200, ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff']);
})->whereUuid('id');

Route::get('/sw.js', fn () => response()->file(public_path('build/sw.js'), ['Content-Type' => 'application/javascript', 'Cache-Control' => 'no-cache', 'Service-Worker-Allowed' => '/']));
// Public policy URLs stay readable without JavaScript for store listings and support.
Route::get('/{page}', function (string $page) {
    $language = request('lang') === 'fr' ? 'fr' : 'en';
    $content = json_decode(file_get_contents(resource_path('content/information.json')), true, flags: JSON_THROW_ON_ERROR);

    return view('information', ['language' => $language, 'page' => $page, 'copy' => $content[$language][$page]]);
})->whereIn('page', ['privacy', 'terms', 'delete-account']);
Route::get('/{path?}', fn () => view('app'))->where('path', '^(?!api(?:/|$)|build(?:/|$)|photos(?:/|$)).*');
