<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The contact form. Messages land in the admin inbox; nothing is emailed. */
class ContactController extends Controller
{
    public function store(Request $request, SupabaseClient $client, AuthService $auth): JsonResponse
    {
        foreach (['name', 'email', 'subject'] as $field) {
            if (is_string($request->input($field))) {
                $request->merge([$field => trim($request->input($field))]);
            }
        }
        $input = $request->validate([
            'name' => ['required', 'string', 'max:80', 'not_regex:/[\p{C}<>]/u'],
            'email' => ['required', 'email:rfc', 'max:254'],
            'subject' => ['required', 'string', 'min:3', 'max:120', 'not_regex:/[\p{C}<>]/u'],
            'message' => ['required', 'string', 'min:10', 'max:4000'],
            // A field people never see: forms that fill it in are robots.
            'website' => ['nullable', 'max:0'],
        ], [
            'name.required' => 'Enter your name.',
            'email.required' => 'Enter your email address so we can answer.',
            'email.email' => 'Enter a valid email address.',
            'subject.required' => 'Add a subject.',
            'subject.min' => 'Add a subject of at least 3 characters.',
            'message.required' => 'Write your message.',
            'message.min' => 'Write a message of at least 10 characters.',
            'website.max' => 'Your message could not be sent. Please try again.',
        ]);
        $auth->limit('contact', strtolower($input['email']), 3);
        $userId = null;
        try {
            $userId = $auth->token() ? $auth->user()['id'] : null;
        } catch (ApiException) {
            // An expired or suspended session counts as a guest: the message is still welcome.
        }
        $client->request('POST', '/rest/v1/mt_contact_messages', [
            'user_id' => $userId, 'name' => $input['name'], 'email' => strtolower($input['email']),
            'subject' => $input['subject'], 'message' => trim($input['message']),
        ], admin: true, headers: ['Prefer' => 'return=minimal']);

        return response()->json(['success' => true], 201);
    }
}
