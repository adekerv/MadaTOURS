import { useState } from 'react';
import type { User } from '../../types';
import type { SocialData, SocialAction } from './types';
import { useI18n } from '../../i18n/I18nProvider';
export function Connections({
  data,
  user,
  act,
  busy,
  onSearch,
}: {
  data: SocialData;
  user: User;
  act: SocialAction;
  busy: boolean;
  onSearch: (q: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        {t(
          'Only people you accept can see your check-ins, favorites and plans you choose to share. Your device location is never shared.',
        )}
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(query);
        }}
      >
        <label className="field-label flex-1">
          {t('Find an explorer by display name')}
          <input
            className="field-input"
            minLength={2}
            maxLength={80}
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="primary-button">{t('Search')}</button>
      </form>
      {data.people.map((person) => (
        <div
          key={person.user_id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
        >
          <span>{person.display_name}</span>
          <button
            className="secondary-button"
            disabled={
              busy ||
              data.connections.some(
                (c) => c.follower_id === user.id && c.following_id === person.user_id,
              )
            }
            onClick={() => void act('follow', { userId: person.user_id })}
          >
            {t('Request to follow')}
          </button>
        </div>
      ))}
      <h3 className="text-lg font-bold">{t('Your connections')}</h3>
      {!data.connections.length && (
        <p className="text-sm text-slate-600">
          {t('No connections yet. Find someone you know and send a follow request.')}
        </p>
      )}
      {data.connections.map((c) => {
        const incoming = c.following_id === user.id;
        const target = incoming ? c.follower_id : c.following_id;
        return (
          <article
            key={`${c.follower_id}:${c.following_id}`}
            className="rounded-xl bg-slate-50 p-4"
          >
            <p className="font-semibold">{c.display_name}</p>
            <p className="my-2 text-sm text-slate-600">
              {t(incoming ? 'Wants to follow you' : 'You requested to follow')} · {t(c.status)}
            </p>
            <div className="flex flex-wrap gap-2">
              {incoming && c.status === 'pending' && (
                <>
                  <button
                    disabled={busy}
                    className="primary-button"
                    onClick={() => void act('accept-follow', { userId: target })}
                  >
                    {t('Accept')}
                  </button>
                  <button
                    disabled={busy}
                    className="secondary-button"
                    onClick={() => void act('decline-follow', { userId: target })}
                  >
                    {t('Decline')}
                  </button>
                </>
              )}
              <button
                disabled={busy}
                className="secondary-button"
                onClick={() =>
                  void act(incoming ? 'remove-follower' : 'unfollow', { userId: target })
                }
              >
                {t(incoming ? 'Remove follower' : 'Unfollow')}
              </button>
              <button
                disabled={busy}
                className="secondary-button text-red-700"
                onClick={() => void act('block', { userId: target })}
              >
                {t('Block user')}
              </button>
            </div>
          </article>
        );
      })}
      <h3 className="text-lg font-bold">{t('From people you follow')}</h3>
      {!data.activity.length && (
        <p className="text-sm text-slate-600">
          {t('Activity appears here after someone accepts your follow request.')}
        </p>
      )}
      {data.activity.map((item) => (
        <article key={item.id} className="rounded-xl border border-slate-200 p-3">
          <p className="font-semibold">{item.display_name}</p>
          <p className="text-sm">
            {t(
              item.kind === 'checkin'
                ? 'Checked in at'
                : item.kind === 'favorite'
                  ? 'Saved as a favorite'
                  : 'Plans to visit',
            )}{' '}
            <a
              className="text-orange-800 underline"
              href={`#explore?filter=all&place=${item.place_id}`}
            >
              {item.place_name}
            </a>
          </p>
        </article>
      ))}
      <details>
        <summary className="cursor-pointer font-semibold">{t('Blocked users')}</summary>
        {data.blocked.map((person) => (
          <div
            className="flex flex-wrap items-center justify-between gap-2 py-2"
            key={person.blocked_id}
          >
            <span>{person.display_name}</span>
            <button
              disabled={busy}
              className="secondary-button"
              onClick={() => void act('unblock', { userId: person.blocked_id })}
            >
              {t('Unblock')}
            </button>
          </div>
        ))}
      </details>
    </div>
  );
}
