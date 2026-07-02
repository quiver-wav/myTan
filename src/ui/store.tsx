// Stato globale dell'app, persistito in localStorage.
// Il "core" resta puro: qui c'è solo lo stato della UI.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
  PhototypeResult,
  GeoLocation,
  TanningGoalId,
  LoggedSession,
} from "../core/index";

/** Sessione di esposizione in corso (timer live). */
export interface ActiveSession {
  /** data locale della località, "YYYY-MM-DD" */
  date: string;
  /** ora di inizio locale della località, "HH:MM" */
  startTime: string;
  /** epoch ms del dispositivo all'avvio (per il cronometro) */
  startedAt: number;
  withSunscreen: boolean;
  /** epoch ms dell'inizio della pausa corrente ("bagno"), null se non in pausa */
  pausedAt?: number | null;
  /** minuti totali già trascorsi in pausa (esclusa la pausa corrente) */
  pausedMin?: number;
}

export interface AppData {
  phototype: PhototypeResult | null;
  /** l'utente ha visto e confermato il risultato del questionario */
  phototypeConfirmed: boolean;
  location: GeoLocation | null;
  /** località usate di recente, la più recente per prima (max 5) */
  savedLocations: GeoLocation[];
  goalId: TanningGoalId | null;
  useSunscreen: boolean;
  sessionsPerWeek: number;
  history: LoggedSession[];
  activeSession: ActiveSession | null;
}

const DEFAULT_DATA: AppData = {
  phototype: null,
  phototypeConfirmed: false,
  location: null,
  savedLocations: [],
  goalId: null,
  useSunscreen: false,
  sessionsPerWeek: 4,
  history: [],
  activeSession: null,
};

const STORAGE_KEY = "mytan:data:v1";

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch {
    /* ignora dati corrotti */
  }
  return DEFAULT_DATA;
}

interface Store {
  data: AppData;
  update: (patch: Partial<AppData>) => void;
  logSession: (session: LoggedSession) => void;
  removeSession: (date: string) => void;
  reset: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const update = (patch: Partial<AppData>) => setData((d) => ({ ...d, ...patch }));

  const logSession = (session: LoggedSession) =>
    setData((d) => ({
      ...d,
      // una sola sessione per data: l'ultima registrata sostituisce la precedente
      history: [...d.history.filter((s) => s.date !== session.date), session],
    }));

  const removeSession = (date: string) =>
    setData((d) => ({ ...d, history: d.history.filter((s) => s.date !== date) }));

  const reset = () => setData(DEFAULT_DATA);

  return (
    <StoreContext.Provider value={{ data, update, logSession, removeSession, reset }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve stare dentro <StoreProvider>");
  return ctx;
}
