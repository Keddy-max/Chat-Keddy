import React, { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudSun, Map as MapIcon, Wind, Droplets, Activity, Bitcoin, Clock, Newspaper, DollarSign, Quote, Sparkles } from 'lucide-react';
import TrafficMap from './TrafficMap';

const GHANAIAN_PROVERBS = [
  { twi: "Obi nkyerɛ abofra Nyame.", english: "No one teaches a child about God." },
  { twi: "Abofra a ɔbɛyɛ yie no, ofi ne mmofraase.", english: "A child who will be successful shows it from childhood." },
  { twi: "Ti koro nko agyina.", english: "One head does not go into council." },
  { twi: "Anomaa a ogyina hɔ kyɛ na ɔnya aboa bi we.", english: "The bird that stands for a long time gets a worm to eat." },
  { twi: "Nsateaa nyinaa nnyɛ pɛ.", english: "All fingers are not equal." },
  { twi: "Okuafoɔ a ɔyɛ hu no, ne mmoa na wɔpia wo.", english: "When you climb a good tree, you are given a push." },
  { twi: "Prayɛ, sɛ woyɛ no baako a, ebu mmerɛw; nanso sɛ woka bom a, ɛnyɛ mmerɛw sɛ wobɛbu.", english: "A broomstick is easily broken, but a bunch is not." },
];

function getWeatherIcon(code: number) {
  if (code === 0) return <Sun className="text-yellow-400" size={36} />;
  if (code >= 1 && code <= 3) return <CloudSun className="text-zinc-300" size={36} />;
  if (code === 45 || code === 48) return <CloudFog className="text-zinc-400" size={36} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain className="text-red-500" size={36} />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <CloudSnow className="text-white" size={36} />;
  if (code >= 95 && code <= 99) return <CloudLightning className="text-purple-400" size={36} />;
  return <Cloud className="text-zinc-400" size={36} />;
}

