import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { User } from '../../types';
import type { Meetup, SocialAction } from './types';
export function Events({
  events,
  user,
  act,
  busy,
}: {
  events: Meetup[];
  user: User;
  act: SocialAction;
  busy: boolean;
}) {
  const { t, language } = useI18n();
  const [reporting, setReporting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const date = (value: string) =>
    new Date(value).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Martinique',
    });
  return (
    <div className="space-y-4">
      {!events.length && (
        <p className="rounded-2xl bg-slate-50 p-5 text-slate-600">
          {t('No live meet-ups yet. Create a plan and invite other explorers.')}
        </p>
      )}
      {events.map((event) => {
        const host = event.creator_id === user.id;
        const application = event.applications.find((a) => a.user_id === user.id);
        const live = event.status === 'live' && Date.parse(event.expires_at) > Date.now();
        return (
          <article key={event.id} className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                {t(live ? 'Live meet-up' : event.status === 'cancelled' ? 'Cancelled' : 'Expired')}
              </p>
              <h3 className="text-xl font-bold">{event.title}</h3>
              <p className="text-sm text-slate-600">
                {t('Hosted by {name}', { name: event.display_name })}
              </p>
            </div>
            <p className="text-sm font-semibold">
              {event.location} · {date(event.starts_at)} · {t('Martinique time')}
            </p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{event.description}</p>
            <p className="text-sm">
              {Number(event.price).toFixed(2)} € / {t('person')} ·{' '}
              {t('{count} of {capacity} attending', {
                count: 1 + event.applications.filter((a) => a.status === 'accepted').length,
                capacity: event.capacity,
              })}
            </p>
            <p className="text-xs text-slate-500">
              {t('Listing expires: {date}', { date: date(event.expires_at) })}
            </p>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                {t('Attendees and applications')}
              </summary>
              <p className="text-sm">
                {event.display_name} · {t('Host')}
              </p>
              {event.applications.map((a) => (
                <div
                  key={a.user_id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 py-2 text-sm"
                >
                  <span>
                    {a.display_name} · {t(a.status)}
                  </span>
                  {host && live && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={busy || a.status === 'accepted'}
                        className="secondary-button"
                        onClick={() =>
                          void act('approve', { eventId: event.id, userId: a.user_id })
                        }
                      >
                        {t('Approve')}
                      </button>
                      <button
                        disabled={busy || a.status === 'declined'}
                        className="secondary-button"
                        onClick={() =>
                          void act('decline', { eventId: event.id, userId: a.user_id })
                        }
                      >
                        {t('Decline')}
                      </button>
                      <button
                        disabled={busy}
                        className="secondary-button"
                        onClick={() => void act('block', { userId: a.user_id })}
                      >
                        {t('Block user')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </details>
            {live && (
              <div className="flex flex-wrap gap-2">
                {host || user.role === 'admin' ? (
                  <button
                    disabled={busy}
                    className="secondary-button text-red-700"
                    onClick={() => void act('cancel-event', { eventId: event.id })}
                  >
                    {t('Cancel meet-up')}
                  </button>
                ) : (
                  <>
                    <button
                      disabled={
                        busy ||
                        !user.emailVerified ||
                        !!application ||
                        Date.parse(event.starts_at) <= Date.now()
                      }
                      className="primary-button"
                      onClick={() => void act('apply', { eventId: event.id })}
                    >
                      {t(application ? 'Application submitted' : 'Apply to join')}
                    </button>
                    {application && (
                      <button
                        disabled={busy}
                        className="secondary-button"
                        onClick={() => void act('leave-event', { eventId: event.id })}
                      >
                        {t('Withdraw application')}
                      </button>
                    )}
                    <button
                      disabled={busy}
                      className="secondary-button"
                      onClick={() => {
                        setReason('');
                        setReporting(event.id);
                      }}
                    >
                      {t('Report meet-up')}
                    </button>
                    <button
                      disabled={busy}
                      className="secondary-button"
                      onClick={() => void act('block', { userId: event.creator_id })}
                    >
                      {t('Block host')}
                    </button>
                  </>
                )}
              </div>
            )}
            {reporting === event.id && (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act('report', { eventId: event.id, reason }).then((ok) => {
                    if (ok) setReporting(null);
                  });
                }}
              >
                <label className="field-label">
                  {t('Report reason')}
                  <textarea
                    className="field-input"
                    required
                    minLength={10}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button disabled={busy} className="primary-button">
                  {t('Send report')}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setReporting(null)}
                >
                  {t('Cancel')}
                </button>
              </form>
            )}
          </article>
        );
      })}
    </div>
  );
}
