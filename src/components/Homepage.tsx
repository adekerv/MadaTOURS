import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Compass, Utensils, Mountain, Heart, Ticket, Gamepad2, LogIn, LogOut, ShieldCheck, User as UserIcon, Calendar } from 'lucide-react';
import { Place, User } from '../types';
import { FavoriteCard } from './home/FavoriteCard';
import { RevisitCard } from './home/RevisitCard';
import { SearchBar } from './home/SearchBar';
import { WeatherWidget } from './home/WeatherWidget';
import placesJson from '../data/places.json';

interface HomepageProps {
  onStart: (params?: { 
    filter: 'all' | 'restaurant' | 'activity'; 
    sortBy?: 'rating' | 'hiking' | 'entertainment';
    selectedPlaceId?: number;
  }) => void;
  favorites: Place[];
  onRemoveFavorite: (place: Place) => void;
  revisits: Place[];
  onRemoveRevisit: (place: Place) => void;
  user: User | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onAdminClick: () => void;
}

const BackgroundDecor: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-100/30 rounded-full blur-[120px] animate-pulse" />
    <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-blue-100/20 rounded-full blur-[100px]" />
  </div>
);

const Hero: React.FC<{ onStart: (params?: { filter: 'all' | 'restaurant' | 'activity'; sortBy?: 'rating' | 'hiking' | 'entertainment' }) => void }> = ({ onStart }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    className="w-full max-w-5xl relative z-10"
  >
    <motion.div 
      initial={{ scale: 0.8, opacity: 0, rotate: -20 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.3 }}
      className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-orange-100 mb-10 shadow-sm"
    >
      <Compass className="w-4 h-4 text-orange-500 animate-[spin_8s_linear_infinite]" />
      <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.25em] text-orange-600">The Ultimate Island Radar</span>
    </motion.div>

    <h1 className="text-6xl md:text-9xl font-black text-slate-900 tracking-tighter leading-[0.8] mb-8 select-none font-sans overflow-hidden">
      {["M", "A", "D", "A"].map((char, i) => (
        <motion.span
          key={i}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 + i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {char}
        </motion.span>
      ))}
      <span className="text-orange-500 relative font-serif italic tracking-tight inline-block">
        {["T", "O", "U", "R", "S"].map((char, i) => (
          <motion.span
            key={i}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 + i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block"
          >
            {char}
          </motion.span>
        ))}
        <motion.span 
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="absolute -bottom-1 md:-bottom-2 left-0 w-full h-1 md:h-2 bg-orange-100 -z-10 rounded-full opacity-50 origin-left"
        />
      </span>
    </h1>
    
    <motion.p 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 1 }}
      className="text-xl md:text-3xl text-slate-400 font-medium max-w-2xl mx-auto leading-tight mb-10"
    >
      Discover Martinique's <span className="text-slate-900 font-bold italic tracking-tight">secret coastlines</span> and <span className="text-slate-900 font-bold italic tracking-tight">hidden kitchens</span> within a 50km pulse.
    </motion.p>

    {/* Martinique Live Weather Capsule */}
    <WeatherWidget />

    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8, duration: 0.5 }}
    >
      <motion.button
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onStart()}
        className="group relative bg-slate-900 text-white px-10 md:px-16 py-6 md:py-8 rounded-[2rem] font-black text-2xl md:text-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.4)] transition-all flex items-center gap-6 mx-auto overflow-hidden active:scale-95"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <span className="relative z-10">Initialize Radar</span>
        <div className="relative z-10 w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
          <MapPin className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
      </motion.button>
    </motion.div>
  </motion.div>
);

