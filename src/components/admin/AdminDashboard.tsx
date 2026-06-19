import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, ShieldCheck, Plus, Check, Play, X, Trash2, 
  MapPin, Clock, Tag, Image, Star, Eye, Calendar, Terminal 
} from 'lucide-react';
import { Place, User } from '../../types';

interface AdminDashboardProps {
  user: User | null;
  onClose: () => void;
  onRefreshPlaces?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  user, 
  onClose, 
  onRefreshPlaces 
}) => {
  // Security guard check
  if (!user || user.role !== 'admin') {
    return (
      <div className="fixed inset-0 z-[250] bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
        <div className="text-center space-y-4 max-w-sm">
          <span className="text-5xl">🚫</span>
          <h2 className="text-2xl font-black uppercase tracking-wider text-red-500">Access Denied</h2>
          <p className="text-xs text-slate-400 font-medium">
            This module is reserved strictly for authorized administrator credentials.
          </p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 rounded-xl font-bold text-xs uppercase text-white hover:bg-slate-700 transition-colors"
          >
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  // Live spots list retrieved from database
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<'restaurant' | 'activity'>('activity');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState('14.6000');
  const [lng, setLng] = useState('-61.0500');
  const [rating, setRating] = useState('4.8');
  const [hours, setHours] = useState('9:00 AM - 6:00 PM');
  const [tags, setTags] = useState('');
  const [image, setImage] = useState('');

  // UI state managers
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    activities: 0,
    restaurants: 0,
  });

  const fetchPlaces = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/places');
      if (res.ok) {
        const data: Place[] = await res.json();
        setPlaces(data);
        
        // Compute DB statistics metrics
        const activities = data.filter(p => p.type === 'activity').length;
        const restaurants = data.filter(p => p.type === 'restaurant').length;
        setStats({
          total: data.length,
          activities,
          restaurants,
        });
      }
    } catch (err) {
      console.error('Failed to load places in Admin view:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchPlaces();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim() || !lat || !lng || !description.trim()) {
      setError('Please fill in vital SQL columns: Name, category type, location, lat/lng coordinates and description.');
      return;
    }

    setSubmitLoading(true);
    setError(null);

    const parsedTags = tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const body = {
      name: name.trim(),
      type,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      location: location.trim(),
      description: description.trim(),
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
        const errorText = await res.text();
        throw new Error(errorText || 'INSERT query execution failed on database.');
      }

      setSuccess(true);
      
      // Cleanup inputs
      setName('');
      setDescription('');
      setLocation('');
      setTags('');
      setImage('');
      
      // Redirection callback
      if (onRefreshPlaces) onRefreshPlaces();
      
      // Refresh list to show newly added entry immediately
      await fetchPlaces();

      setTimeout(() => {
        setSuccess(false);
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Admin Delete Location
  const handleDeletePlace = async (id: number) => {
    setDeleteId(id);
    try {
      const res = await fetch(`/api/places/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchPlaces();
        if (onRefreshPlaces) onRefreshPlaces();
      } else {
        const json = await res.json();
        alert(json.error || 'Failed to delete record');
      }
    } catch (err) {
      console.error('Delete action failed:', err);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-900 border-l-4 border-orange-500 overflow-y-auto text-slate-100 font-sans flex flex-col md:flex-row"
    >
      {/* Sidebar Command Rail */}
      <div className="w-full md:w-80 bg-slate-950 border-r border-slate-800 p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-tight leading-none italic">Admin Panel</h3>
                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block mt-1">Live Relational SQL</span>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Active metrics */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Database Metrics</h4>
            <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-2xl space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">Total Locations</span>
                <span className="px-2.5 py-1 text-xs font-black bg-slate-800 text-white rounded-lg border border-slate-700">
                  {stats.total}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">Activities / Spots</span>
                <span className="px-2.5 py-1 text-xs font-black bg-slate-800 text-orange-400 rounded-lg border border-slate-700">
                  {stats.activities}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">Restaurants / Food</span>
                <span className="px-2.5 py-1 text-xs font-black bg-slate-800 text-amber-400 rounded-lg border border-slate-700">
                  {stats.restaurants}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl flex items-start gap-3">
            <span className="text-xl">🤵</span>
            <div className="text-left space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Signed In Active Admin</p>
              <p className="text-xs font-bold text-white truncate max-w-[170px]" title={user.email}>{user.email}</p>
              <p className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wide">Root Authority Granted</p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/60 hidden md:block select-none text-left space-y-2">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
            <Terminal size={12} className="text-orange-500" /> PHP/PDO Connection Status
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 font-mono text-[9px] text-slate-400 leading-none">
            pdo_mysql status: <span className="text-green-400">ACTIVE</span><br/>
            host: <span className="text-teal-400">127.0.0.1</span>
          </div>
        </div>
      </div>

      {/* Main Form Dashboard Body */}
      <div className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 text-left">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tight italic">Relational Admin Database</h2>
            <p className="text-xs font-medium text-slate-400 max-w-xl">
              Write live entries into the MySQL table directly. Authenticated administrators can append locations, restaurants, viewpoints, beaches, and schedule tracks.
            </p>
          </div>
          <button
            onClick={onClose}
            className="sm:self-start bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white text-xs font-extrabold uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all cursor-pointer border-none"
          >
            ← Back to App
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
          
          {/* Form Side - Span 7 */}
          <section className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2">
              <Plus className="text-orange-500" size={18} />
              <h3 className="text-lg font-black text-white italic">Add New Location Spot</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Destination Name */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Destination Name *</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Balata Gardens Canopy"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Type Category Selection & Municipality Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Category Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'restaurant' | 'activity')}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none transition-colors"
                  >
                    <option value="activity">🎯 Spot / Activity</option>
                    <option value="restaurant">🍴 Restaurant / Food</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Municipality (Location) *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Fort-de-France"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Latitude & Longitude Coordinates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">GPS Latitude *</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate-500 pointer-events-none text-xs font-bold">lat:</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="14.6"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl pl-12 pr-4 py-2.5 text-xs font-bold text-white focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">GPS Longitude *</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate-500 pointer-events-none text-xs font-bold">lng:</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="-61.0"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl pl-12 pr-4 py-2.5 text-xs font-bold text-white focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Spot Description *</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide a wonderful overview detailing what hikers or food lovers can access..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Optional Fields (Rating, Hours, Tags, Image URL) */}
              <div className="border-t border-slate-800/80 pt-4 mt-2 space-y-4">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#F97316]">Optional Refined Parameters</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Rating Score</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="5.0"
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Visiting Hours</label>
                    <input
                      type="text"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="e.g. 8:00 AM - 5:30 PM"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Tags (Comma Separated)</label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="Hiking, Panoramic, Waterfall"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Scene Unsplash Image URL</label>
                    <input
                      type="url"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-950/60 border border-red-850 p-3 rounded-xl text-[10px] font-black text-red-400 text-center uppercase tracking-wide">
                  ⚠️ {error}
                </div>
              )}

              {success && (
                <div className="bg-green-950/60 border border-green-850 p-3 rounded-xl text-[10px] font-black text-green-400 text-center uppercase tracking-wide">
                  ✅ live destination registered successfully to relational database!
                </div>
              )}

              <button
                type="submit"
                disabled={submitLoading || success}
                className="w-full h-11 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-800 text-white disabled:text-slate-500 font-extrabold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer border-none"
              >
                {submitLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Database size={15} />
                    <span>Execute SQL Insert Query</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Table Management List - Span 5 */}
          <section className="lg:col-span-12 xl:col-span-5 bg-slate-950/75 border border-slate-800 rounded-3xl p-6 flex flex-col max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 shrink-0">
              <h3 className="text-lg font-black text-white italic flex items-center gap-2">
                <Terminal size={18} className="text-orange-400" /> Database Live Rows
              </h3>
              <span className="text-[10px] bg-slate-900 text-slate-400 font-bold px-2 py-0.5 rounded-lg">
                PDO Query Select
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
              {loadingList ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold">Querying locations table...</p>
                </div>
              ) : places.length === 0 ? (
                <p className="text-xs text-slate-500 py-10 text-center">No locations registered on current session list.</p>
              ) : (
                places.map((place) => (
                  <div 
                    key={place.id}
                    className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg select-none shrink-0 border border-slate-700">
                        {place.type === 'activity' ? '🎯' : '🍴'}
                      </div>
                      <div className="text-left min-w-0 leading-tight">
                        <p className="text-xs font-extrabold text-white truncate">{place.name}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{place.location}</p>
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                          lat:{place.lat.toFixed(3)} • lng:{place.lng.toFixed(3)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeletePlace(place.id)}
                      disabled={deleteId === place.id}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                      title="Delete Record"
                    >
                      {deleteId === place.id ? (
                        <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
      </div>
    </motion.div>
  );
};
