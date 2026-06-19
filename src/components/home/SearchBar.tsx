import React, { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { Place } from '../../types';
import { getPlaceTheme } from '../../utils/emoji';

interface SearchBarProps {
  places: Place[];
  onSelectPlace: (place: Place) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ places, onSelectPlace }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
  };

  // Filter logic
  const filtered = query.trim() === '' 
    ? [] 
    : places.filter(place => {
        const matchesName = place.name.toLowerCase().includes(query.toLowerCase());
        const matchesLocation = place.location.toLowerCase().includes(query.toLowerCase());
        const matchesTags = place.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
        const matchesType = place.type.toLowerCase().includes(query.toLowerCase());
        return matchesName || matchesLocation || matchesTags || matchesType;
      }).slice(0, 8); // Display top 8 results

  return (
    <div ref={containerRef} className="relative w-full max-w-md z-50">
      {/* Search Input Container */}
      <div className="relative flex items-center bg-white/95 backdrop-blur-md rounded-full border border-slate-200/80 shadow-md hover:shadow-lg focus-within:shadow-xl focus-within:border-orange-200 transition-all duration-300">
        <div className="pl-5 pr-2 py-3 text-slate-400">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search places, restaurants, or activities..."
          className="w-full bg-transparent border-none py-3.5 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 font-medium"
        />
        {query && (
          <button
            onClick={handleClear}
            className="p-1 mr-3 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && query.trim() !== '' && (
        <div className="absolute top-[110%] left-0 right-0 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden divide-y divide-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {filtered.length > 0 ? (
            <div className="max-h-[380px] overflow-y-auto py-2 custom-scrollbar">
              {filtered.map((place) => {
                const theme = getPlaceTheme(place);
                return (
                  <button
                    key={place.id}
                    onClick={() => {
                      onSelectPlace(place);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className="w-full px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-center gap-4 text-left group"
                  >
                    {/* Themed Emoji Icon */}
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner border transition-transform group-hover:scale-105 duration-200"
                      style={{ backgroundColor: theme.bgColor, borderColor: theme.borderColor }}
                    >
                      {theme.emoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 group-hover:text-orange-600 transition-colors truncate">
                        {place.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span>{place.location}</span>
                        <span>•</span>
                        <span className="capitalize text-slate-500 font-semibold">{place.type}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-slate-400 text-sm font-medium">
              No matching locations, restaurants, or actions found
            </div>
          )}
        </div>
      )}
    </div>
  );
};
