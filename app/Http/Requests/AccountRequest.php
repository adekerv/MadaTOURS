<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Input rules for the settings page. Messages are shown to people, so they are plain sentences. */
class AccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['name', 'confirmation'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
        if (is_string($this->input('email'))) {
            $this->merge(['email' => strtolower(trim($this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return match ($this->route()->getActionMethod()) {
            'profile' => [
                'name' => ['sometimes', 'required', 'string', 'max:80', 'not_regex:/[\p{C}<>]/u'],
                'language' => ['sometimes', 'required', 'in:en,fr'],
            ],
            'email' => [
                'email' => ['required', 'string', 'email:rfc', 'max:254'],
                'password' => ['required', 'string', 'max:128'],
            ],
            'recoveryCodes' => [
                'password' => ['required', 'string', 'max:128'],
            ],
            'destroy' => [
                'password' => [Rule::requiredIf(fn () => $this->user()->hasPassword !== false), 'nullable', 'string', 'max:128'],
                'confirmation' => ['required', 'string', 'max:254', fn ($attribute, $value, $fail) => strcasecmp($value, $this->user()->email) === 0 || $fail('Type your email address exactly to confirm.')],
            ],
            default => [],
        };
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Enter a name.',
            'name.max' => 'Your name can have up to 80 characters.',
            'name.not_regex' => 'Your name cannot contain < or > or control characters.',
            'language.in' => 'Choose English or French.',
            'email.required' => 'Enter your new email address.',
            'email.email' => 'Enter a valid email address.',
            'password.required' => 'Enter your password to confirm.',
            'confirmation.required' => 'Type your email address exactly to confirm.',
        ];
    }
}
