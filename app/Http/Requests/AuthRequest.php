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
        if (is_string($this->input('code'))) {
            $this->merge(['code' => trim($this->input('code'))]);
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
        if ($action === 'recover') {
            $rules['code'] = ['required', 'string', 'regex:/^[A-Za-z0-9 -]{10,24}$/'];
        }
        if (in_array($action, ['register', 'login', 'recover'])) {
            $rules['password'] = ['required', 'string', 'min:'.($action === 'login' ? 1 : 12), 'max:128'];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'code.required' => 'Enter one of your recovery codes.',
            'code.regex' => 'Enter a recovery code exactly as you saved it, for example K7QM2-WX4TP.',
        ];
    }
}
