<!doctype html>
<html lang="{{ $language }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>{{ $copy['title'] }} — MadaTours</title>
    <meta name="description" content="{{ $copy['intro'] }}">
    <link rel="icon" href="/favicon.svg">
    <meta name="theme-color" content="#fdfcfb">
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #fdfcfb; color: #0f172a; font: 17px/1.7 system-ui, sans-serif; }
        main, nav, footer {
            max-width: 800px;
            margin: auto;
            padding: 24px max(24px, env(safe-area-inset-right)) 24px max(24px, env(safe-area-inset-left));
        }
        nav, footer { display: flex; flex-wrap: wrap; gap: 20px; border-bottom: 1px solid #e2e8f0; }
        nav { padding-top: max(24px, env(safe-area-inset-top)); }
        a { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; color: #9a3412; overflow-wrap: anywhere; }
        h1 { font-size: clamp(30px, 6vw, 42px); line-height: 1.2; }
        h2 { font-size: 22px; line-height: 1.4; }
        section { margin: 36px 0; }
        p { overflow-wrap: anywhere; }
        footer { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
    </style>
</head>
<body>
    <nav aria-label="Navigation">
        <a href="/?lang={{ $language }}">MadaTours</a>
        <a href="?lang=en" lang="en">English</a>
        <a href="?lang=fr" lang="fr">Français</a>
    </nav>
    <main>
        <h1>{{ $copy['title'] }}</h1>
        <p>{{ $copy['intro'] }}</p>
        @foreach ($copy['sections'] as $section)
            <section>
                <h2>{{ $section['title'] }}</h2>
                <p>{{ $section['body'] }}</p>
            </section>
        @endforeach
        <a href="mailto:adejkervin@protonmail.com">adejkervin@protonmail.com</a>
        @if ($page === 'delete-account')
            <p><a href="/?lang={{ $language }}#delete-account">{{ $language === 'fr' ? 'Ouvrir la gestion du compte' : 'Open account management' }}</a></p>
        @endif
    </main>
    <footer>
        <a href="/privacy?lang={{ $language }}">{{ $language === 'fr' ? 'Confidentialité' : 'Privacy' }}</a>
        <a href="/terms?lang={{ $language }}">{{ $language === 'fr' ? 'Conditions' : 'Terms' }}</a>
        <a href="/delete-account?lang={{ $language }}">{{ $language === 'fr' ? 'Suppression du compte' : 'Account deletion' }}</a>
    </footer>
</body>
</html>
