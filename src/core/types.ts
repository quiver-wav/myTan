// Modelli dati del dominio "myTan".
// Questo file è puro TypeScript, senza dipendenze dall'interfaccia:
// si trasferisce identico in una PWA o in React Native.

/** Una località selezionabile dall'utente (risultato del geocoding). */
export interface GeoLocation {
  /** id Open-Meteo, utile come chiave stabile per le località salvate */
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  /** fuso orario IANA, es. "Europe/Rome" */
  timezone: string;
  country: string;
  countryCode: string;
  /** regione/stato (es. "Emilia-Romagna"), per disambiguare omonimi */
  admin1?: string;
  /** popolazione, usata solo per ordinare i risultati più rilevanti in cima */
  population?: number;
}

/** Dati meteo/UV di una singola ora. */
export interface HourlyPoint {
  /** orario locale ISO 8601, es. "2026-06-30T13:00" */
  time: string;
  /** indice UV già corretto dall'API per la copertura nuvolosa prevista */
  uvIndex: number;
  /** copertura nuvolosa prevista, 0-100 % */
  cloudCover: number;
  /** temperatura dell'aria a 2 m, in °C */
  temperature: number;
}

/** Sintesi meteo/UV di una singola giornata. */
export interface DailyPoint {
  /** data locale ISO, es. "2026-06-30" */
  date: string;
  /** picco UV della giornata */
  uvIndexMax: number;
  /** orario locale ISO di alba e tramonto: delimitano la finestra utile */
  sunrise: string;
  sunset: string;
}

/** Previsioni complete per una località, su più giorni. */
export interface Forecast {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
}
