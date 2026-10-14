<?php

use App\Services\PlacePhotos;
use App\Services\RecurringTasks;
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
})->purpose('Close meet-ups whose date has passed and delete activity older than 90 days');

Artisan::command('photos:cleanup', function (SubmissionPhotos $photos) {
    $this->info('Removed '.$photos->cleanup().' queued photos.');
})->purpose('Delete stored submission photos that are queued for removal');

Artisan::command('sources:refresh {--limit=3}', function (SourceIngestion $sources) {
    $this->info('Checked '.$sources->run((int) $this->option('limit')).' official sources.');
})->purpose('Read the official source pages that are due for a check, one page per site');
Artisan::command('google:match {--limit= : Places per run; defaults to GOOGLE_MATCH_BATCH}', function (GoogleMatcher $matcher) {
    $limit = $this->option('limit');
    $this->info('Processed '.$matcher->run($limit === null ? null : (int) $limit).' matches.');
})->purpose('Match published places to Google Place IDs, within the daily limit');
Artisan::command('photos:expire', function (PlacePhotos $photos) {
    $this->info('Took down '.$photos->expire().' photos whose permission expired.');
})->purpose('Take down owner photos whose permission has expired');
Artisan::command('places:rank', function (SupabaseClient $client) {
    $client->request('POST', '/rest/v1/rpc/mt_refresh_daily_picks', admin: true);
    $this->info('Updated the daily community picks.');
})->purpose('Recompute the daily MUST GO picks');

// One source of truth for intervals (config/tasks.php), shared with the container
// loop and the external trigger at POST /api/internal/tasks.
Artisan::command('tasks:run-due', function (RecurringTasks $tasks) {
    $result = $tasks->runDue();
    $this->info('Ran: '.(implode(', ', $result['ran']) ?: 'nothing due').($result['failed'] ? '. Failed: '.implode(', ', $result['failed']) : '.'));
})->purpose('Run recurring maintenance tasks that are due');
Schedule::command('tasks:run-due')->everyMinute()->withoutOverlapping();
