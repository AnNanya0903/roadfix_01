import { MODE } from './mode';

export interface WeatherSnapshot {
  source: 'demo' | 'open-meteo';
  tempC: number | null;
  condition: string;
  rainNext24hMm: number;
  rainLast72hMm: number;
}

export const DEMO_WEATHER: WeatherSnapshot = { source: 'demo', tempC: 27, condition: 'Overcast, rain expected', rainNext24hMm: 42, rainLast72hMm: 18 };

/** Demo mode returns a fixed, labelled sample. Live mode uses Open-Meteo (no API key needed) and returns null on failure. */
export async function getWeather(lat: number, lng: number): Promise<WeatherSnapshot | null> {
  if (MODE === 'demo') return DEMO_WEATHER;
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=precipitation&past_days=3&forecast_days=2&timezone=auto`);
    if (!res.ok) return null;
    const d = (await res.json()) as { current?: { temperature_2m?: number; time?: string; weather_code?: number }; hourly?: { time: string[]; precipitation: number[] } };
    if (!d.hourly) return null;
    const nowIso = d.current?.time ?? new Date().toISOString();
    let last72 = 0;
    let next24 = 0;
    d.hourly.time.forEach((t, i) => {
      const mm = d.hourly!.precipitation[i] ?? 0;
      const diffH = (new Date(t).getTime() - new Date(nowIso).getTime()) / 3600000;
      if (diffH <= 0 && diffH > -72) last72 += mm;
      if (diffH > 0 && diffH <= 24) next24 += mm;
    });
    const code = d.current?.weather_code ?? 0;
    const condition = code >= 95 ? 'Thunderstorms' : code >= 61 ? 'Rain' : code >= 51 ? 'Drizzle' : code >= 45 ? 'Fog' : code >= 2 ? 'Cloudy' : 'Clear';
    return { source: 'open-meteo', tempC: d.current?.temperature_2m ?? null, condition, rainNext24hMm: Math.round(next24 * 10) / 10, rainLast72hMm: Math.round(last72 * 10) / 10 };
  } catch {
    return null;
  }
}
