<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class StorePlaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('manage-places');
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
