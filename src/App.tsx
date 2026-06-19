import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Homepage } from './components/Homepage';
import { ExplorationPage } from './components/ExplorationPage';
import { AuthModal } from './components/home/AuthModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { Place, User } from './types';

export default function App() {
  const [view, setView] = useState<'home' | 'explore'>('home');
  const [exploreParams, setExploreParams] = useState<{
    filter: 'all' | 'restaurant' | 'activity';
    radius?: number;
    sortBy?: 'rating' | 'hiking' | 'entertainment';
    selectedPlaceId?: number;
  } | null>(null);

  // Authenticated user state
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('madatours_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [favorites, setFavorites] = useState<Place[]>([]);
  const [revisits, setRevisits] = useState<Place[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Synchronize favorites & revisits whenever active user session loads or refreshes
  const syncUserData = async (activeUser: User) => {
    try {
      // 1. Fetch Favorites
      const favRes = await fetch(`/api/favorites?userId=${activeUser.id}`);
      if (favRes.ok) {
        const favData = await favRes.json();
        setFavorites(favData);
      }

      // 2. Fetch Revisits
      const revRes = await fetch(`/api/revisits?userId=${activeUser.id}`);
      if (revRes.ok) {
        const revData = await revRes.json();
        setRevisits(revData);
      }
    } catch (err) {
      console.error('Failed to sync user relational details:', err);
    }
  };

  useEffect(() => {
    if (user) {
      localStorage.setItem('madatours_user', JSON.stringify(user));
      syncUserData(user);
    } else {
      localStorage.removeItem('madatours_user');
      setFavorites([]);
      setRevisits([]);
    }
  }, [user]);

  // Toggle favorite on DB
  const toggleFavorite = async (place: Place) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    const exists = favorites.some((f) => f.id === place.id);

    if (exists) {
      // DELETE
      try {
        const res = await fetch(`/api/favorites?userId=${user.id}&placeId=${place.id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setFavorites((prev) => prev.filter((f) => f.id !== place.id));
        }
      } catch (err) {
        console.error('Error vacating favorite:', err);
      }
    } else {
      // INSERT
      try {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, placeId: place.id })
        });
        if (res.ok) {
          setFavorites((prev) => [...prev, place]);
        }
      } catch (err) {
        console.error('Error inserting favorite:', err);
      }
    }
  };

  // Toggle Revisit watchlist on DB
  const toggleRevisit = async (place: Place) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    const exists = revisits.some((r) => r.id === place.id);

    if (exists) {
      // DELETE
      try {
        const res = await fetch(`/api/revisits?userId=${user.id}&placeId=${place.id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setRevisits((prev) => prev.filter((r) => r.id !== place.id));
        }
      } catch (err) {
        console.error('Error vacating revisit:', err);
      }
    } else {
      // INSERT
      try {
        const res = await fetch('/api/revisits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, placeId: place.id })
        });
        if (res.ok) {
          setRevisits((prev) => [...prev, place]);
        }
      } catch (err) {
        console.error('Error inserting revisit:', err);
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  const startExplore = (params?: { 
    filter: 'all' | 'restaurant' | 'activity'; 
    radius?: number; 
    sortBy?: 'rating' | 'hiking' | 'entertainment';
    selectedPlaceId?: number;
  }) => {
    setExploreParams(params || null);
    setView('explore');
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] select-none">
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
              onStart={startExplore} 
              favorites={favorites}
              onRemoveFavorite={toggleFavorite}
              revisits={revisits}
              onRemoveRevisit={toggleRevisit}
              user={user}
              onLoginClick={() => setIsAuthModalOpen(true)}
              onLogout={handleLogout}
              onAdminClick={() => setIsAdminOpen(true)}
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
              onBack={() => {
                setView('home');
                setExploreParams(null);
              }} 
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              revisits={revisits}
              onToggleRevisit={toggleRevisit}
              user={user}
              onLoginClick={() => setIsAuthModalOpen(true)}
              initialParams={exploreParams}
              onAdminClick={() => setIsAdminOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* High Loyalty Auth Overlay Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <AuthModal 
            onClose={() => setIsAuthModalOpen(false)}
            onLoginSuccess={(loggedInUser) => {
              setUser(loggedInUser);
            }}
          />
        )}
      </AnimatePresence>

      {/* Admin Command Center Dashboard Overlay */}
      <AnimatePresence>
        {isAdminOpen && (
          <AdminDashboard
            user={user}
            onClose={() => setIsAdminOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
