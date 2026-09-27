import { useI18n } from './i18n/I18nProvider';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Notice } from './components/ui/Notice';
import { useNativeBack } from './hooks/useNativeBack';
import { Homepage } from './components/Homepage';
import { AuthModal } from './components/home/AuthModal';
import { AccountModal } from './components/home/AccountModal';
import { usePlaces } from './hooks/usePlaces';
import { api, ApiError, errorMessage } from './lib/api';
import type { ExploreParams, Place, User } from './types';
import { clearOfflinePlaces, readOfflinePlaces, saveOfflinePlaces } from './lib/offline';
import { normalizePlace } from './lib/places-utils';

const DayPlanner = lazy(() =>
  import('./components/planner/DayPlanner').then((m) => ({ default: m.DayPlanner })),
);
const OfflinePlacesModal = lazy(() =>
  import('./components/home/OfflinePlacesModal').then((m) => ({ default: m.OfflinePlacesModal })),
);
const ExplorationPage = lazy(() =>
  import('./components/ExplorationPage').then((module) => ({ default: module.ExplorationPage })),
);
const AdminDashboard = lazy(() =>
  import('./components/admin/AdminDashboard').then((module) => ({
    default: module.AdminDashboard,
  })),
);
function readRoute(): ExploreParams | null {
  if (!location.hash.startsWith('#explore')) return null;
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const filter = params.get('filter');
  const sortBy = params.get('sort');
  const selected = Number(params.get('place'));
  return {
    filter: filter === 'restaurant' || filter === 'activity' ? filter : 'all',
    radius: Math.min(100, Math.max(1, Number(params.get('radius')) || 50)),
    sortBy:
      sortBy === 'hiking' || sortBy === 'entertainment' || sortBy === 'rating' ? sortBy : undefined,
    selectedPlaceId: Number.isSafeInteger(selected) && selected > 0 ? selected : undefined,
  };
}
export default function App() {
  const { t } = useI18n();
  useNativeBack();
  const { places, catalogueStatus, refreshPlaces } = usePlaces();
  const [exploreParams, setExploreParams] = useState(readRoute);
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<Place[]>([]);
  const [revisits, setRevisits] = useState<Place[]>([]);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [sessionLoading, setSessionLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [syncRevision, setSyncRevision] = useState(0);
  const pending = useRef(new Set<string>());
  const currentUser = useRef(user);
  currentUser.current = user;

  useEffect(() => {
    const onChange = () => {
      setExploreParams(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  useEffect(() => {
    let active = true;
    // Discard the old untrusted local profile; identity now comes from the server session.
    try {
      localStorage.removeItem('madatours_user');
    } catch {
      /* Storage can be disabled. */
    }
    api<{ user: User | null }>('/auth/session')
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setNotice('Could not check your session. You can still explore places.');
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setFavorites([]);
    setRevisits([]);
    pending.current.clear();
    if (!user) {
      setCollectionsLoading(false);
      return () => controller.abort();
    }
    if (readOfflinePlaces()?.ownerId !== user.id) clearOfflinePlaces();
    setCollectionsLoading(true);
    Promise.all([
      api<unknown[]>('/favorites', { signal: controller.signal }),
      api<unknown[]>('/revisits', { signal: controller.signal }),
    ])
      .then(([favs, visits]) => {
        if (!controller.signal.aborted) {
          setFavorites(favs.map(normalizePlace));
          setRevisits(visits.map(normalizePlace));
          if (!saveOfflinePlaces(user.id, favs.map(normalizePlace), visits.map(normalizePlace)))
            setNotice(
              'Device storage is unavailable. Changes will be lost when you close the app.',
            );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setNotice(errorMessage(error));
          if (error instanceof ApiError && error.status === 401) setUser(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCollectionsLoading(false);
      });
    return () => controller.abort();
  }, [user, syncRevision]);

  const toggleSaved = async (collection: 'favorites' | 'revisits', place: Place) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (collectionsLoading) {
      setNotice('Your saved places are loading. Please try again in a moment.');
      return;
    }
    const key = `${collection}:${place.id}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    const exists = (collection === 'favorites' ? favorites : revisits).some(
      (item) => item.id === place.id,
    );
    try {
      await api(`/${collection}${exists ? `?placeId=${place.id}` : ''}`, {
        method: exists ? 'DELETE' : 'POST',
        body: exists ? undefined : JSON.stringify({ placeId: place.id }),
      });
      if (currentUser.current?.id !== user.id) return;
      (collection === 'favorites' ? setFavorites : setRevisits)((previous) =>
        exists
          ? previous.filter((item) => item.id !== place.id)
          : [...previous.filter((item) => item.id !== place.id), place],
      );
      const stored = readOfflinePlaces();
      const snapshot = stored?.ownerId === user.id ? stored : { favorites, revisits };
      const changed = exists
        ? snapshot[collection].filter((item) => item.id !== place.id)
        : [...snapshot[collection].filter((item) => item.id !== place.id), place];
      const cached = saveOfflinePlaces(
        user.id,
        collection === 'favorites' ? changed : snapshot.favorites,
        collection === 'revisits' ? changed : snapshot.revisits,
      );
      setNotice(
        cached
          ? t(
              exists
                ? collection === 'favorites'
                  ? 'Removed {name} from your favorites.'
                  : 'Removed {name} from your revisit list.'
                : collection === 'favorites'
                  ? 'Saved {name} to your favorites.'
                  : 'Saved {name} to your revisit list.',
              { name: place.name },
            )
          : 'Device storage is unavailable. Changes will be lost when you close the app.',
      );
    } catch (error) {
      if (currentUser.current?.id !== user.id) return;
      setNotice(errorMessage(error));
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setAuthOpen(true);
      }
    } finally {
      pending.current.delete(key);
    }
  };
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      clearOfflinePlaces();
      setAdminOpen(false);
      setNotice('You have signed out.');
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };
  const startExplore = useCallback((params: ExploreParams = { filter: 'all', radius: 50 }) => {
    const search = new URLSearchParams({
      filter: params.filter,
      radius: String(params.radius ?? 50),
    });
    if (params.sortBy) search.set('sort', params.sortBy);
    if (params.selectedPlaceId) search.set('place', String(params.selectedPlaceId));
    location.hash = `explore?${search}`;
  }, []);
  const backHome = () => {
    location.hash = '';
  };
  const refreshAll = () => {
    refreshPlaces();
    setSyncRevision((value) => value + 1);
  };

  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById('main-content');
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        {t('Skip to content')}
      </a>
      <Suspense
        fallback={
          <div role="status" className="grid min-h-dvh place-items-center text-slate-600">
            {t('Opening MadaTours…')}
          </div>
        }
      >
        {exploreParams ? (
          <ExplorationPage
            key={JSON.stringify(exploreParams)}
            places={places}
            catalogueStatus={catalogueStatus}
            onRefreshPlaces={refreshPlaces}
            onBack={backHome}
            favorites={favorites}
            revisits={revisits}
            onToggleFavorite={(place) => void toggleSaved('favorites', place)}
            onToggleRevisit={(place) => void toggleSaved('revisits', place)}
            user={user}
            onLoginClick={() => setAuthOpen(true)}
            initialParams={exploreParams}
            onAdminClick={() => setAdminOpen(true)}
          />
        ) : (
          <Homepage
            onStart={startExplore}
            onPlanDay={() => setPlannerOpen(true)}
            onOfflineClick={() => setOfflineOpen(true)}
            places={places}
            favorites={favorites}
            revisits={revisits}
            onRemoveFavorite={(place) => void toggleSaved('favorites', place)}
            onRemoveRevisit={(place) => void toggleSaved('revisits', place)}
            user={user}
            sessionLoading={sessionLoading}
            collectionsLoading={collectionsLoading}
            onAccountClick={() => setAccountOpen(true)}
            onLoginClick={() => setAuthOpen(true)}
            onLogout={() => void logout()}
            onAdminClick={() => setAdminOpen(true)}
          />
        )}
        {plannerOpen && (
          <DayPlanner
            places={places}
            savedPlaces={[...favorites, ...revisits]}
            onClose={() => setPlannerOpen(false)}
          />
        )}
        {offlineOpen && <OfflinePlacesModal onClose={() => setOfflineOpen(false)} />}
        {adminOpen && user?.role === 'admin' && (
          <AdminDashboard
            user={user}
            onClose={() => {
              setAdminOpen(false);
              refreshAll();
            }}
            onRefreshPlaces={refreshAll}
          />
        )}
      </Suspense>
      {accountOpen && user && (
        <AccountModal
          user={user}
          onClose={() => setAccountOpen(false)}
          onDeleted={() => {
            setUser(null);
            setAccountOpen(false);
            clearOfflinePlaces();
            setNotice(t('Your account and saved places have been deleted.'));
          }}
        />
      )}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onLoginSuccess={(loggedIn) => {
            setUser(loggedIn);
            setNotice(t('You are signed in.'));
          }}
        />
      )}
      {notice && <Notice message={notice} onDismiss={() => setNotice('')} />}
    </>
  );
}
