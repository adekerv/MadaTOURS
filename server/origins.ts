// Only trust configured origins and Vercel's own deployment metadata, never a
// caller-supplied Host/X-Forwarded-Host or a wildcard *.vercel.app suffix.
export function configuredOrigins(env: NodeJS.ProcessEnv = process.env) {
  const origins = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value?.trim()) return;
    try {
      const url = new URL(value.trim());
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.pathname && url.pathname !== '/')
      )
        return;
      if (url.protocol === 'https:' || url.protocol === 'http:') origins.add(url.origin);
      if (value.trim() === 'capacitor://localhost') origins.add('capacitor://localhost');
    } catch {
      // Invalid configuration must not widen the allowlist.
    }
  };
  add(env.APP_ORIGIN);
  for (const value of (env.ALLOWED_ORIGINS || '').split(',')) add(value);
  if (env.VERCEL === '1') {
    for (const hostname of [
      env.VERCEL_PROJECT_PRODUCTION_URL,
      env.VERCEL_URL,
      env.VERCEL_BRANCH_URL,
    ]) {
      if (hostname) add(`https://${hostname.trim()}`);
    }
  }
  return origins;
}
