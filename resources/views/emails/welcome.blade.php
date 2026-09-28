<!doctype html>
<html lang="{{ $language }}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#fff7ed;color:#0f172a;font-family:Arial,sans-serif;padding:32px 16px">
<main style="max-width:560px;margin:auto;background:white;border-radius:20px;padding:32px">
    <p style="color:#c2410c;font-weight:bold;letter-spacing:2px">MADATOURS</p>
    <h1>{{ $language === 'fr' ? 'Bienvenue' : 'Welcome' }}, {{ $displayName }} !</h1>
    <p>{{ $language === 'fr' ? 'Merci pour votre inscription ! Votre compte est prêt.' : 'Thanks for signing up! Your account is ready.' }}</p>
    <p>{{ $language === 'fr' ? 'Découvrez la Martinique, sauvegardez vos lieux favoris et préparez votre prochaine sortie.' : 'Discover Martinique, save your favorite places, and plan your next day out.' }}</p>
    <p>{{ $language === 'fr' ? 'Aucune vérification par email n’est nécessaire. À bientôt sur MadaTours !' : 'No email verification is needed. See you on MadaTours!' }}</p>
    <p style="font-size:12px;color:#64748b">{{ $language === 'fr' ? 'Si vous n’avez pas créé ce compte, vous pouvez ignorer cet email.' : 'If you did not create this account, you can ignore this email.' }}</p>
</main>
</body>
</html>
