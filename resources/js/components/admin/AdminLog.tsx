import { useState } from 'react';
import { History } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import {
  Badge,
  Choice,
  EmptyState,
  ListSkeleton,
  ListToolbar,
  LoadError,
  Pagination,
  SectionHeader,
  useAdminList,
  useDateFormat,
  useDebounced,
  useResetPage,
} from './AdminKit';

type Entry = {
  id: number;
  actor_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string;
  created_at: string;
};
const areas: [string, string][] = [
  ['users', 'Users'],
  ['tours', 'Tours'],
  ['places', 'Places'],
  ['meetups', 'Meet-ups'],
  ['reviews', 'Reviews'],
  ['community', 'Comments'],
  ['messages', 'Messages'],
  ['submissions', 'Submissions'],
  ['photos', 'Photos'],
  ['settings', 'Site content'],
];

/** Who changed what, and when. Entries are written by the server and cannot be edited or removed. */
export function AdminLog() {
  const { t } = useI18n();
  const date = useDateFormat();
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounced(search);
  useResetPage(setPage, query, area);
  const list = useAdminList<Entry>('/admin/log', { search: query, area, page, perPage: 50 });
  const areaLabel = Object.fromEntries(areas);
  return (
    <>
      <SectionHeader
        title={t('Activity log')}
        description={t(
          'Important admin actions, newest first. Entries cannot be changed or deleted.',
        )}
      />
      <ListToolbar search={search} onSearch={setSearch} placeholder={t('Search the log')}>
        <Choice
          label={t('Area')}
          value={area}
          onChange={setArea}
          options={[
            ['', t('All areas')],
            ...areas.map(([value, text]) => [value, t(text)] as [string, string]),
          ]}
        />
      </ListToolbar>
      {list.error && <LoadError error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <ListSkeleton />}
      {list.data && !list.data.rows.length && (
        <EmptyState icon={<History size={22} />} title={t('Nothing logged yet')}>
          {t('Changes made in this dashboard are recorded here.')}
        </EmptyState>
      )}
      {list.data && list.data.rows.length > 0 && (
        <div
          className={`relative overflow-x-auto rounded-2xl border border-slate-200 bg-white ${list.loading ? 'opacity-60' : ''}`}
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('When')}</th>
                <th>{t('What')}</th>
                <th className="hidden md:table-cell">{t('Who')}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap align-top">{date(entry.created_at)}</td>
                  <td>
                    <Badge tone="slate">
                      {t(areaLabel[entry.action.split('.')[0]] ?? entry.action)}
                    </Badge>{' '}
                    <span>{entry.summary}</span>
                    <span className="mt-1 block text-xs text-slate-500 md:hidden">
                      {entry.actor_email}
                    </span>
                  </td>
                  <td className="hidden break-all md:table-cell">{entry.actor_email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && (
        <Pagination
          page={page}
          perPage={list.data.perPage}
          total={list.data.total}
          onPage={setPage}
        />
      )}
    </>
  );
}
