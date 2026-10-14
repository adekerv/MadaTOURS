import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';

export type Page<T> = { total: number; rows: T[]; page: number; perPage: number };

/**
 * Loads one page of an admin list from the API. Any change to the query starts a new request and cancels the one in
 * flight, so a slow answer can never overwrite a newer one.
 */
export function useAdminList<T>(path: string, query: Record<string, string | number | undefined>) {
  const [data, setData] = useState<(Page<T> & Record<string, unknown>) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const search = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      value === undefined || value === '' ? [] : [[key, String(value)]],
    ),
  ).toString();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<Page<T> & Record<string, unknown>>(`${path}${search ? `?${search}` : ''}`, {
      signal: controller.signal,
    })
      .then((result) => !controller.signal.aborted && setData(result))
      .catch((failure) => !controller.signal.aborted && setError(errorMessage(failure)))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [path, search, revision]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { data, loading, error, reload, setData };
}

/** Search text that waits for a pause in typing before it asks the server. */
export function useDebounced(value: string, delay = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** The row above a list: search first, then filters and sorting, wrapping on narrow screens. */
export function ListToolbar({
  search,
  onSearch,
  placeholder,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="field-label min-w-[12rem] flex-1">
        <span className="sr-only">{t('Search')}</span>
        <span className="relative block">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            maxLength={100}
            className="field-input pl-10"
          />
        </span>
      </label>
      {children}
    </div>
  );
}

/** A labelled select for filters and sorting. Options are [value, label] pairs with labels already translated. */
export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="field-label w-full min-[480px]:w-auto">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input min-[480px]:w-auto"
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Pagination({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage && page === 1) return null;
  const first = (page - 1) * perPage + 1;
  return (
    <nav
      aria-label={t('Pages')}
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"
    >
      <span>
        {t('{first}–{last} of {total}', {
          first: Math.min(first, total),
          last: Math.min(page * perPage, total),
          total,
        })}
      </span>
      <span className="flex items-center gap-1">
        <button
          className="icon-button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t('Previous page')}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="px-2">{t('Page {page} of {pages}', { page, pages })}</span>
        <button
          className="icon-button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label={t('Next page')}
        >
          <ChevronRight size={18} />
        </button>
      </span>
    </nav>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 px-5 py-10 text-center">
      <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-orange-50 text-orange-700">
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-slate-600">{children}</div>}
    </div>
  );
}

/** Grey rows in the shape of the list, so the page does not jump when the data arrives. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t('Loading…')} className="space-y-2">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="skeleton h-14 rounded-2xl" />
      ))}
    </div>
  );
}

export function LoadError({ error, onRetry }: { error: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="error-message flex flex-wrap items-center justify-between gap-3">
      <span>{t(error)}</span>
      <button onClick={onRetry} className="secondary-button flex items-center gap-2">
        <RefreshCw size={16} aria-hidden />
        {t('Try again')}
      </button>
    </div>
  );
}

const badgeTones = {
  green: 'bg-green-50 text-green-800',
  orange: 'bg-orange-50 text-orange-800',
  red: 'bg-red-50 text-red-800',
  blue: 'bg-blue-50 text-blue-800',
  slate: 'bg-slate-100 text-slate-700',
};
export function Badge({ tone, children }: { tone: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={`admin-badge ${badgeTones[tone]}`}>{children}</span>;
}

/** Dates in the island's time zone, in the language the dashboard is showing. */
export function useDateFormat() {
  const { language } = useI18n();
  return useCallback(
    (value: string | null | undefined, withTime = true) =>
      value
        ? new Date(value).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB', {
            dateStyle: 'medium',
            ...(withTime ? { timeStyle: 'short' } : {}),
            timeZone: 'America/Martinique',
          })
        : '—',
    [language],
  );
}

/** Keeps the list on page 1 whenever the search or a filter changes. */
export function useResetPage(setPage: (page: number) => void, ...keys: unknown[]) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, keys);
}
