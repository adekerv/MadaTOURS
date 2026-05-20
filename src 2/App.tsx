import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Homepage } from './components/Homepage';
import { ExplorationPage } from './components/ExplorationPage';
import { Place } from './types';

export default function App() {
  const [view, setView] = useState<'home' | 'explore'>('home');
  const [favorites, setFavorites] = useState<Place[]>(() => {
    const saved = localStorage.getItem('madinina_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('madinina_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (place: Place) => {
    setFavorites(prev => {
      const isFav = prev.find(p => p.id === place.id);
      if (isFav) {
        return prev.filter(p => p.id !== place.id);
      } else {
        return [...prev, place];
      }
    });
  };

  return (
    <div className="min-h-screen bg-brand-bg select-none">
      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <Homepage 
              onStart={() => setView('explore')} 
              favorites={favorites}
              onRemoveFavorite={toggleFavorite}
            />
          </motion.div>
        ) : (
          <motion.div
            key="explore"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <ExplorationPage 
              onBack={() => setView('home')} 
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

