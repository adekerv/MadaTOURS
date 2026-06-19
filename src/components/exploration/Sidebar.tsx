import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Grid, Map as MapIcon, RotateCcw, Plus, Database, ShieldCheck } from 'lucide-react';
import { Place, UserLocation, User } from '../../types';
import { PlaceCard } from './PlaceCard';
import { AddPlacePanel } from './AddPlacePanel';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filter: 'all' | 'restaurant' | 'activity';
  setFilter: (filter: 'all' | 'restaurant' | 'activity') => void;
  radius: number;
  setRadius: (radius: number) => void;
  userLocation: UserLocation | null;
  loading: boolean;
  filteredPlaces: Place[];
  selectedPlace: Place | null;
  onPlaceSelect: (place: Place) => void;
  onShowDetails: (place: Place) => void;
  isFavorite: (id: number) => boolean;
  onResetRadar: () => void;
  sortBy: 'default' | 'rating' | 'hiking' | 'entertainment';
  setSortBy: (sortBy: 'default' | 'rating' | 'hiking' | 'entertainment') => void;
  onRefreshPlaces?: () => void;
  user: User | null;
  onAdminClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  filter,
  setFilter,
  radius,
  setRadius,
  userLocation,
  loading,
  filteredPlaces,
  selectedPlace,
  onPlaceSelect,
  onShowDetails,
  isFavorite,
  onResetRadar,
  sortBy,
  setSortBy,
  onRefreshPlaces,
  user,
  onAdminClick
}) => {
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.aside 
          initial={{ x: -400 }}
          animate={{ x: 0 }}
          exit={{ x: -400 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute md:relative inset-y-0 left-0 w-[85%] md:w-80 bg-white border-r-2 border-orange-50 flex flex-col shadow-2xl z-30 font-sans shrink-0 overflow-hidden"
        >
          <div className="p-5 md:p-6 space-y-5 md:space-y-6 flex flex-col h-full relative">
            <div className="flex items-center justify-between md:hidden">
              <h2 className="text-xl font-black text-slate-800 tracking-tight italic">Filters</h2>
              <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500">
                <X size={20} />
              </button>
            </div>

            <section className="flex items-center justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight mb-1 italic">Discoveries</h2>
                <p className="text-[11px] md:text-sm text-slate-500 font-medium tracking-tight">Exploring within {radius}km</p>
              </div>
              {user?.role === 'admin' && (
                <div className="flex gap-2">
                  <button 
                    onClick={onAdminClick}
                    title="Open Database Control Panel"
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-orange-400 border border-slate-800 hover:border-slate-700 shadow-md hover:shadow-lg transition-all flex items-center justify-center cursor-pointer"
                  >
                    <ShieldCheck size={15} />
                  </button>
                  <button 
                    onClick={() => setIsAddPanelOpen(true)}
                    title="Add Spot (Quick Form)"
                    className="p-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center cursor-pointer border-none"
                  >
                    <Database size={15} className="mr-1 shadow-sm" />
                    <Plus size={12} className="stroke-[3]" />
                  </button>
                </div>
              )}
            </section>

            {/* Filter Tabs */}
            <div className="bg-slate-50 p-1 rounded-2xl flex border border-slate-100">
              {(['all', 'restaurant', 'activity'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`flex-1 py-2.5 md:py-3 rounded-xl font-black flex items-center justify-center gap-1.5 md:gap-2 transition-all text-[10px] md:text-[11px] uppercase tracking-tighter ${
                    filter === t 
                      ? 'bg-white text-orange-600 shadow-sm border border-orange-100' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t === 'restaurant' ? '🍴' : t === 'activity' ? '🏄' : <Grid size={12} />} 
                  {t}
                </button>
              ))}
            </div>

            {/* Radius Slider */}
            <div className="px-1">
              <div className="flex justify-between text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                <span>Range</span>
                <span className="text-orange-500">{radius}km</span>
              </div>
              <input 
                type="range" 
                min="1" max="50" 
                value={radius} 
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Special Sort Badge Section */}
            {sortBy !== 'default' && (
              <div className="bg-orange-50/80 border border-orange-100/70 p-3 rounded-2xl flex flex-col gap-1.5 text-xs">
                <span className="font-extrabold text-orange-600 uppercase tracking-tight text-[10px] block">Special Mode Active</span>
                <div className="flex items-center justify-between text-slate-700">
                  <span className="font-bold flex items-center gap-1.5">
                    {sortBy === 'rating' 
                      ? '⭐ Best Rated Island Restaurants' 
                      : sortBy === 'hiking' 
                        ? '🥾 Island Hiking Trails'
                        : '🎬 Island Entertainment & Fun'}
                  </span>
                  <button 
                    onClick={() => setSortBy('default')}
                    type="button"
                    className="font-black text-[9px] uppercase tracking-wider text-orange-600 hover:text-orange-700 underline underline-offset-2 shrink-0 ml-1"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* List of Places */}
            <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 pr-1 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {!userLocation ? (
                  <div className="py-12 md:py-20 text-center opacity-40 grayscale space-y-4">
                    <MapIcon size={40} className="mx-auto text-slate-300" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Select Start Point</p>
                  </div>
                ) : loading ? (
                  <div className="py-12 md:py-20 text-center space-y-4">
                    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 italic">Scanning...</p>
                  </div>
                ) : filteredPlaces.length === 0 ? (
                  <div className="py-12 md:py-20 text-center space-y-4 px-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <Grid size={24} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-slate-400 font-medium text-sm">No markers in this sector.</p>
                      <p className="text-[10px] text-slate-300 uppercase tracking-widest leading-relaxed">Try increasing the search range or moving your location on the map.</p>
                    </div>
                  </div>
                ) : (
                  filteredPlaces.map((place, index) => (
                    <PlaceCard 
                      key={place.id}
                      place={place}
                      index={index}
                      isSelected={selectedPlace?.id === place.id}
                      isFavorite={isFavorite(place.id)}
                      onSelect={(p) => {
                        onPlaceSelect(p);
                        if (window.innerWidth < 768) onClose();
                      }}
                      onShowDetails={onShowDetails}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-50">
              <button 
                onClick={onResetRadar}
                className="w-full flex items-center justify-center gap-2 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:text-orange-500 transition-colors"
              >
                <RotateCcw size={10} /> Reset Radar
              </button>
            </div>

            <AnimatePresence>
              {isAddPanelOpen && (
                <AddPlacePanel 
                  onClose={() => setIsAddPanelOpen(false)} 
                  onSuccess={() => {
                    if (onRefreshPlaces) {
                      onRefreshPlaces();
                    }
                  }} 
                  currentMapCenter={userLocation}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
