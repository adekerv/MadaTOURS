<?php

namespace App\Services;

use App\Mail\WelcomeMail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class WelcomeMessage
{
    public function send(array $user, string $language): void
    {
        try {
            Mail::to($user['email'])->send(new WelcomeMail($user['name'], $language));
        } catch (Throwable) {
            // A delivery failure must not turn a successfully created account into a failed signup.
            // Do not log SMTP exception messages: they can contain credentials or recipients.
            Log::warning('Welcome email delivery failed. Check the configured mail transport.');
        }
    }
}
