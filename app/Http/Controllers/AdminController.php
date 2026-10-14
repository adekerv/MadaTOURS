<?php

namespace App\Http\Controllers;

use App\Services\AdminLog;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Shared ground for the admin dashboard's controllers. The routes already require an administrator (can:administer),
 * and every database function checks again, with the administrator's own session.
 */
abstract class AdminController extends Controller
{
    protected const PAGE_SIZES = [10, 20, 50];

    public function __construct(protected SupabaseClient $client, protected AuthService $auth, protected AdminLog $log) {}

    protected function rpc(string $function, array $arguments = []): mixed
    {
        return $this->client->request('POST', '/rest/v1/rpc/'.$function, $arguments, $this->auth->token());
    }

    /**
     * Reads the search, sort and page of a list, plus any filters the list adds.
     *
     * @param  list<string>  $sorts  Allowed sort keys; the first is the default
     * @param  array<string, mixed>  $filters  Extra validation rules
     * @return array{search: string, sort: string, page: int, perPage: int, offset: int, filters: array<string, mixed>}
     */
    protected function listQuery(Request $request, array $sorts, array $filters = []): array
    {
        $input = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', Rule::in($sorts)],
            'page' => ['nullable', 'integer', 'min:1', 'max:5000'],
            'perPage' => ['nullable', 'integer', Rule::in(self::PAGE_SIZES)],
            ...$filters,
        ]);
        $page = (int) ($input['page'] ?? 1);
        $perPage = (int) ($input['perPage'] ?? 20);

        return [
            'search' => trim((string) ($input['search'] ?? '')),
            'sort' => $input['sort'] ?? $sorts[0],
            'page' => $page,
            'perPage' => $perPage,
            'offset' => ($page - 1) * $perPage,
            'filters' => array_intersect_key($input, $filters),
        ];
    }

    /** @param array{total?: int, rows?: list<mixed>} $result */
    protected function page(array $result, array $query): array
    {
        return ['total' => (int) ($result['total'] ?? 0), 'rows' => $result['rows'] ?? [], 'page' => $query['page'], 'perPage' => $query['perPage']] + array_diff_key($result, ['total' => 0, 'rows' => 0]);
    }
}
