<?php

use Illuminate\Support\Facades\Route;

Route::get('/sw.js', fn () => response()->file(public_path('build/sw.js'), ['Content-Type' => 'application/javascript', 'Cache-Control' => 'no-cache', 'Service-Worker-Allowed' => '/']));
Route::get('/{path?}', fn () => view('app'))->where('path', '^(?!api(?:/|$)|build(?:/|$)|photos(?:/|$)).*');
