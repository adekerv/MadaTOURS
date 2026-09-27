<?php

namespace App\Http\Requests;

use App\Exceptions\ApiException;
use Illuminate\Foundation\Http\FormRequest;

class StorePlaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        if ($this->attributes->get('account')['role'] !== 'admin') throw new ApiException(403, 'Only administrators can manage places.');
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'], 'type' => ['required', 'in:restaurant,activity'],
            'lat' => ['required', 'numeric', 'between:-90,90'], 'lng' => ['required', 'numeric', 'between:-180,180'],
            'location' => ['required', 'string', 'max:160'], 'description' => ['required', 'string', 'max:3000'],
            'description_fr' => ['sometimes', 'nullable', 'string', 'max:3000'], 'rating' => ['sometimes', 'nullable', 'numeric', 'between:0,5'],
            'hours' => ['sometimes', 'nullable', 'string', 'max:200'], 'tags' => ['sometimes', 'array', 'max:20'],
            'tags.*' => ['required', 'string', 'max:40'], 'image' => ['sometimes', 'nullable', 'url:https', 'max:2000'],
        ];
    }
}