function getWeatherDescription(code: number) {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

const GHANA_CITIES = {
  'Accra': { lat: 5.6037, lng: -0.1870 },
  'Kumasi': { lat: 6.6885, lng: -1.6244 },
  'Tamale': { lat: 9.4008, lng: -0.8393 },
  'Takoradi': { lat: 4.9016, lng: -1.7831 },
  'Cape Coast': { lat: 5.1155, lng: -1.2466 }
};

export default function LiveDashboard() {
  const [selectedCity, setSelectedCity] = useState<keyof typeof GHANA_CITIES>('Accra');
  const [location, setLocation] = useState<{lat: number, lng: number}>(GHANA_CITIES['Accra']);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [crypto, setCrypto] = useState<any>(null);
  const [rates, setRates] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [time, setTime] = useState(new Date());
  const [proverb] = useState(() => GHANAIAN_PROVERBS[Math.floor(Math.random() * GHANAIAN_PROVERBS.length)]);

  useEffect(() => {
    // Clock
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // Crypto
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd')
      .then(r => r.json())
      .then(setCrypto)
      .catch(console.error);

    // Currency Rates (GHS)
    fetch('https://api.exchangerate-api.com/v4/latest/GHS')
      .then(r => r.json())
      .then(data => {
        if (data && data.rates) {
          setRates({
            USD: (1 / data.rates.USD).toFixed(2),
            GBP: (1 / data.rates.GBP).toFixed(2),
            EUR: (1 / data.rates.EUR).toFixed(2)
          });
        }
      })
      .catch(console.error);

    // News (Ghana News)
    fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.myjoyonline.com/feed/')
      .then(r => r.json())
      .then(data => {
        if (data && data.items) {
          setNews(data.items.slice(0, 4).map((item: any) => ({
            title: item.title,
            url: item.link,
            score: 'News',
            by: 'JoyNews'
          })));
        }
      })
      .catch(console.error);

    // Weather & Location (Default to Accra, Ghana)
    const ACCRA_LAT = 5.6037;
    const ACCRA_LNG = -0.1870;
    
    const fetchWeather = async (lat: number, lng: number) => {
      setLoading(true);
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
        const data = await res.json();
        setWeather(data);
      } catch (err) {
        setError('Failed to load weather data');
      } finally {
        setLoading(false);
      }
    };

    setLocation(GHANA_CITIES[selectedCity]);
    fetchWeather(GHANA_CITIES[selectedCity].lat, GHANA_CITIES[selectedCity].lng);
    
    return () => clearInterval(timer);
  }, [selectedCity]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-900">
      <div className="p-4 border-b border-zinc-900 bg-zinc-900/30 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Activity size={16} className="text-green-600" />
          Live Trackers
        </h2>
        <select 
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value as keyof typeof GHANA_CITIES)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1 outline-none focus:border-green-600/50"
        >
          {Object.keys(GHANA_CITIES).map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Proverb Widget */}
        <div className="bg-green-900/20 border border-green-900/30 rounded-2xl p-4 relative overflow-hidden group">
          <div className="absolute -right-2 -top-2 opacity-10 group-hover:rotate-12 transition-transform">
            <Quote size={60} className="text-green-500" />
          </div>
          <h3 className="text-[10px] font-mono text-green-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Sparkles size={10} /> Ghanaian Wisdom
          </h3>
          <div className="relative z-10">
            <p className="text-sm font-serif italic text-zinc-100 mb-1 leading-relaxed">"{proverb.twi}"</p>
            <p className="text-[11px] text-zinc-500">— {proverb.english}</p>
          </div>
        </div>

        {/* Clock Widget */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="text-red-500" size={20} />
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Local Time</div>
              <div className="text-lg font-light text-zinc-100">{time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase">Date</div>
            <div className="text-sm text-zinc-300">{time.toLocaleDateString()}</div>
          </div>
        </div>

        {/* Crypto Widget */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bitcoin size={14} /> Markets
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {['bitcoin', 'ethereum', 'solana'].map(coin => (
              <div key={coin} className="bg-zinc-950/50 rounded-lg p-2 border border-zinc-800/50 text-center">
                <div className="text-[10px] text-zinc-500 uppercase">{coin === 'bitcoin' ? 'BTC' : coin === 'ethereum' ? 'ETH' : 'SOL'}</div>
                <div className="text-xs font-medium text-zinc-200">
                  {crypto ? `$${crypto[coin]?.usd.toLocaleString()}` : '...'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Currency Widget */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <DollarSign size={14} className="text-green-500" /> GHS Exchange Rates
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {['USD', 'GBP', 'EUR'].map(curr => (
              <div key={curr} className="bg-zinc-950/50 rounded-lg p-2 border border-zinc-800/50 text-center">
                <div className="text-[10px] text-zinc-500 uppercase">1 {curr}</div>
                <div className="text-xs font-medium text-zinc-200">
                  {rates ? `GH₵${rates[curr]}` : '...'}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[9px] text-zinc-600 text-center italic">Rates are approximate</div>
        </div>

        {/* Weather Widget */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">Local Weather</h3>
          {loading ? (
            <div className="animate-pulse flex space-x-4"><div className="rounded-full bg-zinc-800 h-10 w-10"></div><div className="flex-1 space-y-2 py-1"><div className="h-4 bg-zinc-800 rounded w-3/4"></div></div></div>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : weather ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getWeatherIcon(weather.current.weather_code)}
                  <div>
                    <div className="text-3xl font-light text-zinc-100">{Math.round(weather.current.temperature_2m)}°</div>
                    <div className="text-sm text-zinc-400">{getWeatherDescription(weather.current.weather_code)}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-950/50 rounded-lg p-2 flex items-center gap-2 border border-zinc-800/50">
                  <Wind size={14} className="text-red-500" />
                  <div><div className="text-[10px] text-zinc-500 uppercase">Wind</div><div className="text-xs font-medium text-zinc-300">{weather.current.wind_speed_10m} km/h</div></div>
                </div>
                <div className="bg-zinc-950/50 rounded-lg p-2 flex items-center gap-2 border border-zinc-800/50">
                  <Droplets size={14} className="text-red-500" />
                  <div><div className="text-[10px] text-zinc-500 uppercase">Humidity</div><div className="text-xs font-medium text-zinc-300">{weather.current.relative_humidity_2m}%</div></div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* News Widget */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Newspaper size={14} /> Ghana Top News
          </h3>
          <div className="space-y-3">
            {news.length > 0 ? news.map((item, i) => (
              <a key={i} href={item?.url} target="_blank" rel="noreferrer" className="block group">
                <div className="text-xs text-zinc-300 group-hover:text-yellow-500 transition-colors line-clamp-2 leading-snug">
                  {item?.title}
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">{item?.score} pts • {item?.by}</div>
              </a>
            )) : (
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-zinc-800 rounded w-full"></div>
                <div className="h-3 bg-zinc-800 rounded w-5/6"></div>
              </div>
            )}
          </div>
        </div>

        {/* Traffic Widget */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex flex-col h-[250px]">
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <MapIcon size={14} /> Live Traffic
          </h3>
          <div className="flex-1 relative rounded-xl overflow-hidden border border-zinc-800">
            {location ? <TrafficMap center={location} /> : <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-xs text-zinc-500 text-center p-4">Location required</div>}
          </div>
        </div>

      </div>
    </div>
  );
}