const Features: React.FC<{ 
  onSelectFeature: (type: 'restaurant' | 'activity', sortBy?: 'rating' | 'hiking' | 'entertainment') => void 
}> = ({ onSelectFeature }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mt-24 relative z-10">
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelectFeature('restaurant', 'rating')}
      className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden group relative text-left w-full cursor-pointer transition-all focus:outline-none focus:ring-4 focus:ring-orange-500/20 flex flex-col justify-between min-h-[345px]"
    >
      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
        <Utensils size={140} className="rotate-12" />
      </div>
      <div className="relative z-10 space-y-4">
        <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest block">The Taste of the Island</span>
        <h3 className="text-3xl font-black text-slate-900 italic leading-none group-hover:text-orange-500 transition-colors">Culinary Highs</h3>
        <p className="text-slate-500 text-sm font-medium leading-relaxed">
          From sophisticated French-Creole fusion in Fort-de-France to the freshest beach lobster shacks.
        </p>
      </div>
      <div className="mt-6 relative z-10">
        <span className="inline-flex items-center gap-2 bg-slate-900 group-hover:bg-orange-500 text-white px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-colors shadow-sm">
          🍴 Best Restaurants
        </span>
      </div>
    </motion.button>

    <motion.button
      type="button"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.1 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelectFeature('activity', 'hiking')}
      className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group text-left w-full cursor-pointer transition-all focus:outline-none focus:ring-4 focus:ring-orange-500/20 flex flex-col justify-between min-h-[345px]"
    >
      <div className="absolute bottom-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
        <Mountain size={140} className="rotate-12 text-white" />
      </div>
      <div className="relative z-10 text-white space-y-4">
        <span className="text-[10px] font-black uppercase text-orange-400 tracking-widest block font-sans">Uncharted Territories</span>
        <h3 className="text-3xl font-black italic leading-none group-hover:text-orange-400 transition-colors">Wild Reach</h3>
        <p className="text-slate-300 text-sm font-medium leading-relaxed">
          Trek Martinique's mountain trails, rainforest waterfalls, and scenic coastal lookouts.
        </p>
      </div>
      <div className="mt-6 relative z-10">
        <span className="inline-flex items-center gap-2 bg-orange-500 group-hover:bg-orange-600 text-white px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-colors shadow-sm">
          🥾 Explore Hikes
        </span>
      </div>
    </motion.button>

    <motion.button
      type="button"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.2 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelectFeature('activity', 'entertainment')}
      className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden group relative text-left w-full cursor-pointer transition-all focus:outline-none focus:ring-4 focus:ring-orange-500/20 flex flex-col justify-between min-h-[345px]"
    >
      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
        <Gamepad2 size={140} className="rotate-12 text-slate-800" />
      </div>
      <div className="relative z-10 space-y-4">
        <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest block">Extracurricular Play</span>
        <h3 className="text-3xl font-black text-slate-900 italic leading-none group-hover:text-orange-500 transition-colors">Island Fun</h3>
        <p className="text-slate-500 text-sm font-medium leading-relaxed">
          Unwind at movie cinemas, bowling alleys, fast outdoor racing go-karts, and high-tech glow laser tag arenas.
        </p>
      </div>
      <div className="mt-6 relative z-10">
        <span className="inline-flex items-center gap-2 bg-slate-900 group-hover:bg-orange-500 text-white px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-colors shadow-sm">
          🏎️ Cinemas & Go-Karts
        </span>
      </div>
    </motion.button>
  </div>
);

