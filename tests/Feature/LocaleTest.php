<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LocaleTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'app.url' => 'https://madatours.test', 'supabase.app_origin' => 'https://madatours.test', 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key']);
        Http::preventStrayRequests();
    }

    private function register(string $language, array $changes = [])
    {
        return $this->withHeaders(['X-MadaTours-Client' => '1', 'Accept-Language' => $language])
            ->postJson('/api/auth/register', array_replace(['name' => 'Camille', 'email' => 'camille@example.test', 'password' => 'a long test password'], $changes));
    }

    public function test_validation_errors_follow_the_language_the_app_sends(): void
    {
        $this->register('fr', ['password' => 'court'])->assertStatus(400)
            ->assertJsonPath('error', 'Le champ mot de passe doit contenir au moins 12 caractères.');
        $this->register('fr', ['email' => 'not-an-address'])->assertStatus(400)
            ->assertJsonPath('error', 'Le champ adresse e-mail doit être une adresse e-mail valide.');
        $this->register('en', ['password' => 'court'])->assertStatus(400)
            ->assertJsonPath('error', 'The password field must be at least 12 characters.');
        Http::assertNothingSent();
    }

    public function test_a_browser_language_list_and_a_missing_header_pick_a_supported_language(): void
    {
        $this->register('fr-FR,fr;q=0.9,en;q=0.8', ['password' => 'court'])->assertJsonPath('error', 'Le champ mot de passe doit contenir au moins 12 caractères.');
        $this->register('de-DE,de;q=0.9', ['password' => 'court'])->assertJsonPath('error', 'The password field must be at least 12 characters.');
        $this->withHeader('X-MadaTours-Client', '1')->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'camille@example.test', 'password' => 'court'])
            ->assertJsonPath('error', 'The password field must be at least 12 characters.');
    }

    public function test_our_own_messages_stay_as_written_for_the_app_to_translate(): void
    {
        $this->withHeaders(['X-MadaTours-Client' => '1', 'Accept-Language' => 'fr'])->postJson('/api/auth/recover', ['email' => 'camille@example.test', 'code' => '!', 'password' => 'a long test password'])
            ->assertStatus(400)->assertJsonPath('error', 'Enter a recovery code exactly as you saved it, for example K7QM2-WX4TP.');
    }
}
