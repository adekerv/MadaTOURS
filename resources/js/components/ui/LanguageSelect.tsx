import { useI18n } from '../../i18n/I18nProvider';
import { ThemeSelect } from './ThemeSelect';
export function LanguageSelect() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <ThemeSelect />
      <select
        aria-label={t('Language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value === 'fr' ? 'fr' : 'en')}
        className="min-h-11 max-w-28 rounded-xl border border-slate-200 bg-white px-2 text-base text-slate-800"
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="fr" lang="fr">
          Français
        </option>
      </select>
    </div>
  );
}
