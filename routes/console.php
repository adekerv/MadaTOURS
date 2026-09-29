<?php

use App\Services\Sources\GoogleMatcher;
use App\Services\Sources\SourceIngestion;
use App\Services\SubmissionPhotos;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Timestamp-based RLS hides expired events even when a scheduler invocation is delayed.
Artisan::command('events:expire', function (SupabaseClient $client) {
    $count = $client->request('POST', '/rest/v1/rpc/mt_expire_events', admin: true);
    $this->info("Expired {$count} events.");
});
Schedule::command('events:expire')->everyFiveMinutes()->withoutOverlapping();

Artisan::command('photos:cleanup', function (SubmissionPhotos $photos) {
    $this->info('Removed '.$photos->cleanup().' queued photos.');
});
Schedule::command('photos:cleanup')->hourly()->withoutOverlapping();

Artisan::command('sources:refresh {--limit=3}', function (SourceIngestion $sources) {
    $this->info('Checked '.$sources->run((int) $this->option('limit')).' official sources.');
});
Schedule::command('sources:refresh')->hourly()->withoutOverlapping();
Artisan::command('google:match {--limit=3}', function (GoogleMatcher $matcher) {
    $this->info('Processed '.$matcher->run((int) $this->option('limit')).' matches.');
});
Schedule::command('google:match')->dailyAt('06:00')->withoutOverlapping();
Artisan::command('places:rank', function (SupabaseClient $client) {
    $client->request('POST', '/rest/v1/rpc/mt_refresh_daily_picks', admin: true);
    $this->info('Updated the daily community picks.');
});
Schedule::command('places:rank')->dailyAt('06:10')->withoutOverlapping();
