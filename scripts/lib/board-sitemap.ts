import type { SourceFetcher } from './source-fetch';
/**
 * The tourism board lists its current venue pages in a public sitemap. A venue that has left the board's
 * database drops out of it, so membership is evidence that a listing is still maintained. The dates are
 * kept as supporting information only: they can change on automated data syncs.
 */
export const boardSitemapUrl = 'https://www.martinique.org/sitemap.xml';
export type BoardSitemap = Map<string, string>;
export async function loadBoardSitemap(fetcher: SourceFetcher): Promise<BoardSitemap | undefined> {
  const response = await fetcher.get(boardSitemapUrl, 'xml');
  if (response.status !== 'ok' || !response.html) return undefined;
  const entries: BoardSitemap = new Map();
  for (const block of response.html.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block[1])?.[1]?.trim();
    const modified = /<lastmod>([^<]+)<\/lastmod>/.exec(block[1])?.[1]?.slice(0, 10) ?? '';
    if (loc) entries.set(loc.replace(/\/+$/, ''), modified);
  }
  return entries.size > 100 ? entries : undefined;
}
export const inBoardSitemap = (sitemap: BoardSitemap, ...urls: (string | undefined)[]) => {
  for (const url of urls)
    if (url && sitemap.has(url.replace(/\/+$/, '')))
      return { listed: true as const, modified: sitemap.get(url.replace(/\/+$/, '')) || undefined };
  return { listed: false as const, modified: undefined };
};
