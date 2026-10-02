import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useI18n } from '../../i18n/I18nProvider';
import { useTheme } from '../../hooks/useTheme';
type Point = { lat: number; lng: number };
const icon = L.divIcon({
  html: '<span class="search-center-marker"></span>',
  className: '',
  iconSize: [44, 44],
  iconAnchor: [12, 12],
});
function Picker({ point, onChange }: { point: Point | null; onChange: (point: Point) => void }) {
  const map = useMap();
  const valid =
    point && point.lat >= 14.35 && point.lat <= 14.95 && point.lng >= -61.3 && point.lng <= -60.75;
  useMapEvents({
    click: (e) =>
      onChange({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) }),
  });
  useEffect(() => {
    if (valid) map.panTo(point, { animate: false });
  }, [map, point, valid]);
  return valid ? (
    <Marker icon={icon} position={point} interactive={false} keyboard={false} />
  ) : null;
}
export function CoordinatePicker({
  point,
  onChange,
}: {
  point: Point | null;
  onChange: (point: Point) => void;
}) {
  const { t } = useI18n();
  const { dark } = useTheme();
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        {t('Tap the exact entrance on the map, or enter its coordinates below.')}
      </p>
      <div
        className="h-64 overflow-hidden rounded-2xl border border-slate-200"
        aria-label={t('Choose exact coordinates')}
      >
        <MapContainer
          center={[14.6415, -61.0242]}
          zoom={10}
          scrollWheelZoom={false}
          className="h-full"
        >
          <TileLayer
            key={dark ? 'dark' : 'light'}
            className={dark ? 'map-tiles-dark' : ''}
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Picker point={point} onChange={onChange} />
        </MapContainer>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">
          {t('Latitude')}
          <input
            className="field-input"
            type="number"
            step="0.000001"
            required
            min="14.35"
            max="14.95"
            value={point?.lat ?? ''}
            onChange={(e) => onChange({ lat: Number(e.target.value), lng: point?.lng ?? -61.0242 })}
          />
        </label>
        <label className="field-label">
          {t('Longitude')}
          <input
            className="field-input"
            type="number"
            step="0.000001"
            required
            min="-61.3"
            max="-60.75"
            value={point?.lng ?? ''}
            onChange={(e) => onChange({ lng: Number(e.target.value), lat: point?.lat ?? 14.6415 })}
          />
        </label>
      </div>
    </div>
  );
}
