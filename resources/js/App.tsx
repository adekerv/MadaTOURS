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
import { splitSaved } from './lib/places-utils';
import { readExploreRoute, exploreHash } from './lib/explore-route';
import type { InformationRoute } from './components/information/InformationPage';

const InformationPage = lazy(() =>
  import('./components/information/InformationPage').then((module) => ({
    default: module.InformationPage,
  })),
);
function readInformationRoute(): InformationRoute | null {
  const page = location.hash.slice(1);
  return ['about', 'contact', 'privacy', 'terms', 'delete-account'].includes(page)
    ? (page as InformationRoute)
    : null;
}

const PlaceSubmissions = lazy(() =>
  import('./components/submissions/PlaceSubmissions').then((m) => ({
    default: m.PlaceSubmissions,
  })),
);
const RouteSuggestion = lazy(() =>
  import('./components/planner/RouteSuggestion').then((m) => ({ default: m.RouteSuggestion })),
);
const SocialHub = lazy(() =>
  import('./components/social/SocialHub').then((m) => ({ default: m.SocialHub })),
);
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
export default function App() {
  const { t } = useI18n();
  useNativeBack();
  const { places, catalogueStatus, refreshPlaces } = usePlaces();
  const [exploreParams, setExploreParams] = useState(() => readExploreRoute(location.hash));
  const [informationRoute, setInformationRoute] = useState(readInformationRoute);
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<Place[]>([]);
  const [revisits, setRevisits] = useState<Place[]>([]);
  const [unlisted, setUnlisted] = useState<{ favorites: number[]; revisits: number[] }>({
    favorites: [],
    revisits: [],
  });
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
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
      setExploreParams(readExploreRoute(location.hash));
      setInformationRoute(readInformationRoute());
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
    // Google sign-in returns here with a one-time status flag; read it once, then tidy the address bar.
    const params = new URLSearchParams(location.search);
    const authError = params.get('auth_error');
    const googleReturn = params.has('signed_in') || authError !== null;
    if (googleReturn) {
      params.delete('signed_in');
      params.delete('auth_error');
      const query = params.toString();
      const search = query ? `?${query}` : '';
      history.replaceState(null, '', `${location.pathname}${search}${location.hash}`);
    }
    api<{ user: User | null }>('/auth/session')
      .then((data) => {
        if (!active) return;
        setUser(data.user);
        if (authError === 'cancelled') setNotice('Google sign-in was cancelled.');
        else if (authError === 'rate_limited')
          setNotice('Too many attempts. Please try again in 15 minutes.');
        else if (authError !== null || (googleReturn && !data.user))
          setNotice('Google sign-in could not be completed. Please try again.');
        else if (googleReturn && data.user) setNotice('You are signed in with Google.');
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
    setUnlisted({ favorites: [], revisits: [] });
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
          const saved = { favorites: splitSaved(favs), revisits: splitSaved(visits) };
          setFavorites(saved.favorites.places);
          setRevisits(saved.revisits.places);
          setUnlisted({ favorites: saved.favorites.unlisted, revisits: saved.revisits.unlisted });
          if (!saveOfflinePlaces(user.id, saved.favorites.places, saved.revisits.places))
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

  const removeUnlisted = async (collection: 'favorites' | 'revisits', id: number) => {
    try {
      await api(`/${collection}?placeId=${id}`, { method: 'DELETE' });
      setUnlisted((previous) => ({
        ...previous,
        [collection]: previous[collection].filter((item) => item !== id),
      }));
      setNotice('Removed a place that is no longer listed.');
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };
  const toggleSaved = async (collection: 'favorites' | 'revisits', place: Place) => {
    if (!user) {
      setAuthMode('login');
      return;
    }
    if (collectionsLoading) {
      setNotice('Your saved places are loading. Please try again in a moment.');
      return;
    }
    const key = `${user.id}:${collection}:${place.id}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    const exists = (collection === 'favorites' ? favorites : revisits).some(
      (item) => item.id === place.id,
    );
    const updateCollection = collection === 'favorites' ? setFavorites : setRevisits;
    updateCollection((previous) =>
      exists
        ? previous.filter((item) => item.id !== place.id)
        : [...previous.filter((item) => item.id !== place.id), place],
    );
    try {
      await api(`/${collection}${exists ? `?placeId=${place.id}` : ''}`, {
        method: exists ? 'DELETE' : 'POST',
        body: exists ? undefined : JSON.stringify({ placeId: place.id }),
      });
      if (currentUser.current?.id !== user.id) return;
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
      updateCollection((previous) =>
        exists
          ? [...previous.filter((item) => item.id !== place.id), place]
          : previous.filter((item) => item.id !== place.id),
      );
      setNotice(errorMessage(error));
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setAuthMode('login');
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
    location.hash = exploreHash(params);
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
        {informationRoute ? (
          <InformationPage
            onSubmitPlace={() => (user ? setSubmissionOpen(true) : setAuthMode('login'))}
            page={informationRoute}
            signedIn={!!user}
            onAccount={() => (user ? setAccountOpen(true) : setAuthMode('login'))}
          />
        ) : exploreParams ? (
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
            onLoginClick={() => setAuthMode('login')}
            initialParams={exploreParams}
            onAdminClick={() => setAdminOpen(true)}
          />
        ) : (
          <Homepage
            onStart={startExplore}
            onSubmitPlace={() => (user ? setSubmissionOpen(true) : setAuthMode('login'))}
            onSuggestTrip={() => (user ? setSuggestOpen(true) : setAuthMode('login'))}
            onCommunity={() => (user ? setSocialOpen(true) : setAuthMode('login'))}
            onPlanDay={() => setPlannerOpen(true)}
            onSignup={() => setAuthMode('register')}
            onOfflineClick={() => setOfflineOpen(true)}
            places={places}
            favorites={favorites}
            catalogueLoading={catalogueStatus === 'loading'}
            revisits={revisits}
            unlisted={unlisted}
            onRemoveUnlisted={(collection, id) => void removeUnlisted(collection, id)}
            onRemoveFavorite={(place) => void toggleSaved('favorites', place)}
            onRemoveRevisit={(place) => void toggleSaved('revisits', place)}
            user={user}
            sessionLoading={sessionLoading}
            collectionsLoading={collectionsLoading}
            onAccountClick={() => setAccountOpen(true)}
            onLoginClick={() => setAuthMode('login')}
            onLogout={() => void logout()}
            onAdminClick={() => setAdminOpen(true)}
          />
        )}
        {submissionOpen && user && <PlaceSubmissions onClose={() => setSubmissionOpen(false)} />}
        {suggestOpen && user && (
          <RouteSuggestion
            places={places}
            onClose={() => setSuggestOpen(false)}
            onSaved={() => {
              setSuggestOpen(false);
              setPlannerOpen(true);
            }}
          />
        )}
        {socialOpen && user && (
          <SocialHub
            user={user}
            places={places}
            onClose={() => setSocialOpen(false)}
            onVerified={setUser}
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
      {!exploreParams && catalogueStatus === 'offline' && (
        <div
          role="status"
          className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          <span>
            {t(
              "You're offline or the connection is unavailable. Browse the saved guide; updates need a connection.",
            )}
          </span>
          <button onClick={refreshPlaces} className="shrink-0 font-semibold underline">
            {t('Retry')}
          </button>
        </div>
      )}
      {accountOpen && user && (
        <AccountModal
          user={user}
          onVerified={setUser}
          onClose={() => setAccountOpen(false)}
          onDeleted={() => {
            setUser(null);
            setAccountOpen(false);
            clearOfflinePlaces();
            setNotice(t('Your account and saved places have been deleted.'));
          }}
        />
      )}
      {authMode && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuthMode(null)}
          onLoginSuccess={(loggedIn, created) => {
            setUser(loggedIn);
            setNotice(
              t(created ? 'Thanks for signing up! Welcome, {name}.' : 'Welcome, {name}.', {
                name: loggedIn.name,
              }),
            );
          }}
        />
      )}
      {notice && <Notice message={notice} onDismiss={() => setNotice('')} />}
    </>
  );
}
