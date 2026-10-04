import { Capacitor } from '@capacitor/core';
import type { User } from '../../types';
import { useI18n } from '../../i18n/I18nProvider';
/**
 * Meet-ups need an email address that has been proven to be the person's own. We send no email, so the only
 * proof available is Google's: an account that signs in with Google using this address counts as confirmed.
 */
export function VerifiedEmailNotice({ user }: { user: User }) {
  const { t } = useI18n();
  if (user.emailVerified)
    return (
      <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{t('Email verified')}</p>
    );
  return (
    <section className="space-y-3 rounded-2xl bg-orange-50 p-4">
      <h3 className="font-bold">{t('Meet-ups need a confirmed email')}</h3>
      <p className="text-sm text-slate-700">
        {t(
          'We do not send email, so Google confirms your address instead. Continue with Google using {email} to unlock meet-ups. You will then sign in with Google, and your recovery codes can set a password again.',
          { email: user.email },
        )}
      </p>
      {/* Google blocks sign-in inside embedded web views, so the native apps cannot offer this yet. */}
      {!Capacitor.isNativePlatform() && (
        <a href="/api/auth/google" className="secondary-button inline-flex items-center">
          {t('Continue with Google')}
        </a>
      )}
    </section>
  );
}
