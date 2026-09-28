<?php

namespace App\Console\Commands;

use App\Exceptions\ApiException;
use App\Repositories\PlaceRepository;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Console\Command;

class CheckSupabase extends Command
{
    protected $signature = 'supabase:check';

    protected $description = 'Read-only check of the Supabase schema and public catalogue';

    public function handle(SupabaseClient $client, PlaceRepository $places): int
    {
        try {
            $metadata = $client->request('GET', '/rest/v1/mt_metadata', ['select' => 'value', 'key' => 'eq.schema_version']);
            if (($metadata[0]['value'] ?? null) !== '1') {
                $this->error('Unexpected database schema version.');

                return self::FAILURE;
            }
            $this->info('Supabase schema version 1 is available.');
            $this->info(count($places->published()).' published places are readable through database RLS.');
            $this->comment('This read-only check does not test authentication or email delivery.');

            return self::SUCCESS;
        } catch (ApiException $error) {
            $this->error($error->getMessage());

            return self::FAILURE;
        }
    }
}
