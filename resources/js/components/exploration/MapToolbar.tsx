import { useI18n } from '../../i18n/I18nProvider';
import { SlidersHorizontal } from 'lucide-react';
type Category = 'all' | 'restaurant' | 'activity';
const layers = [
  { type: 'restaurant', label: 'Food', color: '#ea580c' },
  { type: 'activity', label: 'Activities', color: '#0284c7' },
] as const;
/** Category layers drawn over the map, plus the filter sheet entry point on compact screens. */
export function MapToolbar({
  filter,
  onFilterChange,
  onOpenFilters,
  activeFilters,
}: {
  filter: Category;
  onFilterChange: (filter: Category) => void;
  onOpenFilters: () => void;
  activeFilters: number;
}) {
  const { t } = useI18n();
  const visible = (type: (typeof layers)[number]['type']) => filter === 'all' || filter === type;
  function toggle(type: (typeof layers)[number]['type']) {
    const next = layers.filter((layer) =>
      layer.type === type ? !visible(type) : visible(layer.type),
    );
    // At least one layer stays on, otherwise the map would be empty with no way to tell why.
    if (next.length) onFilterChange(next.length === layers.length ? 'all' : next[0].type);
  }
  return (
    <div role="group" aria-label={t('Map layers')} className="map-toolbar">
      {layers.map((layer) => {
        const on = visible(layer.type);
        const last = on && filter !== 'all';
        return (
          <button
            key={layer.type}
            type="button"
            aria-pressed={on}
            aria-disabled={last}
            onClick={() => toggle(layer.type)}
            className={`map-chip ${on ? 'map-chip-on' : ''}`}
          >
            <span className="map-chip-dot" style={{ background: layer.color }} />
            {t(layer.label)}
          </button>
        );
      })}
      <button type="button" onClick={onOpenFilters} className="map-chip map-chip-filters">
        <SlidersHorizontal size={15} aria-hidden="true" />
        {t('Filters')}
        {activeFilters > 0 && <span className="map-chip-badge">{activeFilters}</span>}
      </button>
    </div>
  );
}
