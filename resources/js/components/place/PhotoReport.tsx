import { useState, type FormEvent } from 'react';
import { Flag } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { api, errorMessage } from '../../lib/api';

const reasons = ['not_this_place', 'copyright', 'privacy', 'offensive', 'other'] as const;
const reasonLabels: Record<(typeof reasons)[number], string> = {
  not_this_place: 'It does not show this place',
  copyright: 'It is my photo or I hold its rights',
  privacy: 'It shows me or someone who did not agree',
  offensive: 'It is offensive or inappropriate',
  other: 'Something else',
};

/** Notice-and-action for the photo shown on a place page: anyone can report it, no account needed. */
export function PhotoReport({ placeId, image }: { placeId: number; image: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reasons)[number]>('not_this_place');
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setState('sending');
    setError('');
    try {
      await api('/photo-reports', {
        method: 'POST',
        body: JSON.stringify({
          placeId,
          image,
          reason,
          details: details.trim() || null,
          contact: contact.trim() || null,
        }),
      });
      setState('sent');
    } catch (e) {
      setError(errorMessage(e));
      setState('idle');
    }
  }
  if (state === 'sent')
    return (
      <p role="status" className="text-sm text-green-800">
        {t('Thank you. We will review this photo.')}
      </p>
    );
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600 underline"
        onClick={() => setOpen((value) => !value)}
      >
        <Flag size={16} aria-hidden="true" />
        {t('Report this photo')}
      </button>
      {open && (
        <form onSubmit={submit} className="mt-2 space-y-3 rounded-2xl bg-slate-50 p-4">
          <label className="field-label">
            {t('What is wrong with this photo?')}
            <select
              className="field-input"
              value={reason}
              onChange={(e) => setReason(e.target.value as (typeof reasons)[number])}
            >
              {reasons.map((value) => (
                <option key={value} value={value}>
                  {t(reasonLabels[value])}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            {t('Details (optional)')}
            <textarea
              className="field-input"
              maxLength={1000}
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </label>
          <label className="field-label">
            {t('Email or phone, if you want a reply (optional)')}
            <input
              className="field-input"
              maxLength={200}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="error-message">
              {t(error)}
            </p>
          )}
          <button disabled={state === 'sending'} className="secondary-button">
            {t('Send report')}
          </button>
        </form>
      )}
    </div>
  );
}
