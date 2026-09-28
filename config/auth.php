<?php

return [
    // Supabase owns credentials and verification; Laravel owns the HTTP session.
    'defaults' => ['guard' => 'supabase'],
    'guards' => ['supabase' => ['driver' => 'supabase']],
];
