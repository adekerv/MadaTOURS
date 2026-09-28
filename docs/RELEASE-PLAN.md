# Laravel release checklist

1. Configure a PHP/container host using [DEPLOYMENT.md](DEPLOYMENT.md).
2. Back up the existing Supabase project, then apply Laravel migrations and the repeat-safe seed.
3. Configure a persistent application key, server-only Supabase keys, HTTPS origins and session storage.
4. Run PHP, TypeScript, PostgreSQL integration, build and browser checks.
5. Deploy, check `/up` and `/api/health`, and verify real email delivery and cross-device saved lists.
6. Point native builds at the Laravel HTTPS origin and validate cookies on physical devices.

The previous Node/Vercel deployment is historical. This repository does not publish changes automatically during local migration work. Keep existing traffic on its working deployment until the Laravel release is verified.
