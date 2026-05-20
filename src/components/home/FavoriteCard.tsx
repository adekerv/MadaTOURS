import React from 'react';
import { motion } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { Place } from '../../types';

interface FavoriteCardProps {
  place: Place;
  onRemove: (place: Place) => void;
  onLocate: () => void;
}

export const FavoriteCard: React.FC<FavoriteCardProps> = ({ place, onRemove, onLocate }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white border-2 border-slate-50 p-8 rounded-[3.5rem] shadow-sm hover:shadow-2xl hover:border-orange-100 transition-all relative group"
    >
      <div className="flex justify-between items-start mb-6">
        <div className="w-14 h-14 bg-orange-50/50 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-orange-100/50">
          {place.type === 'restaurant' ? '🍴' : '🏄'}
        </div>
        <button 
          onClick={() => onRemove(place)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={20} />
        </button>
      </div>
      
      <div className="mb-8">
        <p className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{place.location}</p>
        <h3 className="text-2xl font-black text-slate-900 leading-tight mb-3">{place.name}</h3>
        <p className="text-slate-400 text-sm font-medium leading-relaxed italic line-clamp-2">
           &lsquo;{place.description}&rsquo;
        </p>
      </div>

      <button 
        onClick={onLocate}
        className="w-full bg-slate-50 group-hover:bg-slate-900 text-slate-400 group-hover:text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all"
      >
        Locate on Radar ➔
      </button>
    </motion.div>
  );
};
