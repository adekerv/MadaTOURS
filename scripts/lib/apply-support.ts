import { mkdir, open, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { format, resolveConfig } from 'prettier';
/** Shared safety rails for the scripts that write to the live catalogue. */
export async function ensureListingSchema(client: SupabaseClient) {
  const { error } = await client
    .from('mt_places')
    .select('id,listing_status,archived,details')
    .limit(1);
  if (error)
    throw new Error(
      `The database does not have the listing columns yet (${error.message}). Apply database/schema/listing.sql first, then run this again.`,
    );
}
/** Only one writer at a time on this machine. It is not a distributed lock. */
export async function withLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  await mkdir('.data/locks', { recursive: true });
  const path = join('.data/locks', `${name}.lock`);
  let handle;
  try {
    handle = await open(path, 'wx');
  } catch {
    throw new Error(
      `Another ${name} run appears to be active (${path}). Confirm it has stopped, then remove the file.`,
    );
  }
  try {
    return await task();
  } finally {
    await handle.close();
    await unlink(path).catch(() => undefined);
  }
}
export async function backup(label: string, rows: unknown[]) {
  await mkdir('.data/backups', { recursive: true });
  const path = join(
    '.data/backups',
    `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  await writeFile(path, JSON.stringify(rows, null, 1));
  return path;
}
export async function latestReport(prefix: string, directory = 'reports') {
  const files = (await readdir(directory))
    .filter((file) => file.startsWith(prefix) && file.endsWith('.json'))
    .sort();
  if (!files.length)
    throw new Error(`No ${prefix}*.json report found in ${directory}/. Run the audit first.`);
  return join(directory, files[files.length - 1]);
}
export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}
export const csvIds = (value: string | undefined) =>
  new Set(
    (value ?? '')
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  );
/** Writes the bundled seed in the project's own formatting, so a sync produces a small, reviewable diff. */
export async function writeSeed(path: string, seed: unknown) {
  const config = (await resolveConfig(path)) ?? {};
  await writeFile(path, await format(JSON.stringify(seed), { ...config, filepath: path }));
}
/** JSON text with object keys sorted. Postgres reorders jsonb keys, so stored and sent values only match this way. */
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  );
