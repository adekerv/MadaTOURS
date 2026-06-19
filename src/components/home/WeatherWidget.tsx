import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sun, Cloud, CloudRain, CloudLightning, Thermometer, Droplets, Compass } from 'lucide-react';

interface WeatherData {
  temp: number;
  condition: string;
  emoji: string;
  advice: string;
  code: number;
  humidity?: number;
}

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fort-de-France, Martinique: Latitude: 14.6035, Longitude: -61.0673
  const fetchWeather = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=14.6035&longitude=-61.0673&current=temperature_2m,relative_humidity_2m,weather_code'
      );
      if (!res.ok) throw new Error('Failed to fetch raw weather');
      
      const data = await res.json();
      const current = data.current;
      const temp = Math.round(current.temperature_2m);
      const code = current.weather_code;
      const humidity = current.relative_humidity_2m;
      
      // Map WMO codes
      let condition = 'Partly Cloudy';
      let emoji = '⛅';
      let advice = 'Great weather for visiting a beach or a distillery!';
      
      if (code === 0) {
        condition = 'Sunny';
        emoji = '☀️';
        advice = 'Perfect day for checking out a white-sand beach or hiking Pelée volcano!';
      } else if (code >= 1 && code <= 3) {
        condition = 'Partly Cloudy';
        emoji = '⛅';
        advice = 'Balmy and beautiful! Excellent day for go-karting at Acro\'Kart or exploring.';
      } else if (code >= 45 && code <= 48) {
        condition = 'Mist / Fog';
        emoji = '🌫️';
        advice = 'Atmospheric vibes. Try exploring a lush green forest path or indoor cafe.';
      } else if (code >= 51 && code <= 55) {
        condition = 'Drizzle';
        emoji = '🌦️';
        advice = 'Mild passing drizzle. Ideal slot for a classy lunch at Tori Sushi!';
      } else if (code >= 61 && code <= 65) {
        condition = 'Tropical Rain';
        emoji = '🌧️';
        advice = 'Showers outside. Perfect time to enjoy delicious warm creole dining!';
      } else if (code >= 80 && code <= 82) {
        condition = 'Showers';
        emoji = '🌦️';
        advice = 'Short passing shower. A wonderful excuse to try bowling or laser tag!';
      } else if (code >= 95) {
        condition = 'Thunderstorm';
        emoji = '⛈️';
        advice = 'Tropical thunderstorm active. Cosy up inside in classy local spots!';
      }
      
      setWeather({
        temp,
        condition,
        emoji,
        advice,
        code,
        humidity
      });
    } catch (err) {
      console.warn('Weather API failed, fallback to average tropical climate:', err);
      // Fallback representing pleasant general Martinique standard weather
      setWeather({
        temp: 29,
        condition: 'Tropical Sunshine',
        emoji: '🌴',
        advice: 'Beautiful warm sun. Optimal for outdoor adventures and go-kart racing!',
        code: 1,
        humidity: 78
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="w-5 h-5 text-amber-500 animate-[pulse_3s_infinite]" />;
    if (code >= 1 && code <= 3) return <Cloud className="w-5 h-5 text-slate-400" />;
    if (code >= 45 && code <= 82) return <CloudRain className="w-5 h-5 text-sky-400" />;
    if (code >= 95) return <CloudLightning className="w-5 h-5 text-purple-400 animate-bounce" />;
    return <Sun className="w-5 h-5 text-amber-500" />;
  };

  return (
    <div className="flex justify-center items-center mb-10 w-full px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="relative bg-white/70 backdrop-blur-md rounded-[2.5rem] border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.03)] px-6 py-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 max-w-xl w-full text-left"
      >
        {loading ? (
          <div className="flex items-center gap-3 py-2 w-full justify-center">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Gathering Tropical Forecast...</span>
          </div>
        ) : (
          weather && (
            <>
              {/* Left Temperature capsule */}
              <div className="flex items-center gap-3.5 bg-orange-500/10 rounded-3xl py-2.5 px-4 py-2 border border-orange-500/20 max-sm:w-full max-sm:justify-center">
                <div className="p-1 px-1.5 flex items-center justify-center bg-orange-500 text-white rounded-xl shadow-md">
                  <Thermometer className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-800 leading-none">
                    {weather.temp}°C
                  </div>
                  <div className="text-[10px] font-black uppercase text-orange-600 tracking-wider mt-0.5 leading-none flex items-center gap-1">
                    <span>{weather.emoji}</span>
                    <span>{weather.condition}</span>
                  </div>
                </div>
              </div>

              {/* Right Recommendation / Detail section */}
              <div className="flex-1 min-w-0 max-sm:text-center">
                <p className="text-xs font-black text-slate-800 leading-snug">
                  ⛅ Martinique Live Weather
                </p>
                <p className="text-[11px] text-slate-500 mt-1 font-semibold leading-relaxed line-clamp-2">
                  {weather.advice} 
                  {weather.humidity ? ` (Humidity: ${weather.humidity}%)` : ''}
                </p>
              </div>

              {/* Minimalist interactive refresh action */}
              <button 
                onClick={fetchWeather}
                title="Refresh Weather Info"
                className="p-2 rounded-full hover:bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 transition-all text-xs"
              >
                <Compass className="w-3.5 h-3.5" />
              </button>
            </>
          )
        )}
      </motion.div>
    </div>
  );
};
