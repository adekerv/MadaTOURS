import { ArrowLeft, LocateFixed } from 'lucide-react';
import type { UserLocation } from '../../types';
export function Header({
  onBack,
  userLocation,
  onGetLocation,
}: {
  onBack: () => void;
  userLocation: UserLocation | null;
  onGetLocation: () => void;
}) {
  return (
    <header className="explore-header flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="icon-button" aria-label="Back to home">
          <ArrowLeft size={21} />
        </button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Explore Martinique</h1>
          <p className="text-xs text-slate-500 hidden sm:block">Find your next favorite place</p>
        </div>
      </div>
      <button
        onClick={onGetLocation}
        className="secondary-button flex shrink-0 items-center gap-2"
        aria-label="Choose search location"
      >
        <LocateFixed size={18} />
        <span className="hidden sm:inline">
          {userLocation?.manual ? 'Search location' : 'Your location'}
        </span>
      </button>
    </header>
  );
}
