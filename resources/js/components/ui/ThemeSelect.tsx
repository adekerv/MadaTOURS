import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n/I18nProvider';
export function ThemeSelect() {
  const { choice, setChoice } = useTheme();
  const { t } = useI18n();
  const Icon = choice === 'dark' ? Moon : choice === 'light' ? Sun : Monitor;
  return (
    <label className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700">
      <Icon size={18} aria-hidden="true" />
      <select
        aria-label={t('Appearance')}
        value={choice}
        onChange={(e) => setChoice(e.target.value as 'light' | 'dark' | 'system')}
        className="absolute inset-0 h-full min-w-11 cursor-pointer opacity-0"
      >
        <option value="system">{t('System theme')}</option>
        <option value="light">{t('Light theme')}</option>
        <option value="dark">{t('Dark theme')}</option>
      </select>
    </label>
  );
}