export const Homepage: React.FC<HomepageProps> = ({ 
  onStart, 
  favorites, 
  onRemoveFavorite,
  revisits,
  onRemoveRevisit,
  user,
  onLoginClick,
  onLogout,
  onAdminClick
}) => {
  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center py-12 md:py-16 px-6 text-center max-w-7xl mx-auto selection:bg-orange-200 overflow-x-hidden">
      <BackgroundDecor />

      {/* Premium Navigation Header with Search Bar & Auth Widgets */}
      <header className="w-full flex flex-col md:flex-row items-center justify-between gap-6 pb-12 mb-12 border-b border-slate-100/60 relative z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 select-none">
            <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center shadow-[0_4px_12px_rgba(249,115,22,0.25)]">
              <Compass className="w-5 h-5 text-white animate-[spin_15s_linear_infinite]" />
            </div>
            <span className="text-xl font-black text-slate-800 tracking-tight gap-1.5 flex items-center">
              MADA<span className="text-orange-500 italic font-serif font-bold">TOURS</span>
            </span>
          </div>

          {/* Conditional Mini State Badge */}
          {user && (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-full select-none">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                {user.role === 'admin' ? '🛡️ ADMIN ACCOUNT' : '👤 MEMBER SESSION'}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <SearchBar 
            places={placesJson as Place[]} 
            onSelectPlace={(place) => onStart({ filter: place.type, selectedPlaceId: place.id })} 
          />

          {/* User Sign In Controls */}
          <div className="shrink-0 flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-3">
                {user.role === 'admin' && (
                  <button 
                    onClick={onAdminClick}
                    title="Open Admin Dashboard"
                    className="h-11 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 border-none shadow-md hover:shadow-lg cursor-pointer"
                  >
                    <ShieldCheck size={14} />
                    <span>Control Panel</span>
                  </button>
                )}
                <div className="flex items-center gap-3 bg-white border border-slate-100 p-2 pl-3 rounded-2xl shadow-sm">
                  <div className="text-left">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">Logged In</div>
                    <div className="text-[11px] font-extrabold text-slate-700 truncate max-w-[130px] mt-0.5" title={user.email}>
                      {user.email}
                    </div>
                  </div>
                  <button 
                    onClick={onLogout}
                    title="Log Out Session"
                    className="p-2 hover:bg-red-50 hover:text-red-600 rounded-xl text-slate-400 transition-all border-none bg-transparent cursor-pointer"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={onLoginClick}
                className="h-11 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 border-none shadow-md hover:shadow-lg cursor-pointer"
              >
                <LogIn size={14} />
                <span>Sign In / Create Account</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <Hero onStart={onStart} />

      <Features onSelectFeature={(filter, sortBy) => onStart({ filter, sortBy, radius: 50 })} />

      {/* Dynamic Authorized Section */}
      {user ? (
        <div className="w-full space-y-24">
          
          {/* Favorites List - Only render if they are logged in */}
          {favorites.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="w-full space-y-12 pt-16"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 px-4 h-px bg-slate-200" />
                  <Heart className="text-red-500 fill-red-500 animate-pulse" size={24} />
                  <div className="w-1 px-4 h-px bg-slate-200" />
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight italic">Saved Expeditions</h2>
                <p className="text-xs text-slate-500 font-semibold tracking-wide leading-none -mt-2">
                  Your absolute favorite, curated spots in the Martinique archipelago.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
                <AnimatePresence mode="popLayout">
                  {favorites.map((place) => (
                    <FavoriteCard 
                      key={place.id}
                      place={place}
                      onRemove={onRemoveFavorite}
                      onLocate={() => onStart({ filter: place.type, selectedPlaceId: place.id })}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Revisits List - Render revisited panel if they have revisit entries */}
          {revisits.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="w-full space-y-12 pt-16 border-t border-slate-100/80"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 px-4 h-px bg-slate-200" />
                  <Calendar className="text-amber-500 animate-bounce" size={24} />
                  <div className="w-1 px-4 h-px bg-slate-200" />
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight italic">Scheduled Revisits</h2>
                <p className="text-xs text-slate-500 font-semibold tracking-wide leading-none -mt-2">
                  Destinations scheduled on your custom watchlist to visit again.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
                <AnimatePresence mode="popLayout">
                  {revisits.map((place) => (
                    <RevisitCard 
                      key={place.id}
                      place={place}
                      onRemove={onRemoveRevisit}
                      onLocate={onStart}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* empty state prompt if logged in without savings */}
          {favorites.length === 0 && revisits.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="w-full py-16 border-t border-slate-100 max-w-xl mx-auto flex flex-col items-center gap-3 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-50/80 border border-orange-100 flex items-center justify-center text-orange-500 text-lg mb-1 shadow-sm">
                🗺️
              </div>
              <h3 className="text-lg font-black text-slate-800 leading-none">Your Personal Map is Empty</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-sm">
                Explore local dining, hiking, and beaches to build up your premium favorites list and plan-to-revisit watchlist!
              </p>
              <button 
                onClick={() => onStart({ filter: 'all' })}
                className="bg-orange-500 text-white font-black text-[9px] uppercase tracking-widest px-4 py-2.5 rounded-xl block mt-1 hover:bg-orange-600 transition-colors border-none cursor-pointer"
              >
                Launch Radar Exploration
              </button>
            </motion.div>
          )}

        </div>
      ) : (
        /* Guest welcome message */
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="w-full mt-24 py-12 px-8 bg-gradient-to-br from-orange-50/50 to-amber-50/30 rounded-[3.5rem] border border-orange-100/60 max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-left shadow-sm"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 block">⚡ Unlock Personalized Expedition Lists</span>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight italic leading-none">Synchronize Favorites & Scheduled Revisits</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xl">
              Normal visitors can explore the Martinique radar coordinates, but registered users get direct access to saving private favorites, assigning revisit watchlists, and secure persistent logs.
            </p>
          </div>
          <button 
            onClick={onLoginClick}
            className="shrink-0 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider py-4 px-6 rounded-2xl shadow-lg transition-all border-none cursor-pointer"
          >
            Create Free Account
          </button>
        </motion.div>
      )}

      {/* Footer Creds */}
      <footer className="mt-auto pt-24 opacity-30 text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 pb-8">
        Madatours &copy; 2026 &bull; Martinique Edition
      </footer>
    </div>
  );
};

