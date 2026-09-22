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
  return (
    <Modal title="Choose your search location" onClose={onClose}>
      <div className="space-y-4 p-5 sm:p-7">
        <p className="text-sm leading-relaxed text-slate-600">
          Use your location to find places nearby, or explore anywhere in Martinique. Your location
          is used on this device to calculate distances.
        </p>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button
          disabled={isLoading}
          onClick={onGetGeolocation}
          className="primary-button flex w-full justify-center items-center gap-2"
        >
          <LocateFixed size={18} />
          {isLoading ? 'Finding your location…' : 'Use my location'}
        </button>
        <button
          onClick={onManualSelect}
          className="secondary-button flex w-full justify-center items-center gap-2"
        >
          <MapPin size={18} />
          Choose on the map
        </button>
        <button onClick={onBrowseIsland} className="secondary-button w-full">
          Browse all Martinique
        </button>
      </div>
    </Modal>
  );
}
