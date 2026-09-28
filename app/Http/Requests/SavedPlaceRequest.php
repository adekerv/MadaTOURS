<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SavedPlaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['placeId' => ['required', 'integer', 'min:1', 'max:9007199254740991']];
    }
}
