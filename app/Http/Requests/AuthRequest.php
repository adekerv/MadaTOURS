<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AuthRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => strtolower(trim($this->input('email')))]);
        }
        if (is_string($this->input('token'))) {
            $this->merge(['token' => trim($this->input('token'))]);
        }
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    public function rules(): array
    {
        $action = $this->route()->getActionMethod();
        $rules = ['email' => ['required', 'string', 'email:rfc', 'max:254']];
        if ($action === 'register') {
            $rules['name'] = ['required', 'string', 'min:1', 'max:80', 'not_regex:/[\p{C}<>]/u'];
            $rules['language'] = ['sometimes', 'in:en,fr'];
        }
        if (in_array($action, ['register', 'login', 'resetPassword'])) {
            $rules['password'] = ['required', 'string', 'min:'.($action === 'login' ? 1 : 12), 'max:128'];
        }
        if (in_array($action, ['verify', 'resetPassword'])) {
            $rules['token'] = ['required', 'string', 'regex:/^[0-9]{6,10}$/'];
        }

        return $rules;
    }
}
