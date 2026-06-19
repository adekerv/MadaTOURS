import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Trash2 } from 'lucide-react';
import { Place } from '../../types';
import { getPlaceTheme } from '../../utils/emoji';

interface RevisitCardProps {
  place: Place;
  onRemove: (place: Place) => void;
  onLocate: (params?: { 
    filter: 'all' | 'restaurant' | 'activity'; 
    selectedPlaceId?: number; 
  }) => void;
}

export const RevisitCard: React.FC<RevisitCardProps> = ({ place, onRemove, onLocate }) => {
  const theme = getPlaceTheme(place);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white border-2 border-slate-50 p-8 rounded-[3.5rem] shadow-sm hover:shadow-2xl hover:border-amber-100 transition-all relative group"
    >
      <div className="flex justify-between items-start mb-6">
        <div 
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner border relative"
          style={{ backgroundColor: theme.bgColor, borderColor: theme.borderColor }}
        >
          {theme.emoji}
          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 border-2 border-white shadow-sm flex items-center justify-center">
            <Calendar size={8} className="stroke-[3]" />
          </div>
        </div>
        <button 
          onClick={() => onRemove(place)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={20} />
        </button>
      </div>
      
      <div className="mb-8">
        <p className="text-amber-600 text-[10px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
          📅 PLAN TO REVISIT • {place.location}
        </p>
        <h3 className="text-2xl font-black text-slate-900 leading-tight mb-3">{place.name}</h3>
        <p className="text-slate-400 text-sm font-medium leading-relaxed italic line-clamp-2">
           &lsquo;{place.description}&rsquo;
        </p>
      </div>

      <button 
        onClick={() => onLocate({ filter: place.type, selectedPlaceId: place.id })}
        className="w-full bg-slate-50 group-hover:bg-slate-900 text-slate-400 group-hover:text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all"
      >
        Set Radar Mapping ➔
      </button>
    </motion.div>
  );
};
