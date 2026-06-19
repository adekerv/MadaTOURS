import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Plus, Check, Play, HelpCircle, X, MapPin } from 'lucide-react';
import { UserLocation } from '../../types';

interface AddPlacePanelProps {
  onClose: () => void;
  onSuccess: () => void;
  currentMapCenter: UserLocation | null;
}

export const AddPlacePanel: React.FC<AddPlacePanelProps> = ({ 
  onClose, 
  onSuccess, 
  currentMapCenter 
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'restaurant' | 'activity'>('activity');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [rating, setRating] = useState('4.8');
  const [hours, setHours] = useState('10:00 AM - 6:00 PM');
  const [tags, setTags] = useState('');
  const [image, setImage] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSqlExplain, setShowSqlExplain] = useState(true);

  // Auto-fill coordinates from current active map viewport center
  const handleAutofillCoords = () => {
    if (currentMapCenter) {
      setLat(currentMapCenter.lat.toFixed(5));
      setLng(currentMapCenter.lng.toFixed(5));
      if (!location) {
        setLocation('Martinique Coastline');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim() || !lat || !lng) {
      setError('Please fill in vital SQL columns: Name, Location, Lat & Lng.');
      return;
    }

    setLoading(true);
    setError(null);

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const body = {
      name: name.trim(),
      type,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      location: location.trim(),
      description: description.trim() || 'A sensational island gem.',
      rating: parseFloat(rating) || 4.5,
      hours: hours.trim() || 'Open Daily',
      tags: parsedTags,
      image: image.trim() || undefined
    };

    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'SQL Database Insert Failed');
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
        onClose();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 bg-white z-50 overflow-y-auto p-5 md:p-6 flex flex-col font-sans"
    >
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600">
            <Database className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 tracking-tight leading-none">PHP / SQL Admin</h3>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Insert Live SQL Records</span>
          </div>
        </div>
        <button 
          onClick={onClose}
          type="button" 
          className="p-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-4 text-left">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Destination Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Captain's Rum Distillery"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'restaurant' | 'activity')}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 transition-colors"
            >
              <option value="activity">🎯 Activity / Spot</option>
              <option value="restaurant">🍴 Food / Drink</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Municipality (Location) *</label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Sainte-Marie"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        {/* Latitude & Longitude with visual shortcut */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Coordinates (Lat / Lng) *</label>
            {currentMapCenter && (
              <button
                type="button"
                onClick={handleAutofillCoords}
                className="text-[9px] font-extrabold text-orange-600 uppercase tracking-wider flex items-center gap-1 hover:underline"
              >
                <MapPin className="w-2.5 h-2.5" /> Use Map Center
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="any"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="Latitude (e.g. 14.64)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <input
              type="number"
              step="any"
              required
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="Longitude (e.g. -61.02)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Review Rating</label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="5"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Visitor Hours</label>
            <input
              type="text"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 9:00 AM - 5:00 PM"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Short Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the atmosphere, activities or menu highlights..."
            rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Tags (Comma Separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. Hiking, Viewpoint, Waterfalls"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Scene Image URL (Optional)</label>
          <input
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://images.unsplash.com/..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 p-2.5 rounded-xl text-[10px] font-bold text-red-600 text-center uppercase tracking-wide">
            ⚠️ {error}
          </div>
        )}

        {/* Live SQL Preview (Highly intuitive and educational for PHP/SQL users!) */}
        {showSqlExplain && (
          <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[9px] text-orange-400 leading-normal border border-slate-800 select-all relative overflow-hidden">
            <span className="absolute top-0 right-0 bg-slate-800 text-slate-500 text-[8px] px-2 py-0.5 rounded-bl-xl font-bold uppercase tracking-wider">SQL Preview</span>
            <div className="text-slate-500 mb-1">// Behind the scenes (PHP PDO prepare mode):</div>
            <div className="text-white font-semibold">
              INSERT INTO <span className="text-teal-400">places</span> (name, type, lat, lng, location, description, rating, hours, tags) 
              VALUES (<span className="text-orange-300">"{name || '?'}"</span>, <span className="text-orange-300">"{type}"</span>, <span className="text-sky-300">{lat || '?' }</span>, <span className="text-sky-300">{lng || '?' }</span>, <span className="text-orange-300">"{location || '?'}"</span>, ...);
            </div>
            <div className="text-slate-500 mt-2">// Equivalent in PHP:</div>
            <div className="text-slate-300">
              $stmt = $db-&gt;prepare($sql);<br />
              $stmt-&gt;execute([...]);
            </div>
          </div>
        )}

        {/* Submit Execution Button */}
        <button
          type="submit"
          disabled={loading || success}
          className="w-full h-11 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-100 text-white disabled:text-slate-400 font-extrabold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98] transition-all cursor-pointer border-none"
        >
          {success ? (
            <>
              <Check className="w-4 h-4 text-green-500 stroke-[3]" />
              <span className="text-green-500">Query Executed successfully!</span>
            </>
          ) : loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Execute SQL Query</span>
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
};
