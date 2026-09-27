import { useI18n } from '../../i18n/I18nProvider';
import { LocateFixed, MapPin } from 'lucide-react';
import { Modal } from '../ui/Modal';
export function LocationPrompt({
  onClose,
  onGetGeolocation,
  onManualSelect,
  onBrowseIsland,
  isLoading,
  error,
}: {
  onClose: () => void;
  onGetGeolocation: () => void;
  onManualSelect: () => void;
  onBrowseIsland: () => void;
  isLoading: boolean;
  error: string;
}) {
  const { t } = useI18n();
  return (
    <Modal title={t('Choose your search location')} onClose={onClose}>
      <div className="space-y-4 p-5 sm:p-7">
        <p className="text-sm leading-relaxed text-slate-600">
          {t(
            'Use your location to find places nearby, or explore anywhere in Martinique. Your location is used on this device to calculate distances.',
          )}
        </p>
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        <button
          disabled={isLoading}
          onClick={onGetGeolocation}
          className="primary-button flex w-full justify-center items-center gap-2"
        >
          <LocateFixed size={18} />
          {isLoading ? t('Finding your location…') : t('Use my location')}
        </button>
        <button
          onClick={onManualSelect}
          className="secondary-button flex w-full justify-center items-center gap-2"
        >
          <MapPin size={18} />
          {t('Choose on the map')}
        </button>
        <button onClick={onBrowseIsland} className="secondary-button w-full">
          {t('Browse all Martinique')}
        </button>
      </div>
    </Modal>
  );
}
