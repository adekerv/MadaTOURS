<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TourRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['name', 'nameFr', 'description', 'descriptionFr'] as $field) {
            if (is_string($this->input($field))) {
                $value = trim($this->input($field));
                $this->merge([$field => $value === '' && str_ends_with($field, 'Fr') ? null : $value]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:120', 'not_regex:/[\p{C}<>]/u'],
            'nameFr' => ['nullable', 'string', 'min:3', 'max:120', 'not_regex:/[\p{C}<>]/u'],
            'description' => ['required', 'string', 'min:10', 'max:2000', 'not_regex:/[<>]/u'],
            'descriptionFr' => ['nullable', 'string', 'min:10', 'max:2000', 'not_regex:/[<>]/u'],
            'published' => ['boolean'],
            'featured' => ['boolean'],
            'image' => ['nullable', 'string', 'max:2000', 'regex:/^(https:\/\/[^\s<>"]+|\/photos\/[^\s<>"]+)$/'],
            'stops' => ['required', 'array', 'min:2', 'max:25'],
            'stops.*.placeId' => ['required', 'integer', 'min:1', 'distinct'],
            'stops.*.minutes' => ['required', 'integer', 'between:5,720'],
        ];
    }

    public function messages(): array
    {
        return [
            'stops.required' => 'Choose at least two stops.',
            'stops.min' => 'Choose at least two stops.',
            'stops.max' => 'A tour can have up to 25 stops.',
            'stops.*.placeId.distinct' => 'A place can appear once in a tour.',
            'stops.*.minutes.between' => 'A visit lasts between 5 and 720 minutes.',
            'image.regex' => 'The image address must start with https://.',
            'name.not_regex' => 'The tour name cannot contain < or > or control characters.',
            'nameFr.not_regex' => 'The tour name cannot contain < or > or control characters.',
            'description.not_regex' => 'The description cannot contain < or >.',
            'descriptionFr.not_regex' => 'The description cannot contain < or >.',
        ];
    }

    /** The columns to store. The stored route is never taken from the request. */
    public function columns(): array
    {
        $data = $this->validated();

        $columns = [
            'name' => $data['name'],
            'name_fr' => $data['nameFr'] ?? null,
            'description' => $data['description'],
            'description_fr' => $data['descriptionFr'] ?? null,
            'published' => (bool) ($data['published'] ?? false),
            'stops' => array_map(fn ($stop) => ['placeId' => (int) $stop['placeId'], 'minutes' => (int) $stop['minutes']], $data['stops']),
        ];
        // Sent only by the admin dashboard; a client that leaves them out keeps what the tour has.
        if (array_key_exists('featured', $data)) {
            $columns['featured'] = (bool) $data['featured'];
        }
        if (array_key_exists('image', $data)) {
            $columns['image'] = is_string($data['image']) && trim($data['image']) !== '' ? trim($data['image']) : null;
        }

        return $columns;
    }
}
