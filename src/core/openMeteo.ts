// Client per le API Open-Meteo (gratuite, senza API key).
// - Geocoding:  https://open-meteo.com/en/docs/geocoding-api
// - Forecast:   https://open-meteo.com/en/docs  (con uv_index)
//
// Usa `fetch`, disponibile nativamente in browser, React Native e Node 18+.
// Nessuna dipendenza esterna: modulo core portabile.

import type { GeoLocation, Forecast, HourlyPoint, DailyPoint } from "./types";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Numero massimo di giorni di previsione esposti dall'app. */
export const MAX_FORECAST_DAYS = 7;

export class OpenMeteoError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "OpenMeteoError";
  }
}

interface RawGeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
  country_code: string;
  admin1?: string;
  population?: number;
}

/**
 * Cerca località per nome. Restituisce una lista da mostrare all'utente
 * affinché scelga quella corretta (es. i diversi "Rimini" nel mondo).
 */
export async function searchLocations(
  query: string,
  options: { count?: number; language?: string; signal?: AbortSignal } = {},
): Promise<GeoLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    name: trimmed,
    count: String(options.count ?? 5),
    language: options.language ?? "it",
    format: "json",
  });

  let payload: { results?: RawGeoResult[] };
  try {
    const res = await fetch(`${GEOCODING_URL}?${params}`, { signal: options.signal });
    if (!res.ok) throw new OpenMeteoError(`Geocoding HTTP ${res.status}`);
    payload = await res.json();
  } catch (err) {
    if (err instanceof OpenMeteoError) throw err;
    throw new OpenMeteoError("Errore di rete durante il geocoding", err);
  }

  return (payload.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
    country: r.country,
    countryCode: r.country_code,
    admin1: r.admin1,
    population: r.population,
  }));
}

interface RawForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: {
    time: string[];
    uv_index: number[];
    cloud_cover: number[];
    temperature_2m: number[];
  };
  daily: {
    time: string[];
    uv_index_max: number[];
    sunrise: string[];
    sunset: string[];
  };
}

/**
 * Scarica le previsioni UV/meteo per una coppia di coordinate.
 * Il fuso orario viene risolto automaticamente dall'API in base alla posizione,
 * così gli orari restituiti sono già locali al luogo scelto.
 */
export async function getForecast(
  latitude: number,
  longitude: number,
  options: { forecastDays?: number; signal?: AbortSignal } = {},
): Promise<Forecast> {
  const days = Math.min(options.forecastDays ?? MAX_FORECAST_DAYS, MAX_FORECAST_DAYS);

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: "uv_index,cloud_cover,temperature_2m",
    daily: "uv_index_max,sunrise,sunset",
    timezone: "auto",
    forecast_days: String(days),
  });

  let raw: RawForecast;
  try {
    const res = await fetch(`${FORECAST_URL}?${params}`, { signal: options.signal });
    if (!res.ok) throw new OpenMeteoError(`Forecast HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    if (err instanceof OpenMeteoError) throw err;
    throw new OpenMeteoError("Errore di rete durante il forecast", err);
  }

  // Gli array orari/giornalieri di Open-Meteo sono paralleli e di pari lunghezza,
  // quindi l'accesso per indice è sempre valorizzato (non-null assertion).
  const hourly: HourlyPoint[] = raw.hourly.time.map((time, i) => ({
    time,
    uvIndex: raw.hourly.uv_index[i]!,
    cloudCover: raw.hourly.cloud_cover[i]!,
    temperature: raw.hourly.temperature_2m[i]!,
  }));

  const daily: DailyPoint[] = raw.daily.time.map((date, i) => ({
    date,
    uvIndexMax: raw.daily.uv_index_max[i]!,
    sunrise: raw.daily.sunrise[i]!,
    sunset: raw.daily.sunset[i]!,
  }));

  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    timezone: raw.timezone,
    hourly,
    daily,
  };
}
