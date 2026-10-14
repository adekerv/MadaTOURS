<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The contact inbox: messages sent from the contact page, read, marked as handled or deleted. */
class AdminMessageController extends AdminController
{
    public function index(Request $request): JsonResponse
    {
        $query = $this->listQuery($request, ['newest', 'oldest', 'status'], [
            'status' => ['nullable', Rule::in(['new', 'read', 'handled'])],
        ]);

        return response()->json($this->page($this->rpc('mt_admin_messages', [
            'search_text' => $query['search'], 'status_filter' => $query['filters']['status'] ?? '', 'sort_key' => $query['sort'],
            'page_offset' => $query['offset'], 'page_size' => $query['perPage'],
        ]), $query));
    }

    public function status(Request $request, string $id): JsonResponse
    {
        $status = $request->validate(['status' => ['required', Rule::in(['new', 'read', 'handled'])]])['status'];
        $message = $this->rpc('mt_admin_message_write', ['action' => $status, 'target' => $this->id($id)]);
        if ($status === 'handled') {
            $this->log->record('messages.handled', 'Marked the message “'.$message['subject'].'” as handled', 'message', $id);
        }

        return response()->json($message);
    }

    public function destroy(string $id): JsonResponse
    {
        $message = $this->rpc('mt_admin_message_write', ['action' => 'delete', 'target' => $this->id($id)]);
        $this->log->record('messages.delete', 'Deleted the message “'.$message['subject'].'”', 'message', $id);

        return response()->json(['success' => true]);
    }

    private function id(string $id): int
    {
        validator(['id' => $id], ['id' => 'required|integer|min:1|max:9007199254740991'])->validate();

        return (int) $id;
    }
}
