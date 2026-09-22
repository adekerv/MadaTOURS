import { useEffect, useState } from 'react';
import { withRequestSignal } from '../../lib/request';
import { CloudSun, RefreshCw } from 'lucide-react';
interface Weather {
  temp: number;
  humidity: number;
  code: number;
  time: string;
}
export function weatherDescription(code: number) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Conditions unavailable';
}
export function WeatherWidget() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    withRequestSignal(
      (signal) =>
        fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=14.6035&longitude=-61.0673&current=temperature_2m,relative_humidity_2m,weather_code&timezone=America%2FMartinique',
          { signal },
        ),
      controller.signal,
      8000,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('Weather unavailable');
        const data = await response.json();
        const current = data.current;
        if (
          !current ||
          !Number.isFinite(current.temperature_2m) ||
          !Number.isFinite(current.weather_code) ||
          !Number.isFinite(current.relative_humidity_2m) ||
          typeof current.time !== 'string'
        )
          throw new Error('Invalid weather');
        if (!controller.signal.aborted)
          setWeather({
            temp: Math.round(current.temperature_2m),
            code: current.weather_code,
            humidity: current.relative_humidity_2m,
            time: current.time,
          });
      })
      .catch(() => {
        if (!controller.signal.aborted) setWeather(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left">
      <CloudSun className="shrink-0 text-orange-600" size={26} />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-sm font-semibold text-slate-900">Fort-de-France weather</p>
        <p className="text-sm text-slate-600">
          {loading
            ? 'Checking conditions…'
            : weather
              ? `${weather.temp}°C · ${weatherDescription(weather.code)} · ${weather.humidity}% humidity`
              : 'Weather is unavailable right now.'}
        </p>
        {weather && !loading && (
          <p className="mt-1 text-xs text-slate-500">
            <a
              className="underline"
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open-Meteo
            </a>{' '}
            · {weather.time.slice(11, 16)} Martinique time
          </p>
        )}
      </div>
      <button
        aria-label="Refresh weather"
        disabled={loading}
        onClick={() => setRevision((value) => value + 1)}
        className="icon-button shrink-0"
      >
        <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
