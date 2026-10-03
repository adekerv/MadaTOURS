import { ArrowLeft } from 'lucide-react';
import type { User } from '../../types';
import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSelect } from '../ui/LanguageSelect';
import { SiteFooter } from '../ui/SiteFooter';
import { DeleteAccount } from './DeleteAccount';
import { EmailSection } from './EmailSection';
import { ProfileForm } from './ProfileForm';
export function SettingsPage({
  user,
  sessionLoading,
  onUserChange,
  onDeleted,
  onSignIn,
}: {
  user: User | null;
  sessionLoading: boolean;
  onUserChange: (user: User) => void;
  onDeleted: () => void;
  onSignIn: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="home-shell info-page mx-auto max-w-3xl px-4 sm:px-7">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-4">
        <a href="#" className="flex items-center gap-2 font-semibold text-orange-800">
          <ArrowLeft size={20} />
          {t('Back to home')}
        </a>
        <LanguageSelect />
      </header>
      <main id="main-content" tabIndex={-1} className="py-8 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">MADATOURS</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{t('Account settings')}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          {t('Change your name and email address, or delete your account.')}
        </p>
        {sessionLoading ? (
          <p role="status" className="mt-8 text-slate-600">
            {t('Connecting…')}
          </p>
        ) : user ? (
          <div className="mt-8 space-y-6">
            <ProfileForm key={user.id} user={user} onSaved={onUserChange} />
            <EmailSection user={user} onChanged={onUserChange} />
            <DeleteAccount key={user.id} user={user} onDeleted={onDeleted} />
          </div>
        ) : (
          <button className="primary-button mt-8" onClick={onSignIn}>
            {t('Sign in to manage your account')}
          </button>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
