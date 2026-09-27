import { useI18n } from '../../i18n/I18nProvider';
import { Trash2, ArrowUpRight } from 'lucide-react';
import type { Place } from '../../types';
import { getPlaceTheme } from '../../utils/emoji';
export function SavedPlaceCard({
  place,
  onRemove,
  onLocate,
}: {
  place: Place;
  onRemove: (place: Place) => void;
  onLocate: () => void;
}) {
  const { t, language } = useI18n();
  const theme = getPlaceTheme(place);
  return (
    <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex justify-between gap-3">
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-2xl text-2xl"
          style={{ backgroundColor: theme.bgColor }}
        >
          {theme.emoji}
        </span>
        <button
          aria-label={t('Remove {name}', { name: place.name })}
          onClick={() => onRemove(place)}
          className="icon-button text-slate-500 hover:text-red-700"
        >
          <Trash2 size={19} />
        </button>
      </div>
      <p className="text-xs font-semibold text-orange-700">{place.location}</p>
      <h3 className="mt-1 text-xl font-bold">{place.name}</h3>
      <p className="my-3 text-sm leading-relaxed text-slate-600 line-clamp-2">
        {language === 'fr' && place.descriptionFr ? place.descriptionFr : place.description}
      </p>
      <button
        onClick={onLocate}
        className="secondary-button mt-auto flex justify-center items-center gap-2"
      >
        {t('View on map')}
        <ArrowUpRight size={17} />
      </button>
    </article>
  );
}
