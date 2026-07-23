import type { WeatherData } from '@/types';

// Open-Meteo: free, no API key needed
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1';
const GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1';

const WMO_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export async function geocode(location: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const res = await fetch(
      `${GEOCODE_BASE}/search?name=${encodeURIComponent(location)}&count=1&language=en`
    );
    const data = await res.json();
    if (data.results?.[0]) {
      const r = data.results[0];
      return { lat: r.latitude, lon: r.longitude, name: r.name };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getWeather(lat: number, lon: number): Promise<WeatherData> {
  const res = await fetch(
    `${OPEN_METEO_BASE}/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
    `&daily=precipitation_probability_max&timezone=auto&forecast_days=1`
  );
  const data = await res.json();
  const current = data.current;
  const daily = data.daily;

  const condition = WMO_CODES[current.weather_code] || 'Unknown';
  const precipProb = daily?.precipitation_probability_max?.[0] ?? 0;

  let recommendation = '';
  const temp = current.temperature_2m;
  if (temp >= 30) recommendation = 'Light, breathable clothing. Stay cool.';
  else if (temp >= 20) recommendation = 'Comfortable weather. Light layers work.';
  else if (temp >= 12) recommendation = 'Mild. Bring a light jacket.';
  else if (temp >= 5) recommendation = 'Cool. Warm layers recommended.';
  else recommendation = 'Cold. Heavy outerwear needed.';

  if (precipProb > 50) recommendation += ' Rain likely — water-resistant options.';

  return {
    temperature: Math.round(current.temperature_2m),
    feels_like: Math.round(current.apparent_temperature),
    condition,
    humidity: current.relative_humidity_2m,
    wind_speed: Math.round(current.wind_speed_10m),
    precipitation_probability: precipProb,
    is_day: current.is_day === 1,
    summary: `${condition}, ${Math.round(current.temperature_2m)}°C (feels ${Math.round(current.apparent_temperature)}°C)`,
    recommendation,
  };
}

export async function getWeatherForLocation(location: string): Promise<WeatherData | null> {
  const geo = await geocode(location);
  if (!geo) return null;
  return getWeather(geo.lat, geo.lon);
}
