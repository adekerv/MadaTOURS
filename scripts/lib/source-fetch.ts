import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
/**
 * A polite fetcher for cited source pages: robots.txt is honoured, each host is contacted one request
 * at a time with a pause between requests, and every response is cached on disk so a page is never
 * fetched twice while reviewing results.
 */
export const userAgent =
  'MadaToursSourceCheck/1.0 (+https://mada-tours.vercel.app; verifying cited venue sources)';
export type FetchStatus =
  | 'ok'
  | 'not_found'
  | 'blocked'
  | 'server_error'
  | 'dns'
  | 'timeout'
  | 'tls'
  | 'network'
  | 'robots_denied'
  | 'non_html'
  | 'too_large'
  | 'redirect_loop';
export interface SourceResponse {
  url: string;
  status: FetchStatus;
  httpStatus?: number;
  finalUrl?: string;
  hops: string[];
  contentType?: string;
  fetchedAt: string;
  html?: string;
  detail?: string;
}
const cacheDir = '.data/sources';
const maxBytes = 4 * 1024 * 1024;
const minDelayMs = 1000;
type Rule = [kind: 'allow' | 'disallow', pattern: string];
interface Robots {
  rules: Rule[];
  delayMs: number;
  /** robots.txt could not be read for a reason other than being absent. */
  unreadable: boolean;
}
export function parseRobots(text: string): Pick<Robots, 'rules' | 'delayMs'> {
  const groups: { agents: string[]; rules: Rule[]; delay: number }[] = [];
  let current: (typeof groups)[number] | undefined;
  let collecting = false;
  for (const raw of text.split(/\r\n|\n|\r/)) {
    const line = raw.split('#', 1)[0].trim();
    const at = line.indexOf(':');
    if (at < 0) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key === 'user-agent') {
      if (!current || !collecting) groups.push((current = { agents: [], rules: [], delay: 0 }));
      collecting = true;
      current.agents.push(value.toLowerCase());
    } else if (current) {
      collecting = false;
      if (key === 'allow' || key === 'disallow') current.rules.push([key, value]);
      else if (key === 'crawl-delay') current.delay = Math.max(current.delay, Number(value) || 0);
    }
  }
  const mine = groups.filter((group) => group.agents.includes('madatourssourcecheck'));
  const chosen = mine.length ? mine : groups.filter((group) => group.agents.includes('*'));
  return {
    rules: chosen.flatMap((group) => group.rules),
    // Conservative, like the production ingestion: the longest delay named anywhere in the file applies.
    delayMs: Math.max(0, ...groups.map((group) => group.delay)) * 1000,
  };
}
function normalizePath(value: string) {
  return value
    .replace(/%([0-9a-f]{2})/gi, (match, hex: string) =>
      /[a-z0-9._~-]/i.test(String.fromCharCode(parseInt(hex, 16)))
        ? String.fromCharCode(parseInt(hex, 16))
        : match.toUpperCase(),
    )
    .replace(/[^\u0020-\u007e]/g, (char) => encodeURIComponent(char));
}
export function robotsAllows(rules: Rule[], path: string): boolean {
  const target = normalizePath(path);
  let winner = -1;
  let allowed = true;
  for (const [kind, raw] of rules) {
    if (!raw) continue;
    const pattern = normalizePath(raw);
    const anchored = pattern.endsWith('$');
    const body = anchored ? pattern.slice(0, -1) : pattern;
    const expression = new RegExp(
      '^' +
        body
          .split('*')
          .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
          .join('.*') +
        (anchored ? '$' : ''),
    );
    const length = pattern.replace(/[*$]/g, '').length;
    if (expression.test(target) && (length > winner || (length === winner && kind === 'allow'))) {
      winner = length;
      allowed = kind === 'allow';
    }
  }
  return allowed;
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (value: string) => createHash('sha1').update(value).digest('hex').slice(0, 20);
/** HTML pages keep their original cache key; sitemaps are stored separately. */
const cacheKey = (url: string, kind: 'html' | 'xml') => hash(kind === 'xml' ? `${url}#xml` : url);
/** Only settled answers are reused; a timeout or network error is retried on the next run. */
const settled: FetchStatus[] = [
  'ok',
  'not_found',
  'blocked',
  'robots_denied',
  'non_html',
  'too_large',
];
function classify(error: unknown): { status: FetchStatus; detail: string } {
  const cause = (error as { cause?: { code?: string } })?.cause;
  const code = cause?.code ?? (error as { code?: string })?.code ?? '';
  const name = (error as Error)?.name ?? '';
  if (name === 'TimeoutError' || name === 'AbortError' || code === 'UND_ERR_CONNECT_TIMEOUT')
    return { status: 'timeout', detail: 'No response within 20 seconds.' };
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN')
    return { status: 'dns', detail: 'The domain name does not resolve.' };
  if (/CERT|TLS|SSL|ERR_TLS/i.test(code))
    return { status: 'tls', detail: `TLS problem (${code}).` };
  return { status: 'network', detail: `Network error${code ? ` (${code})` : ''}.` };
}
export class SourceFetcher {
  private robots = new Map<string, Promise<Robots>>();
  private lastRequest = new Map<string, number>();
  private queues = new Map<string, Promise<unknown>>();
  constructor(private options: { refresh?: boolean; cacheHours?: number } = {}) {}
  /** Serialises requests per host and keeps at least a second between them. */
  private async paced<T>(host: string, delayMs: number, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(host) ?? Promise.resolve();
    const run = previous.then(async () => {
      const wait = (this.lastRequest.get(host) ?? 0) + Math.max(minDelayMs, delayMs) - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await task();
      } finally {
        this.lastRequest.set(host, Date.now());
      }
    });
    this.queues.set(
      host,
      run.catch(() => undefined),
    );
    return run;
  }
  private async request(url: string): Promise<Response> {
    return fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Language': 'fr,en;q=0.7',
      },
      signal: AbortSignal.timeout(20000),
    });
  }
  private robotsFor(origin: string): Promise<Robots> {
    let cached = this.robots.get(origin);
    if (!cached) {
      const host = new URL(origin).host;
      cached = this.paced(host, 0, async (): Promise<Robots> => {
        try {
          const response = await this.request(`${origin}/robots.txt`);
          if (response.status === 404 || response.status === 410)
            return { rules: [], delayMs: 0, unreadable: false };
          if (!response.ok) return { rules: [], delayMs: 0, unreadable: true };
          return { ...parseRobots(await response.text()), unreadable: false };
        } catch {
          return { rules: [], delayMs: 0, unreadable: true };
        }
      });
      this.robots.set(origin, cached);
    }
    return cached;
  }
  private async cached(url: string, kind: 'html' | 'xml'): Promise<SourceResponse | undefined> {
    if (this.options.refresh) return undefined;
    try {
      const meta = JSON.parse(
        await readFile(join(cacheDir, `${cacheKey(url, kind)}.json`), 'utf8'),
      ) as SourceResponse;
      const age = Date.now() - Date.parse(meta.fetchedAt);
      if (!(age < (this.options.cacheHours ?? 24) * 3600_000) || !settled.includes(meta.status))
        return undefined;
      if (meta.status === 'ok')
        meta.html = await readFile(join(cacheDir, `${cacheKey(url, kind)}.html`), 'utf8');
      return meta;
    } catch {
      return undefined;
    }
  }
  private async store(result: SourceResponse, kind: 'html' | 'xml') {
    await mkdir(cacheDir, { recursive: true });
    const { html, ...meta } = result;
    const key = cacheKey(result.url, kind);
    if (html !== undefined) await writeFile(join(cacheDir, `${key}.html`), html);
    await writeFile(join(cacheDir, `${key}.json`), JSON.stringify(meta, null, 1));
  }
  /** kind "xml" is for sitemaps, which are not HTML pages. */
  async get(url: string, kind: 'html' | 'xml' = 'html'): Promise<SourceResponse> {
    const hit = await this.cached(url, kind);
    if (hit) return hit;
    const result = await this.fetchFresh(url, kind);
    await this.store(result, kind);
    return result;
  }
  private async fetchFresh(startUrl: string, kind: 'html' | 'xml'): Promise<SourceResponse> {
    const base = { url: startUrl, hops: [] as string[], fetchedAt: new Date().toISOString() };
    let current = startUrl;
    for (let hop = 0; hop < 6; hop++) {
      let parsed: URL;
      try {
        parsed = new URL(current);
      } catch {
        return { ...base, status: 'network', detail: 'The address is not a valid URL.' };
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
        return { ...base, status: 'network', detail: 'Unsupported address scheme.' };
      const robots = await this.robotsFor(parsed.origin);
      if (robots.unreadable)
        return {
          ...base,
          finalUrl: current,
          status: 'robots_denied',
          detail: 'robots.txt could not be read, so the page was not requested.',
        };
      if (!robotsAllows(robots.rules, parsed.pathname + parsed.search))
        return {
          ...base,
          finalUrl: current,
          status: 'robots_denied',
          detail: 'robots.txt does not allow automated access to this page.',
        };
      let response: Response;
      try {
        response = await this.paced(parsed.host, robots.delayMs, () => this.request(current));
      } catch (error) {
        // One retry for transient network trouble; a dead domain stays dead.
        const first = classify(error);
        if (first.status === 'dns' || first.status === 'tls')
          return { ...base, finalUrl: current, ...first };
        await sleep(2000);
        try {
          response = await this.paced(parsed.host, robots.delayMs, () => this.request(current));
        } catch (second) {
          return { ...base, finalUrl: current, ...classify(second) };
        }
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location)
          return {
            ...base,
            finalUrl: current,
            httpStatus: response.status,
            status: 'network',
            detail: 'Redirect without a destination.',
          };
        base.hops.push(current);
        current = new URL(location, current).toString();
        continue;
      }
      const contentType = response.headers.get('content-type') ?? '';
      const common = { ...base, finalUrl: current, httpStatus: response.status, contentType };
      if (response.status === 404 || response.status === 410)
        return { ...common, status: 'not_found' };
      if ([401, 403, 406, 429, 451, 999].includes(response.status))
        return { ...common, status: 'blocked' };
      if (response.status >= 500) return { ...common, status: 'server_error' };
      if (!response.ok)
        return { ...common, status: 'network', detail: `Unexpected HTTP ${response.status}.` };
      const expected = kind === 'xml' ? /xml|text\/plain/i : /text\/html|application\/xhtml/i;
      if (!expected.test(contentType)) return { ...common, status: 'non_html' };
      const declared = Number(response.headers.get('content-length') ?? 0);
      if (declared > maxBytes) return { ...common, status: 'too_large' };
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length > maxBytes) return { ...common, status: 'too_large' };
      return { ...common, status: 'ok', html: body.toString('utf8') };
    }
    return { ...base, finalUrl: current, status: 'redirect_loop', detail: 'Too many redirects.' };
  }
}
