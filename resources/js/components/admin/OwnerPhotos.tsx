import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { api, errorMessage } from '../../lib/api';
import { preparePhoto } from '../../lib/upload-photo';
import type { Place } from '../../types';

type Permission = {
  id: string;
  place_id: number;
  basis: 'permission' | 'attestation';
  grantor_name: string;
  business: string | null;
  licence_version: string;
  channel: string;
  granted_on: string;
  expires_on: string | null;
  revoked_at: string | null;
};
type Report = {
  id: number;
  place_id: number;
  image: string;
  reason: string;
  details: string | null;
  contact: string | null;
  created_at: string;
};
const reasonLabels: Record<string, string> = {
  not_this_place: 'It does not show this place',
  copyright: 'It is my photo or I hold its rights',
  privacy: 'It shows me or someone who did not agree',
  offensive: 'It is offensive or inappropriate',
  other: 'Something else',
};
const channels = ['email', 'letter', 'form', 'in_person', 'message'] as const;
const channelLabels: Record<(typeof channels)[number], string> = {
  email: 'By email',
  letter: 'Signed letter',
  form: 'Online form',
  in_person: 'In person',
  message: 'Text or social message',
};
/** Reads an evidence file (JPEG, PNG or PDF) as base64 without changing it. */
function readEvidence(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || file.size > 4194304)
      return reject(new Error('Attach the permission as a JPEG, PNG or PDF under 4 MB.'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () =>
      reject(new Error('Attach the permission as a JPEG, PNG or PDF under 4 MB.'));
    reader.readAsDataURL(file);
  });
}
const today = () => new Date().toLocaleDateString('sv-SE');
const empty = {
  placeId: '',
  grantorName: '',
  grantorRole: '',
  business: '',
  licenceVersion: 'MadaTours photo licence v1',
  channel: 'email' as (typeof channels)[number],
  grantedOn: today(),
  expiresOn: '',
  credit: '',
  sourceUrl: '',
  confirmed: false,
};

