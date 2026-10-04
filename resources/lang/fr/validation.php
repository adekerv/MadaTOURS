<?php

/*
 | French wording for the checks this app runs. Rules that are not listed here fall back to the framework's English
 | text. The visitor's language arrives in the Accept-Language header (see App\Http\Middleware\ApiLocale).
 */
return [
    'accepted' => 'Le champ :attribute doit être accepté.',
    'array' => 'Le champ :attribute doit être une liste.',
    'between' => [
        'array' => 'Le champ :attribute doit contenir entre :min et :max éléments.',
        'file' => 'Le fichier :attribute doit peser entre :min et :max kilo-octets.',
        'numeric' => 'Le champ :attribute doit être compris entre :min et :max.',
        'string' => 'Le champ :attribute doit contenir entre :min et :max caractères.',
    ],
    'boolean' => 'Le champ :attribute doit être vrai ou faux.',
    'distinct' => 'Le champ :attribute contient une valeur en double.',
    'email' => 'Le champ :attribute doit être une adresse e-mail valide.',
    'image' => 'Le champ :attribute doit être une image.',
    'in' => 'La valeur choisie pour :attribute n’est pas valide.',
    'integer' => 'Le champ :attribute doit être un nombre entier.',
    'json' => 'Le champ :attribute doit être un JSON valide.',
    'max' => [
        'array' => 'Le champ :attribute ne doit pas contenir plus de :max éléments.',
        'file' => 'Le fichier :attribute ne doit pas dépasser :max kilo-octets.',
        'numeric' => 'Le champ :attribute ne doit pas être supérieur à :max.',
        'string' => 'Le champ :attribute ne doit pas dépasser :max caractères.',
    ],
    'min' => [
        'array' => 'Le champ :attribute doit contenir au moins :min éléments.',
        'file' => 'Le fichier :attribute doit peser au moins :min kilo-octets.',
        'numeric' => 'Le champ :attribute doit être au moins égal à :min.',
        'string' => 'Le champ :attribute doit contenir au moins :min caractères.',
    ],
    'not_regex' => 'Le champ :attribute contient des caractères non autorisés.',
    'numeric' => 'Le champ :attribute doit être un nombre.',
    'regex' => 'Le format du champ :attribute n’est pas valide.',
    'required' => 'Le champ :attribute est obligatoire.',
    'required_without' => 'Le champ :attribute est obligatoire quand :values est absent.',
    'string' => 'Le champ :attribute doit être un texte.',
    'url' => 'Le champ :attribute doit être une adresse web valide.',
    'uploaded' => 'Le fichier :attribute n’a pas pu être envoyé.',

    // People read these names, not the technical field names.
    'attributes' => [
        'code' => 'code de récupération',
        'comment' => 'commentaire',
        'confirmation' => 'confirmation',
        'description' => 'description',
        'description_fr' => 'description en français',
        'email' => 'adresse e-mail',
        'hours' => 'horaires',
        'image' => 'image',
        'language' => 'langue',
        'lat' => 'latitude',
        'lng' => 'longitude',
        'location' => 'ville',
        'name' => 'nom',
        'nameFr' => 'nom en français',
        'descriptionFr' => 'description en français',
        'password' => 'mot de passe',
        'photo' => 'photo',
        'radius' => 'rayon',
        'rating' => 'note',
        'stops' => 'étapes',
        'stops.*.minutes' => 'durée de la visite',
        'stops.*.placeId' => 'lieu',
        'tags' => 'étiquettes',
        'tags.*' => 'étiquette',
        'type' => 'catégorie',
    ],
];
