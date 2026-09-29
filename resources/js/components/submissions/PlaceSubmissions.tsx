import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { api, errorMessage } from '../../lib/api';
import { preparePhoto } from '../../lib/upload-photo';
import { CoordinatePicker } from '../ui/CoordinatePicker';
import { Modal } from '../ui/Modal';
export type Submission = {
  id: number;
  name: string;
  type: string;
  description: string;
  language: 'en' | 'fr';
  address: string;
  lat: number;
  lng: number;
  source_url?: string;
  photoUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  place_id?: number;
};
export type SubmissionData = {
  submissions: Submission[];
  notifications: {
    id: number;
    kind: 'submission-approved' | 'submission-rejected';
    data: { name: string; reason?: string; placeId?: number };
  }[];
};
export function PlaceSubmissions({ onClose }: { onClose: () => void }) {
  const { t, language } = useI18n();
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState<SubmissionData>();
  const [revision, setRevision] = useState(0);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<SubmissionData>(`/submissions?offset=${offset}`, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [revision, offset]);
  return (
    <Modal wide title={t('Suggest a place')} onClose={onClose}>
      <div className="space-y-5 p-5 sm:p-7">
        <p className="text-sm text-slate-600">
          {t(
            'Share a real place in Martinique. Your submission and photo stay private until an administrator approves them.',
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
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!point || !image) {
              setError('An exact map location and a photo are required.');
              return;
            }
            const form = e.currentTarget;
            const fields = new FormData(form);
            setBusy(true);
            setError('');
            void api('/submissions', {
              method: 'POST',
              body: JSON.stringify({
                name: fields.get('name'),
                type: fields.get('type'),
                address: fields.get('address'),
                description: fields.get('description'),
                sourceUrl: fields.get('sourceUrl') || null,
                language,
                ...point,
                imageBase64: image,
                photoRights: fields.get('photoRights') === 'on',
              }),
            })
              .then(() => {
                form.reset();
                setPoint(null);
                setImage('');
                setNotice('Submission sent. You will see the moderation decision here.');
                setRevision((v) => v + 1);
              })
              .catch((e) => setError(errorMessage(e)))
              .finally(() => setBusy(false));
          }}
        >
          <label className="field-label">
            {t('Place name')}
            <input name="name" className="field-input" required minLength={3} maxLength={160} />
          </label>
          <label className="field-label">
            {t('Type')}
            <select name="type" className="field-input" required defaultValue="">
              <option value="" disabled>
                {t('Choose a category')}
              </option>
              <option value="restaurant">{t('Restaurant')}</option>
              <option value="activity">{t('Activity')}</option>
              <option value="cultural">{t('Cultural place')}</option>
            </select>
          </label>
          <label className="field-label">
            {t('Address')}
            <input name="address" className="field-input" required minLength={5} maxLength={200} />
          </label>
          <CoordinatePicker point={point} onChange={setPoint} />
          <label className="field-label">
            {t('Describe the place (at least 40 characters)')}
            <textarea
              name="description"
              className="field-input"
              required
              minLength={40}
              maxLength={3000}
              rows={4}
            />
          </label>
          <label className="field-label">
            {t('Official source URL (optional)')}
            <input
              name="sourceUrl"
              className="field-input"
              type="url"
              pattern="https://.*"
              maxLength={1000}
              placeholder="https://"
            />
          </label>
          <label className="field-label">
            {t('Upload your photo')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              className="field-input"
              disabled={photoBusy || busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                setImage('');
                if (!file) return;
                setPhotoBusy(true);
                setError('');
                void preparePhoto(file)
                  .then(setImage)
                  .catch((error) =>
                    setError(
                      error instanceof Error
                        ? error.message
                        : 'Photo upload failed. Please try again.',
                    ),
                  )
                  .finally(() => setPhotoBusy(false));
              }}
            />
          </label>
          {image && (
            <img
              src={`data:image/jpeg;base64,${image}`}
              alt={t('Your submission photo preview')}
              className="h-44 w-full rounded-xl object-cover"
            />
          )}
          <label className="flex min-h-11 items-start gap-3 text-sm text-slate-700">
            <input
              name="photoRights"
              type="checkbox"
              required
              className="mt-1 size-5 shrink-0 accent-orange-700"
            />
            {t(
              'I took this photo or have permission to publish it, and agree to the contribution terms.',
            )}
          </label>
          <a
            href="#terms"
            className="inline-flex min-h-11 items-center text-sm text-orange-800 underline"
            onClick={onClose}
          >
            {t('Contribution terms')}
          </a>
          <button disabled={busy || photoBusy} className="primary-button w-full">
            {t(busy ? 'Sending…' : 'Submit for review')}
          </button>
        </form>
        <section className="space-y-3 border-t border-slate-200 pt-5">
          <h3 className="text-lg font-bold">{t('Your submissions and updates')}</h3>
          {data?.notifications.map((n) => (
            <p key={n.id} className="rounded-xl bg-orange-50 p-3 text-sm">
              {t(
                n.kind === 'submission-approved'
                  ? 'Your place “{name}” was approved.'
                  : 'Your place “{name}” needs changes.',
                { name: n.data.name },
              )}
              {n.data.reason && <span className="mt-1 block">{n.data.reason}</span>}
            </p>
          ))}
          {data?.submissions.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-3">
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm">
                {t(
                  (
                    {
                      pending: 'Under review',
                      approved: 'Approved',
                      rejected: 'Rejected',
                    } as Record<string, string>
                  )[item.status] || 'Under review',
                )}
              </p>
              {item.rejection_reason && (
                <p className="text-sm text-slate-600">{item.rejection_reason}</p>
              )}
              {item.place_id && (
                <a
                  onClick={onClose}
                  href={`#explore?filter=all&place=${item.place_id}`}
                  className="inline-flex min-h-11 items-center text-orange-800 underline"
                >
                  {t('View published place')}
                </a>
              )}
            </article>
          ))}
        </section>
        <div className="flex gap-2">
          {offset > 0 && (
            <button
              className="secondary-button"
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              {t('Previous')}
            </button>
          )}
          {data && (data.submissions.length === 20 || data.notifications.length === 20) && (
            <button className="secondary-button" onClick={() => setOffset(offset + 20)}>
              {t('Next')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
