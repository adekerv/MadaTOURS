<?php

namespace Tests\Feature;

use Tests\TestCase;

class InformationTest extends TestCase
{
    public function test_store_policy_urls_are_public_bilingual_and_readable_without_javascript(): void
    {
        foreach (['privacy', 'terms', 'delete-account'] as $page) {
            foreach (['en', 'fr'] as $language) {
                $copy = json_decode(file_get_contents(resource_path('content/information.json')), true);
                $this->get('/'.$page.'?lang='.$language)
                    ->assertOk()->assertSee($copy[$language][$page]['title'])
                    ->assertSee('adejkervin@protonmail.com')
                    ->assertCookieMissing('madatours-session');
            }
        }
    }
}
