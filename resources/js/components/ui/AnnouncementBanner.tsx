import { useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { localized, useSiteSettings } from '../../lib/site';

const tones = {
  info: 'bg-blue-50 text-blue-800',
  warning: 'bg-amber-50 text-amber-900',
  success: 'bg-green-50 text-green-800',
};

/** The announcement an administrator turned on in Site content. Visitors can close it for this visit. */
export function AnnouncementBanner() {
  const { t, language } = useI18n();
  const settings = useSiteSettings();
  const [closed, setClosed] = useState('');
  const announcement = settings?.announcement;
  const message = announcement ? localized(language, announcement.text, announcement.textFr) : null;
  if (!announcement?.enabled || !message || closed === message) return null;
  return (
    <div
      role="region"
      aria-label={t('Announcement')}
      className={`flex items-center gap-3 px-4 py-1 text-sm sm:px-6 ${tones[announcement.tone]}`}
    >
      <Megaphone size={18} aria-hidden className="shrink-0" />
      <p className="min-w-0 flex-1 py-2">
        {message}{' '}
        {announcement.link && (
          <a
            href={announcement.link}
            className="inline-flex min-h-11 items-center font-semibold underline"
            {...(announcement.link.startsWith('https://')
              ? { target: '_blank', rel: 'noreferrer' }
              : {})}
          >
            {t('Learn more')}
          </a>
        )}
      </p>
      <button
        onClick={() => setClosed(message)}
        aria-label={t('Close announcement')}
        className="icon-button shrink-0"
      >
        <X size={18} />
      </button>
    </div>
  );
}
