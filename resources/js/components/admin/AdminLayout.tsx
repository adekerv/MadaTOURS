import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Compass,
  Globe,
  History,
  Image,
  Inbox,
  LayoutDashboard,
  MapPin,
  Route,
  Send,
  Settings2,
  ShieldAlert,
  Star,
  Users,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { api } from '../../lib/api';
import { normalizePlace } from '../../lib/places-utils';
import { useSession } from '../../lib/session';
import type { Place } from '../../types';
import { AccountMenu } from '../ui/AccountMenu';
import { LanguageSelect } from '../ui/LanguageSelect';
import { AdminOverview } from './AdminOverview';
import { AdminTours } from './AdminTours';
import { AdminPlaces } from './AdminPlaces';
import { AdminMeetups } from './AdminMeetups';
import { AdminUsers } from './AdminUsers';
import { AdminReviews } from './AdminReviews';
import { AdminMessages } from './AdminMessages';
import { AdminSettings } from './AdminSettings';
import { AdminLog } from './AdminLog';
import { SubmissionModeration } from './SubmissionModeration';
import { OwnerPhotos } from './OwnerPhotos';
import { EnrichmentModeration } from './EnrichmentModeration';
import { SectionHeader } from './AdminKit';

export type AdminPlaceList = {
  places: Place[];
  loading: boolean;
  error: string;
  reload: () => void;
};
type SectionProps = { places: AdminPlaceList; onRefreshPlaces: () => void };
type Section = {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  count?: 'messagesNew' | 'submissionsPending';
  render: (props: SectionProps) => ReactNode;
};

const sections: Section[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, render: () => <AdminOverview /> },
  {
    id: 'tours',
    label: 'Tours',
    icon: Route,
    render: ({ places }) => <AdminTours places={places.places} />,
  },
  {
    id: 'places',
    label: 'Places',
    icon: MapPin,
    render: ({ places, onRefreshPlaces }) => (
      <AdminPlaces places={places} onChanged={onRefreshPlaces} />
    ),
  },
  {
    id: 'meetups',
    label: 'Meet-ups',
    icon: CalendarDays,
    render: ({ places }) => <AdminMeetups places={places.places} />,
  },
  { id: 'users', label: 'Users', icon: Users, render: () => <AdminUsers /> },
  {
    id: 'reviews',
    label: 'Reviews',
    icon: Star,
    render: ({ onRefreshPlaces }) => <AdminReviews onChanged={onRefreshPlaces} />,
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: Inbox,
    count: 'messagesNew',
    render: () => <AdminMessages />,
  },
  {
    id: 'submissions',
    label: 'Submissions',
    icon: Send,
    count: 'submissionsPending',
    render: ({ onRefreshPlaces }) => (
      <Wrapped
        title="Place submissions"
        description="Places visitors suggested, waiting for a decision."
      >
        <SubmissionModeration onPublished={onRefreshPlaces} />
      </Wrapped>
    ),
  },
  {
    id: 'photos',
    label: 'Photos',
    icon: Image,
    render: ({ places, onRefreshPlaces }) => (
      <Wrapped
        title="Owner photos and photo reports"
        description="Photos owners allowed us to use, and reports visitors sent about photos."
      >
        <OwnerPhotos places={places.places} onChanged={onRefreshPlaces} />
      </Wrapped>
    ),
  },
  {
    id: 'sources',
    label: 'Sources and Google',
    icon: Globe,
    render: ({ places, onRefreshPlaces }) => (
      <Wrapped
        title="Sources and Google matching"
        description="Where place details come from, and their Google matches."
      >
        <EnrichmentModeration places={places.places} onChanged={onRefreshPlaces} />
      </Wrapped>
    ),
  },
  { id: 'settings', label: 'Site content', icon: Settings2, render: () => <AdminSettings /> },
  { id: 'log', label: 'Activity log', icon: History, render: () => <AdminLog /> },
];

function Wrapped({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <>
      <SectionHeader title={t(title)} description={t(description)} />
      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">{children}</div>
    </>
  );
}

/**
 * The admin dashboard, at #admin and #admin/<section>. The page itself only shows administrators the controls; the
 * server checks the role again on every request, so hiding links is never the protection.
 */
