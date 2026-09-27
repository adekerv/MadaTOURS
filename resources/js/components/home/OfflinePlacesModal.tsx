import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { clearOfflinePlaces, readOfflinePlaces } from '../../lib/offline';
export function OfflinePlacesModal({ onClose }: { onClose: () => void }) {
  const { t, language } = useI18n();
  const [copy, setCopy] = useState(readOfflinePlaces);
  const places = [
    ...new Map(
      [...(copy?.favorites ?? []), ...(copy?.revisits ?? [])].map((p) => [p.id, p]),
    ).values(),
  ];
  return (
    <Modal title={t('Offline copy')} onClose={onClose} wide>
      <div className="space-y-5 p-5 sm:p-7">
        <p className="text-sm text-slate-600">
          {t(
            'Offline copies are stored on this device. Photos, maps, directions, and account changes need a connection.',
          )}
        </p>
        {copy && (
          <p className="text-xs text-slate-500">
            {t('Last saved: {date}', {
              date: new Date(copy.savedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB'),
            })}
          </p>
        )}
        {!places.length && (
          <p>{t('No offline places yet. Sign in and save a place while connected.')}</p>
        )}
        <ul className="space-y-3">
          {places.map((place) => (
            <li className="rounded-2xl border border-slate-200 p-4" key={place.id}>
              <h3 className="font-bold">{place.name}</h3>
              <p className="my-2 text-sm text-orange-700">{place.location}</p>
              <p className="text-sm leading-relaxed text-slate-700">
                {language === 'fr' && place.descriptionFr ? place.descriptionFr : place.description}
              </p>
              {place.hours && (
                <p className="mt-3 text-sm text-slate-500">
                  {t('Listed hours')}: {place.hours}
                </p>
              )}
            </li>
          ))}
        </ul>
        {copy && (
          <button
            className="secondary-button text-red-700"
            onClick={() => {
              clearOfflinePlaces();
              setCopy(null);
            }}
          >
            {t('Remove offline copy')}
          </button>
        )}
      </div>
    </Modal>
  );
}
