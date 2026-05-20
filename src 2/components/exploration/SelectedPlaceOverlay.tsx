import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, X, Info } from 'lucide-react';
import { Place } from '../../types';

interface SelectedPlaceOverlayProps {
  place: Place | null;
  isVisible: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (place: Place) => void;
  onShowDetails: () => void;
  googleMapsUrl: string;
}

export const SelectedPlaceOverlay: React.FC<SelectedPlaceOverlayProps> = ({ 
  place, 
  isVisible,
  onClose,
  isFavorite,
  onToggleFavorite,
  onShowDetails,
  googleMapsUrl
}) => {
  return (
    <AnimatePresence>
      {isVisible && place && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] md:w-96 bg-white p-6 rounded-[2.5rem] shadow-2xl z-[1000] border-4 border-orange-100"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-orange-200">
                {place.type === 'restaurant' ? '🍴' : '🏄'}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-none">{place.name}</h3>
                <p className="text-orange-500 text-[10px] font-black uppercase tracking-widest mt-1">{place.location}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => onToggleFavorite(place)}
                className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
              >
                <Heart size={18} className={isFavorite ? 'fill-red-500' : ''} />
              </button>
              <button 
                onClick={onClose}
                className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          <p className="text-slate-500 text-sm font-medium leading-normal mb-6 line-clamp-2 italic">
            &ldquo;{place.description}&rdquo;
          </p>

          <div className="flex gap-3">
            <button 
              onClick={onShowDetails}
              className="flex-1 bg-slate-800 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-700 transition-all uppercase tracking-widest text-[10px]"
            >
              <Info size={16} /> More Info
            </button>
            <a 
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-200 hover:bg-orange-600 transition-all uppercase tracking-widest text-[10px]"
            >
              Maps ➔
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