/** Owner photos published with a recorded permission, and photo reports from visitors. */
export function OwnerPhotos({ places, onChanged }: { places: Place[]; onChanged: () => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<{ permissions: Permission[]; reports: Report[] }>();
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [evidence, setEvidence] = useState<File | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<{ permissions: Permission[]; reports: Report[] }>('/moderation/place-photos', {
      signal: controller.signal,
    })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [revision]);
  const name = (id: number) => places.find((place) => place.id === id)?.name || `#${id}`;
  const update = <K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function run(task: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      setNotice(done);
      setRevision((value) => value + 1);
      onChanged();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!photo) return;
    const saved = await run(async () => {
      const body = {
        ...form,
        placeId: Number(form.placeId),
        expiresOn: form.expiresOn || null,
        grantorRole: form.grantorRole || null,
        business: form.business || null,
        photo: await preparePhoto(photo),
        evidence: evidence ? await readEvidence(evidence) : null,
      };
      await api('/moderation/place-photos', { method: 'POST', body: JSON.stringify(body) });
    }, 'Photo published with its permission recorded.');
    if (saved) {
      setForm(empty);
      setPhoto(null);
      setEvidence(null);
    }
  }
  return (
    <section className="space-y-5 pt-4">
      <p className="text-sm text-slate-600">
        {t(
          "Publish a venue's own photo only with written permission. The photo is re-encoded and hosted by MadaTours, and the permission, its evidence and the file's fingerprint are kept privately.",
        )}
      </p>
      {error && (
        <p role="alert" className="error-message">
          {t(error)}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
          {t(notice)}
        </p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <label className="field-label">
          {t('Choose a place')}
          <select
            required
            className="field-input"
            value={form.placeId}
            onChange={(e) => update('placeId', e.target.value)}
          >
            <option value="">{t('Choose a place')}</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          {t('Photo')}
          <input
            required
            className="field-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            {t('Who granted permission')}
            <input
              required
              maxLength={200}
              className="field-input"
              value={form.grantorName}
              onChange={(e) => update('grantorName', e.target.value)}
            />
          </label>
          <label className="field-label">
            {t('Their role')}
            <input
              maxLength={120}
              className="field-input"
              value={form.grantorRole}
              onChange={(e) => update('grantorRole', e.target.value)}
            />
          </label>
          <label className="field-label">
            {t('Business')}
            <input
              maxLength={200}
              className="field-input"
              value={form.business}
              onChange={(e) => update('business', e.target.value)}
            />
          </label>
          <label className="field-label">
            {t('Licence text version')}
            <input
              required
              maxLength={100}
              className="field-input"
              value={form.licenceVersion}
              onChange={(e) => update('licenceVersion', e.target.value)}
            />
          </label>
          <label className="field-label">
            {t('How permission was given')}
            <select
              className="field-input"
              value={form.channel}
              onChange={(e) => update('channel', e.target.value as (typeof channels)[number])}
            >
              {channels.map((channel) => (
                <option key={channel} value={channel}>
                  {t(channelLabels[channel])}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            {t('Permission date')}
            <input
              required
              type="date"
              max={today()}
              className="field-input"
              value={form.grantedOn}
              onChange={(e) => update('grantedOn', e.target.value)}
            />
          </label>
          <label className="field-label">
            {t('Permission ends (optional)')}
            <input
              type="date"
              min={form.grantedOn}
              className="field-input"
              value={form.expiresOn}
              onChange={(e) => update('expiresOn', e.target.value)}
            />
          </label>
          <label className="field-label">
            {t('Credit shown on the place page')}
            <input
              required
              maxLength={200}
              className="field-input"
              value={form.credit}
              onChange={(e) => update('credit', e.target.value)}
            />
          </label>
        </div>
        <label className="field-label">
          {t("Owner's website or page")}
          <input
            required
            type="url"
            className="field-input"
            value={form.sourceUrl}
            onChange={(e) => update('sourceUrl', e.target.value)}
          />
        </label>
        <label className="field-label">
          {t('Copy of the permission (email, letter or screenshot)')}
          <input
            className="field-input"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setEvidence(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5"
            required
            checked={form.confirmed}
            onChange={(e) => update('confirmed', e.target.checked)}
          />
          {t('I hold written permission from this person to publish this photo on MadaTours.')}
        </label>
        <button disabled={busy || !photo} className="primary-button">
          {t('Publish owner photo')}
        </button>
      </form>
      <h3 className="font-bold">{t('Photo reports')}</h3>
      {data && !data.reports.length && (
        <p className="text-sm text-slate-600">{t('No open photo reports.')}</p>
      )}
      {data?.reports.map((report) => (
        <article key={report.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
          <p className="font-semibold">{name(report.place_id)}</p>
          <p className="text-sm">{t(reasonLabels[report.reason] ?? report.reason)}</p>
          {report.details && <p className="text-sm text-slate-600">{report.details}</p>}
          {report.contact && (
            <p className="text-sm text-slate-600">
              {t('Contact')}: {report.contact}
            </p>
          )}
          <a
            className="inline-flex min-h-11 items-center break-all text-sm underline"
            href={report.image}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('Open reported photo')}
          </a>
          <div className="flex flex-wrap gap-2">
            {(['resolved', 'dismissed'] as const).map((status) => (
              <button
                key={status}
                disabled={busy}
                className="secondary-button"
                onClick={() =>
                  void run(
                    () =>
                      api(`/moderation/photo-reports/${report.id}`, {
                        method: 'POST',
                        body: JSON.stringify({ status }),
                      }),
                    status === 'resolved' ? 'Report marked as handled.' : 'Report dismissed.',
                  )
                }
              >
                {t(status === 'resolved' ? 'Mark as handled' : 'Dismiss report')}
              </button>
            ))}
          </div>
        </article>
      ))}
      <h3 className="font-bold">{t('Photo permissions')}</h3>
      {data?.permissions.map((permission) => (
        <article
          key={permission.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
        >
          <div>
            <p className="font-semibold">{name(permission.place_id)}</p>
            <p className="text-sm text-slate-600">
              {permission.grantor_name}
              {permission.business ? ` · ${permission.business}` : ''} · {permission.granted_on}
              {permission.expires_on ? ` → ${permission.expires_on}` : ''}
              {permission.revoked_at ? ` · ${t('Withdrawn')}` : ''}
            </p>
          </div>
          {!permission.revoked_at && (
            <button
              disabled={busy}
              className="secondary-button"
              onClick={() =>
                void run(
                  () =>
                    api('/moderation/place-photos/revoke', {
                      method: 'POST',
                      body: JSON.stringify({ id: permission.id }),
                    }),
                  'Permission withdrawn and photo taken down.',
                )
              }
            >
              {t('Withdraw permission')}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
