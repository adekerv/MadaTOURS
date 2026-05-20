import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Compass, Utensils, Mountain, Heart } from 'lucide-react';
import { Place } from '../types';
import { FavoriteCard } from './home/FavoriteCard';

interface HomepageProps {
  onStart: () => void;
  favorites: Place[];
  onRemoveFavorite: (place: Place) => void;
}

const BackgroundDecor: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-100/30 rounded-full blur-[120px] animate-pulse" />
    <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-blue-100/20 rounded-full blur-[100px]" />
  </div>
);

const Hero: React.FC<{ onStart: () => void }> = ({ onStart }) => (
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
      className="text-xl md:text-3xl text-slate-400 font-medium max-w-2xl mx-auto leading-tight mb-12"
    >
      Discover Martinique's <span className="text-slate-900 font-bold italic tracking-tight">secret coastlines</span> and <span className="text-slate-900 font-bold italic tracking-tight">hidden kitchens</span> within a 50km pulse.
    </motion.p>

    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8, duration: 0.5 }}
    >
      <motion.button
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
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

const Features: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full max-w-6xl mt-24 relative z-10">
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="md:col-span-7 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden group relative text-left"
    >
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
        <Utensils size={120} className="rotate-12" />
      </div>
      <div className="relative z-10 max-w-md">
        <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest mb-4 block">The Taste of the Island</span>
        <h3 className="text-4xl font-black text-slate-900 mb-6 italic leading-none">Culinary Highs</h3>
        <p className="text-slate-500 text-lg font-medium leading-relaxed">
          From sophisticated French-Creole fusion in Fort-de-France to the freshest lobster shacks on the Salines.
        </p>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, x: 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="md:col-span-5 bg-slate-900 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group text-left"
    >
      <div className="absolute bottom-0 left-0 p-8 opacity-20 group-hover:opacity-30 transition-opacity">
        <Mountain size={100} className="-rotate-12 text-white" />
      </div>
      <div className="relative z-10 text-white h-full flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-black uppercase text-orange-400 tracking-widest mb-4 block">Uncharted Territories</span>
          <h3 className="text-4xl font-black mb-6 italic leading-none">Wild Reach</h3>
        </div>
        <p className="text-slate-300 text-lg font-medium leading-relaxed">
          Trek the volcanic trails or dive into neon-blue coves only locals know.
        </p>
      </div>
    </motion.div>
  </div>
);

export const Homepage: React.FC<HomepageProps> = ({ onStart, favorites, onRemoveFavorite }) => {
  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center py-16 md:py-24 px-6 text-center max-w-7xl mx-auto selection:bg-orange-200 overflow-x-hidden">
      <BackgroundDecor />

      <Hero onStart={onStart} />

      <Features />

      {/* Favorites Section */}
      {favorites.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="w-full space-y-12 pt-32 pb-16"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1 px-4 h-px bg-slate-200" />
              <Heart className="text-red-500 fill-red-500" size={24} />
              <div className="w-1 px-4 h-px bg-slate-200" />
            </div>
            <h2 className="text-5xl font-black text-slate-900 tracking-tight italic">Saved Expeditions</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
            <AnimatePresence mode="popLayout">
              {favorites.map((place) => (
                <FavoriteCard 
                  key={place.id}
                  place={place}
                  onRemove={onRemoveFavorite}
                  onLocate={onStart}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Footer Creds */}
      <footer className="mt-auto pt-24 opacity-30 text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 pb-8">
        Madatours &copy; 2026 &bull; Martinique Edition
      </footer>
    </div>
  );
};
