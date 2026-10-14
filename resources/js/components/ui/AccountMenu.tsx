import { useEffect, useId, useRef, useState } from 'react';
import { LogIn, LogOut, ShieldCheck, UserPlus, UserRound } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useSession } from '../../lib/session';

/**
 * The account part of every page header. Signed out: Sign in and Sign up. Signed in: My account and Sign out, plus
 * Admin for administrators. On narrow screens the words fold away and the icons keep the same accessible names.
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { user, loading, openAuth, logout } = useSession();
  if (compact && user) return <CompactMenu />;
  const label = 'hidden sm:inline';
  if (loading)
    return (
      <span role="status" className="text-sm text-slate-500">
        {t('Connecting…')}
      </span>
    );
  if (!user)
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => openAuth('login', { redirect: true })}
          aria-label={t('Sign in')}
          className="secondary-button flex items-center gap-2 px-3"
        >
          <LogIn size={17} aria-hidden />
          {/* Small phones keep the icon, so Sign in and Sign up both fit beside the language menu. */}
          <span className={compact ? 'hidden sm:inline' : 'hidden min-[420px]:inline'}>
            {t('Sign in')}
          </span>
        </button>
        <button
          onClick={() => openAuth('register', { redirect: true })}
          className={`primary-button flex items-center gap-2 px-3 ${compact ? 'hidden sm:flex' : ''}`}
        >
          <UserPlus size={17} aria-hidden className="hidden sm:block" />
          <span>{t('Sign up')}</span>
        </button>
      </div>
    );
  const current = location.hash.slice(1).split('/')[0];
  return (
    <div className="flex items-center gap-1">
      {user.role === 'admin' && (
        <a
          href="#admin"
          aria-label={t('Admin')}
          aria-current={current === 'admin' ? 'page' : undefined}
          className="icon-button w-auto min-w-11 gap-2 px-2 font-semibold"
        >
          <ShieldCheck size={20} aria-hidden />
          <span className={label}>{t('Admin')}</span>
        </a>
      )}
      <a
        href="#account"
        aria-label={t('My account')}
        aria-current={current === 'account' || current === 'settings' ? 'page' : undefined}
        className="icon-button w-auto min-w-11 gap-2 px-2 font-semibold"
      >
        <UserRound size={20} aria-hidden />
        <span className={label}>{t('My account')}</span>
      </a>
      <button
        onClick={() => void logout()}
        aria-label={t('Sign out')}
        className="icon-button w-auto min-w-11 gap-2 px-2 font-semibold"
      >
        <LogOut size={20} aria-hidden />
        <span className={label}>{t('Sign out')}</span>
      </button>
    </div>
  );
}

/** One account button that opens a short menu, for headers with little room such as the map's. */
function CompactMenu() {
  const { t } = useI18n();
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const menu = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !root.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  if (!user) return null;
  const item =
    'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-slate-100';
  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={menu}
        aria-label={t('Account menu')}
        className="icon-button"
      >
        <UserRound size={20} aria-hidden />
      </button>
      {open && (
        <div
          id={menu}
          className="absolute right-0 top-12 z-[1200] w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-xs text-slate-500">{user.email}</p>
          {user.role === 'admin' && (
            <a href="#admin" className={item}>
              <ShieldCheck size={18} aria-hidden />
              {t('Admin')}
            </a>
          )}
          <a href="#account" className={item}>
            <UserRound size={18} aria-hidden />
            {t('My account')}
          </a>
          <button onClick={() => void logout()} className={item}>
            <LogOut size={18} aria-hidden />
            {t('Sign out')}
          </button>
        </div>
      )}
    </div>
  );
}
