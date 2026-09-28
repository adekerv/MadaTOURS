<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class WelcomeMail extends Mailable
{
    public function __construct(public string $displayName, public string $language = 'en') {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->language === 'fr' ? 'Merci pour votre inscription à MadaTours !' : 'Thanks for signing up to MadaTours!');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.welcome', text: 'emails.welcome-text');
    }
}
