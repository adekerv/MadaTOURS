<?php

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
});

Artisan::command('photos:cleanup', function (SubmissionPhotos $photos) {
    $this->info('Removed '.$photos->cleanup().' queued photos.');
});

Artisan::command('sources:refresh {--limit=3}', function (SourceIngestion $sources) {
    $this->info('Checked '.$sources->run((int) $this->option('limit')).' official sources.');
});
Artisan::command('google:match {--limit=3}', function (GoogleMatcher $matcher) {
    $this->info('Processed '.$matcher->run((int) $this->option('limit')).' matches.');
});
Artisan::command('places:rank', function (SupabaseClient $client) {
    $client->request('POST', '/rest/v1/rpc/mt_refresh_daily_picks', admin: true);
    $this->info('Updated the daily community picks.');
});

// One source of truth for intervals (config/tasks.php), shared with the container
// loop and the external trigger at POST /api/internal/tasks.
Artisan::command('tasks:run-due', function (RecurringTasks $tasks) {
    $result = $tasks->runDue();
    $this->info('Ran: '.(implode(', ', $result['ran']) ?: 'nothing due').($result['failed'] ? '. Failed: '.implode(', ', $result['failed']) : '.'));
})->purpose('Run recurring maintenance tasks that are due');
Schedule::command('tasks:run-due')->everyMinute()->withoutOverlapping();
