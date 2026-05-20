import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Place } from '../types';
import { X, ExternalLink, Clock, Star, MapPin, Heart } from 'lucide-react';

interface PlaceDetailModalProps {
  place: Place | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (place: Place) => void;
  googleMapsUrl: string;
}

export const PlaceDetailModal: React.FC<PlaceDetailModalProps> = ({
  place,
  onClose,
  isFavorite,
  onToggleFavorite,
  googleMapsUrl
}) => {
  if (!place) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white w-full h-[90vh] md:h-auto max-w-2xl rounded-t-[3rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden relative z-[2001] flex flex-col"
        >
          {/* Header Image */}
          <div className="h-48 md:h-64 bg-slate-200 relative shrink-0">
            {place.image ? (
              <img 
                src={place.image} 
                alt={place.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-200">
                <MapPin size={64} />
              </div>
            )}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-800 shadow-lg hover:bg-white transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-orange-500 mb-2 block">
                  {place.type} • {place.location}
                </span>
                <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight leading-none">
                  {place.name}
                </h2>
              </div>
              <button 
                onClick={() => onToggleFavorite(place)}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all shrink-0 ${
                  isFavorite ? 'bg-red-500 text-white shadow-red-100' : 'bg-slate-50 text-slate-300 hover:text-red-500'
                }`}
              >
                <Heart size={24} className={isFavorite ? 'fill-white' : ''} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
              <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm">
                  <Star size={20} fill="currentColor" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Rating</p>
                  <p className="font-bold text-sm md:text-base">{place.rating || '4.5'} / 5.0</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Open Hours</p>
                  <p className="font-bold text-sm md:text-base">{place.hours || 'Varies'}</p>
                </div>
              </div>
            </div>

            <p className="text-slate-500 text-base md:text-lg leading-relaxed mb-8 font-medium">
              {place.description}
            </p>

            {place.tags && (
              <div className="flex flex-wrap gap-2 mb-8">
                {place.tags.map(tag => (
                  <span key={tag} className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-4 sticky bottom-0 bg-white pt-4 pb-2 border-t border-slate-50 md:relative md:p-0 md:border-0">
              <a 
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-orange-500 text-white py-4 md:py-5 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95"
              >
                Launch Navigation <ExternalLink size={18} />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
