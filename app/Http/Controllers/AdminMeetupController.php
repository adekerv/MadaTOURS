<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Meet-ups are the app's bookings: each has a date, a price paid on the day, a capacity and join requests. Nothing is
 * paid through the app, so there is no revenue to report.
 */
class AdminMeetupController extends AdminController
{
    private const FILTERS = [
        'status' => ['nullable', 'in:live,expired,cancelled'],
        'from' => ['nullable', 'date_format:Y-m-d'],
        'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        'place' => ['nullable', 'integer', 'min:1', 'max:9007199254740991'],
    ];

    public function index(Request $request): JsonResponse
    {
        $query = $this->listQuery($request, ['soonest', 'latest', 'created', 'price'], self::FILTERS);

        return response()->json($this->page($this->rpc('mt_admin_meetups', [
            ...$this->filters($query), 'sort_key' => $query['sort'], 'page_offset' => $query['offset'], 'page_size' => $query['perPage'],
        ]), $query));
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->rpc('mt_admin_meetup', ['target' => $this->id($id)]));
    }

    public function status(Request $request, string $id): JsonResponse
    {
        $status = $request->validate(['status' => ['required', Rule::in(['live', 'cancelled'])]])['status'];
        $meetup = $this->rpc('mt_admin_meetup_write', ['action' => $status === 'live' ? 'reopen' : 'cancel', 'target' => $this->id($id), 'member' => null]);
        $this->log->record('meetups.'.($status === 'live' ? 'reopen' : 'cancel'), ($status === 'live' ? 'Reopened' : 'Cancelled').' the meet-up “'.$meetup['title'].'”', 'meetup', $id);

        return response()->json($this->rpc('mt_admin_meetup', ['target' => $this->id($id)]));
    }

    public function decide(Request $request, string $id, string $user): JsonResponse
    {
        validator(['user' => $user], ['user' => 'required|uuid'])->validate();
        $status = $request->validate(['status' => ['required', Rule::in(['pending', 'accepted', 'declined'])]])['status'];
        $meetup = $this->rpc('mt_admin_meetup_write', ['action' => $status, 'target' => $this->id($id), 'member' => $user]);
        $this->log->record('meetups.request', 'Set a request for “'.$meetup['title'].'” to '.$status, 'meetup', $id, ['user' => $user, 'status' => $status]);

        return response()->json($this->rpc('mt_admin_meetup', ['target' => $this->id($id)]));
    }

    /** Every join request of the filtered meet-ups, one per line. */
    public function export(Request $request): StreamedResponse
    {
        $query = $this->listQuery($request, ['soonest'], self::FILTERS);
        $rows = $this->rpc('mt_admin_meetup_export', $this->filters($query));
        $columns = ['meetup_id' => 'Meet-up ID', 'title' => 'Meet-up', 'starts_at' => 'Starts at', 'location' => 'Location', 'place_name' => 'Place',
            'price' => 'Price (EUR)', 'capacity' => 'Capacity', 'meetup_status' => 'Meet-up status', 'host' => 'Host', 'host_email' => 'Host email',
            'participant' => 'Participant', 'participant_email' => 'Participant email', 'request_status' => 'Request status', 'requested_at' => 'Requested at'];
        $this->log->record('meetups.export', 'Exported '.count($rows).' meet-up requests to CSV', 'meetup');

        return response()->streamDownload(function () use ($rows, $columns) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\u{FEFF}");
            fputcsv($out, array_values($columns), escape: '');
            foreach ($rows as $row) {
                fputcsv($out, array_map(fn ($key) => self::cell($row[$key] ?? ''), array_keys($columns)), escape: '');
            }
            fclose($out);
        }, 'madatours-meetups-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function filters(array $query): array
    {
        return [
            'search_text' => $query['search'], 'status_filter' => $query['filters']['status'] ?? '',
            'from_date' => $query['filters']['from'] ?? null, 'to_date' => $query['filters']['to'] ?? null,
            'place_filter' => isset($query['filters']['place']) ? (int) $query['filters']['place'] : null,
        ];
    }

    private function id(string $id): int
    {
        validator(['id' => $id], ['id' => 'required|integer|min:1|max:9007199254740991'])->validate();

        return (int) $id;
    }

    /** Spreadsheets run cells that start with = + - @ as formulas; a leading apostrophe keeps them as text. */
    private static function cell(mixed $value): string
    {
        $text = is_scalar($value) ? (string) $value : '';

        return preg_match('/^[=+\-@\t\r]/', $text) ? "'".$text : $text;
    }
}