export function AdminLayout({
  section,
  onRefreshPlaces,
}: {
  section: string;
  places: Place[];
  onRefreshPlaces: () => void;
}) {
  const { t } = useI18n();
  const { user, loading, openAuth } = useSession();
  const isAdmin = user?.role === 'admin';
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placesError, setPlacesError] = useState('');
  const [placesRevision, setPlacesRevision] = useState(0);
  const current = sections.find((item) => item.id === section) ?? sections[0];

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    api<Record<string, number>>('/admin/overview', { signal: controller.signal })
      .then((data) => !controller.signal.aborted && setCounts(data))
      .catch(() => {});
    return () => controller.abort();
  }, [isAdmin, section]);
  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    setPlacesLoading(true);
    setPlacesError('');
    // The full list, sources included: tours, photos and the Google panel all need it.
    api<unknown[]>('/places?full=1', { signal: controller.signal })
      .then((data) => !controller.signal.aborted && setPlaces(data.map(normalizePlace)))
      .catch((failure) => !controller.signal.aborted && setPlacesError(failure.message))
      .finally(() => !controller.signal.aborted && setPlacesLoading(false));
    return () => controller.abort();
  }, [isAdmin, placesRevision]);
  useEffect(() => {
    // On phones the sections are a scrolling bar; keep the open one in view.
    document
      .querySelector('.admin-nav-link[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current.id, isAdmin]);
  useEffect(() => {
    document.title = `${t(current.label)} · MadaTours Admin`;
    return () => {
      document.title = 'MadaTours';
    };
  }, [current.label, t]);

  if (loading || !isAdmin)
    return (
      <div className="home-shell mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
        {loading ? (
          <p role="status" className="text-slate-600">
            {t('Connecting…')}
          </p>
        ) : (
          <main id="main-content" tabIndex={-1} className="space-y-4">
            <ShieldAlert size={40} aria-hidden className="mx-auto text-orange-700" />
            <h1 className="text-2xl font-bold">
              {t(user ? 'This page is for administrators' : 'Sign in to open the dashboard')}
            </h1>
            <p className="text-slate-600">
              {t(
                user
                  ? 'Your account does not have administrator access.'
                  : 'The admin dashboard needs an administrator account.',
              )}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {!user && (
                <button className="primary-button" onClick={() => openAuth('login')}>
                  {t('Sign in')}
                </button>
              )}
              <a href="#" className="secondary-button inline-flex items-center">
                {t('Back to home')}
              </a>
            </div>
          </main>
        )}
      </div>
    );

  const refreshPlaces = () => {
    setPlacesRevision((value) => value + 1);
    onRefreshPlaces();
  };
  const nav = (
    <ul className="flex gap-1 md:flex-col">
      {sections.map((item) => {
        const Icon = item.icon;
        const count = item.count ? counts[item.count] : 0;
        return (
          <li key={item.id}>
            <a
              href={`#admin/${item.id}`}
              aria-current={item.id === current.id ? 'page' : undefined}
              className="admin-nav-link"
            >
              <Icon size={18} aria-hidden />
              {t(item.label)}
              {count > 0 && (
                <span className="admin-nav-count" aria-label={t('{count} waiting', { count })}>
                  {count}
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="admin-shell bg-slate-50">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
        <a href="#admin" className="flex min-h-11 items-center gap-2 font-bold text-slate-900">
          <span className="grid size-9 place-items-center rounded-xl bg-orange-600 text-white">
            <Compass size={20} aria-hidden />
          </span>
          <span className="hidden min-[420px]:inline">MadaTours</span>
          <span className="text-sm font-semibold text-orange-700">{t('Admin')}</span>
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href="#"
            className="icon-button w-auto min-w-11 gap-2 px-2 text-sm font-semibold"
            aria-label={t('View the site')}
          >
            <ArrowLeft size={18} aria-hidden />
            <span className="hidden lg:inline">{t('View the site')}</span>
          </a>
          <LanguageSelect />
          <AccountMenu compact />
        </div>
      </header>
      <div className="mx-auto flex max-w-[90rem] flex-col md:flex-row">
        <nav
          aria-label={t('Admin sections')}
          className="sticky top-[61px] z-20 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 md:top-[61px] md:h-[calc(100dvh-61px)] md:w-60 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:py-4"
        >
          {nav}
        </nav>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {current.render({
            places: { places, loading: placesLoading, error: placesError, reload: refreshPlaces },
            onRefreshPlaces: refreshPlaces,
          })}
        </main>
      </div>
    </div>
  );
}
