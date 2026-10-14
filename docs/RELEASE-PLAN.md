# Laravel release checklist

1. Production runs on Vercel (https://mada-tours.vercel.app); see [DEPLOYMENT.md](DEPLOYMENT.md). A PHP/container host remains an alternative.
2. Back up the Supabase project, then apply any new `database/schema` files before the code that needs them.
3. Configure a persistent application key, server-only Supabase keys, HTTPS origins and session storage.
4. Run PHP, TypeScript, PostgreSQL integration, build and browser checks.
5. Deploy, check `/up` and `/api/health`, and verify signup, recovery codes and cross-device saved lists.
6. Point native builds at the Laravel HTTPS origin and validate cookies on physical devices.

The earlier Node/Express deployment is historical; the Laravel version replaced it on the same Vercel project.
