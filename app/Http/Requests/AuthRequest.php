<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AuthRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) $this->merge(['email' => strtolower(trim($this->input('email')))]);
        if (is_string($this->input('token'))) $this->merge(['token' => trim($this->input('token'))]);
    }

    public function rules(): array
    {
        $action = $this->route()->getActionMethod();
        $rules = ['email' => ['required', 'string', 'email:rfc', 'max:254']];
        if (in_array($action, ['register', 'login', 'resetPassword'])) $rules['password'] = ['required', 'string', 'min:'.($action === 'login' ? 1 : 12), 'max:128'];
        if (in_array($action, ['verify', 'resetPassword'])) $rules['token'] = ['required', 'string', 'regex:/^[0-9]{6,10}$/'];
        return $rules;
    }
}
