import { useState } from 'react';
import { Compass, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
export function OnboardingHint({ onPlan }: { onPlan: () => void }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('madatours:onboarding:v1') !== 'dismissed';
    } catch {
      return true;
    }
  });
  if (!visible) return null;
  return (
    <aside
      aria-label={t('Welcome to your island guide')}
      className="mt-5 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4"
    >
      <Compass className="mt-2 text-orange-700" size={22} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t('Your island guide, no account needed')}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t(
            'Explore beaches, food and hidden corners. Open Plan a day to arrange your stops and keep a trip on this device.',
          )}
        </p>
        <button className="mt-1 text-sm font-semibold text-orange-800 underline" onClick={onPlan}>
          {t('Plan my first day')}
        </button>
      </div>
      <button
        className="icon-button shrink-0"
        aria-label={t('Dismiss introduction')}
        onClick={() => {
          setVisible(false);
          try {
            localStorage.setItem('madatours:onboarding:v1', 'dismissed');
          } catch {
            /* Session dismissal still works. */
          }
        }}
      >
        <X size={18} />
      </button>
    </aside>
  );
}
