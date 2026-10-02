<?php

namespace App\Http\Controllers;

use App\Services\RecurringTasks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** External cron trigger for hosts that cannot run a scheduler process. */
class RecurringTaskController extends Controller
{
    public function __invoke(Request $request, RecurringTasks $tasks): JsonResponse
    {
        $secret = (string) config('tasks.secret');
        abort_if(strlen($secret) < 32, 404);
        abort_unless(hash_equals($secret, (string) $request->bearerToken()), 404);

        return response()->json($tasks->runDue());
    }
}
