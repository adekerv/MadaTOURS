<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RecurringTasksTest extends TestCase
{
    private string $secret;

    protected function setUp(): void
    {
        parent::setUp();
        $this->secret = str_repeat('s', 40);
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'tasks.secret' => $this->secret, 'tasks.recurring' => ['inspire' => 5]]);
        Http::preventStrayRequests();
        Cache::flush();
    }

    private function trigger(?string $token)
    {
        return $this->withHeaders(['X-MadaTours-Client' => '1'] + ($token ? ['Authorization' => 'Bearer '.$token] : []))->postJson('/api/internal/tasks');
    }

    public function test_trigger_is_hidden_without_a_configured_or_matching_secret(): void
    {
        $this->trigger(null)->assertNotFound();
        $this->trigger('wrong')->assertNotFound();
        config(['tasks.secret' => 'short']);
        $this->trigger('short')->assertNotFound();
        $this->assertFalse(Cache::has('recurring-task:inspire'));
    }

    public function test_due_tasks_run_once_per_interval(): void
    {
        $this->trigger($this->secret)->assertOk()->assertExactJson(['ran' => ['inspire'], 'failed' => []]);
        $this->trigger($this->secret)->assertOk()->assertExactJson(['ran' => [], 'failed' => []]);
        $this->travel(6)->minutes();
        $this->trigger($this->secret)->assertOk()->assertJsonPath('ran', ['inspire']);
    }

    public function test_a_failing_task_is_reported_without_stopping_the_others(): void
    {
        config(['tasks.recurring' => ['google:match' => 60, 'inspire' => 5], 'enrichment.google_key' => null]);
        $this->artisan('tasks:run-due')->expectsOutput('Ran: inspire. Failed: google:match')->assertSuccessful();
        Http::assertNothingSent();
    }

    public function test_scheduler_delegates_to_the_single_task_list(): void
    {
        Artisan::call('schedule:list');
        $output = Artisan::output();
        $this->assertStringContainsString('tasks:run-due', $output);
        $this->assertStringNotContainsString('google:match', $output);
    }
}
