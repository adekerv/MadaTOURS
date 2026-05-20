import React from 'react';
import { ArrowLeft, LocateFixed } from 'lucide-react';
import { UserLocation } from '../../types';

interface HeaderProps {
  onBack: () => void;
  userLocation: UserLocation | null;
  onGetLocation: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onBack, userLocation, onGetLocation }) => {
  return (
    <header className="bg-white border-b-2 border-orange-100 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between z-20">
      <div className="flex items-center gap-2 md:gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={20} className="md:w-6 md:h-6" />
        </button>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-xl md:text-2xl shadow-lg shadow-orange-200">
            M
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-slate-800 tracking-tight">MADATOURS</h1>
            <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-widest hidden md:block">Discover Martinique</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:flex bg-white border-2 border-orange-400 rounded-full px-4 py-2 items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${userLocation ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
          <span className="text-xs font-bold text-slate-700 italic">
            {userLocation ? (userLocation.manual ? "Custom Location" : "Current Location") : "Location Pending"}
          </span>
        </div>
        <button 
          onClick={onGetLocation}
          className="bg-slate-800 text-white p-2 md:p-2.5 rounded-full shadow-md hover:bg-slate-700 transition-all"
          title="Get Geolocation"
        >
          <LocateFixed size={18} />
        </button>
      </div>
    </header>
  );
};
