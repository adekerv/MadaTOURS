import React from 'react';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import { Place } from '../../types';

interface PlaceCardProps {
  place: Place;
  index: number;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (place: Place) => void;
  onShowDetails: (place: Place) => void;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ 
  place, 
  index, 
  isSelected, 
  isFavorite, 
  onSelect, 
  onShowDetails 
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      key={place.id}
      onClick={() => onSelect(place)}
      className={`bg-white border-2 p-4 rounded-3xl transition-all cursor-pointer group hover:shadow-xl ${
        isSelected 
        ? 'border-orange-500 shadow-lg scale-[1.02] bg-orange-50/10' 
        : 'border-slate-50 hover:border-orange-100'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className={`font-black text-slate-800 text-sm md:text-base group-hover:text-orange-600 transition-colors ${isSelected ? 'text-orange-600' : ''}`}>
          {place.name}
        </h3>
        <div className="flex items-center gap-1">
          {isFavorite && <Heart size={10} className="text-red-500 fill-red-500" />}
          <span className="text-[9px] md:text-[10px] font-black bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-md border border-orange-100">
            {place.distance?.toFixed(1)}km
          </span>
        </div>
      </div>
      <p className="text-[10px] md:text-[11px] text-slate-400 mb-3 line-clamp-1 font-medium italic">
        {place.description}
      </p>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onShowDetails(place);
        }}
        className="w-full bg-slate-800 text-white py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-700 transition-all active:scale-95"
      >
        Details
      </button>
    </motion.div>
  );
};
