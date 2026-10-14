<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PostgresMigrationTest extends TestCase
{
    public function test_artisan_migrations_and_seed_preserve_existing_accounts_edits_and_deletions(): void
    {
        $url = getenv('MADATOURS_TEST_POSTGRES_URL');
        if (! $url) {
            $this->markTestSkipped('Set MADATOURS_TEST_POSTGRES_URL to a dedicated local PostgreSQL *_test database. CI runs this test.');
        }
        $parsed = parse_url($url);
        $this->assertContains($parsed['host'] ?? '', ['127.0.0.1', 'localhost']);
        $this->assertStringEndsWith('_test', $parsed['path'] ?? '');
        config([
            'database.default' => 'migration_test',
            'database.connections.migration_test' => [
                'driver' => 'pgsql', 'url' => $url, 'charset' => 'utf8', 'prefix' => '',
                'search_path' => 'public', 'sslmode' => 'disable',
            ],
        ]);
        $connection = DB::connection();
        $connection->beginTransaction();
        try {
            // Only the minimal Supabase contract; all application DDL is run by Artisan.
            $connection->unprepared(<<<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}',
  raw_app_meta_data jsonb DEFAULT '{"providers":["email"]}', created_at timestamptz DEFAULT now(),
  last_sign_in_at timestamptz, banned_until timestamptz);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon,authenticated,service_role;
INSERT INTO auth.users(id, email) VALUES ('00000000-0000-4000-8000-000000000001', 'existing@example.test');
SQL);
            $this->artisan('migrate', ['--force' => true])->assertSuccessful();
            $this->assertFalse(DB::selectOne("SELECT has_table_privilege('anon', 'public.mt_migrations', 'SELECT') AS allowed")->allowed);
            $this->artisan('db:seed', ['--force' => true])->assertSuccessful();
            $this->assertSame(1, DB::table('mt_profiles')->count());
            $this->assertTrue(DB::selectOne("SELECT to_regclass('public.mt_photo_permissions') IS NOT NULL AND to_regclass('public.mt_site_settings') IS NOT NULL AS installed")->installed);
            $this->assertSame(364, DB::table('mt_places')->count());
            DB::table('mt_places')->where('id', 1)->update(['name' => 'Existing editorial change']);
            DB::table('mt_places')->where('id', 2)->delete();
            $this->artisan('migrate', ['--force' => true])->assertSuccessful();
            $this->artisan('db:seed', ['--force' => true])->assertSuccessful();
            $this->assertSame(363, DB::table('mt_places')->count());
            $this->assertSame('Existing editorial change', DB::table('mt_places')->where('id', 1)->value('name'));
            $this->assertFalse(DB::table('mt_places')->where('id', 2)->exists());
            $this->assertGreaterThan(DB::table('mt_places')->max('id'), (int) DB::selectOne("SELECT nextval('mt_places_id_seq') AS id")->id);
        } finally {
            $connection->rollBack();
            DB::purge('migration_test');
        }
    }
}
