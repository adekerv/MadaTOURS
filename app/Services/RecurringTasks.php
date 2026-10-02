<?php

namespace App\Services;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Runs each configured command at most once per interval, whatever triggers it:
 * the scheduler, the container loop or an external cron request. Cache::add
 * claims a task atomically, so concurrent triggers cannot run it twice.
 */
class RecurringTasks
{
    /** @return array{ran: list<string>, failed: list<string>} */
    public function runDue(): array
    {
        $result = ['ran' => [], 'failed' => []];
        foreach (config('tasks.recurring') as $command => $minutes) {
            if (! Cache::add('recurring-task:'.$command, now()->toIso8601String(), max(60, (int) $minutes * 60 - 30))) {
                continue;
            }
            try {
                Artisan::call($command);
                $result['ran'][] = $command;
            } catch (Throwable $error) {
                // Keep the claim so a failing provider is not retried every minute.
                Log::warning('Recurring task failed', ['command' => $command, 'exception_type' => $error::class]);
                $result['failed'][] = $command;
            }
        }

        return $result;
    }
}
