// Motore di abbronzatura: fototipo + dati UV → piano di esposizione sicuro.
//
// Modello scientifico (valori da letteratura, parametri centralizzati e
// ritoccabili):
//   - L'indice UV (UVI) è proporzionale all'irradianza eritemale:
//       E_er [W/m²] = UVI × 0.025
//   - Ogni fototipo ha una Dose Minima Eritemale (MED, in J/m²): la dose oltre
//     la quale compare la scottatura. La MED è una proprietà della PELLE,
//     diversa per ogni fototipo.
//   - Ogni sessione punta a una FRAZIONE FISSA della MED del fototipo
//     (parametro di sicurezza/"cautela"), quindi resta sempre sotto la soglia.
//     Questa frazione NON dipende dall'obiettivo: ogni fototipo si spinge fino
//     all'80% della PROPRIA soglia. L'obiettivo (quanto scuro) determina solo
//     QUANTE sessioni servono — vedi tanProgress.ts.
//   - Vincolo NON negoziabile: nessuna sessione supera la MED.
//
// Protezione solare (modello idealizzato + sotto-applicazione reale): vedi
// `effectiveSpf`.

import type { Forecast } from "./types";
import type { Phototype } from "./phototype";

/** Dose Minima Eritemale per fototipo, in J/m² (≈ valori di letteratura). */
export const MED_BY_PHOTOTYPE: Record<Phototype, number> = {
  1: 200,
  2: 250,
  3: 350,
  4: 450,
  5: 600,
  6: 1000,
};

/** Irradianza eritemale (W/m²) per unità di indice UV. */
export const UVI_ERYTHEMAL_W_PER_M2 = 0.025;

/**
 * Frazione della soglia di scottatura (MED) puntata da OGNI sessione.
 * È un parametro di sicurezza proprio della pelle, NON dell'obiettivo: ogni
 * fototipo si spinge fino a questa frazione della PROPRIA soglia. Default 0.80
 * (massimo concordato). Sessioni più caute (es. 0.5) restano possibili tramite
 * `PlanOptions.sessionFraction`.
 */
export const DEFAULT_SESSION_FRACTION = 0.8;

/** Dose eritemale accumulata in 1 minuto a un dato UVI, in J/m². */
function doseRatePerMinute(uvIndex: number): number {
  return Math.max(0, uvIndex) * UVI_ERYTHEMAL_W_PER_M2 * 60;
}

export type TanningGoalId =
  | "protezione"
  | "dorato"
  | "ambrato"
  | "scuro"
  | "mantenimento";

export interface TanningGoal {
  id: TanningGoalId;
  label: string;
  description: string;
  /** fototipo minimo per cui l'obiettivo è realisticamente raggiungibile. */
  minPhototype: Phototype;
  /** true = solo protezione, nessuna esposizione mirata. */
  protectionOnly?: boolean;
}

export const TANNING_GOALS: TanningGoal[] = [
  {
    id: "protezione",
    label: "Protezione & luminosità",
    description: "Nessuno scurimento: solo salute e protezione della pelle.",
    minPhototype: 1,
    protectionOnly: true,
  },
  {
    id: "dorato",
    label: "Dorato leggero",
    description: "Un velo dorato naturale, graduale.",
    minPhototype: 2,
  },
  {
    id: "ambrato",
    label: "Ambrato / bronzo",
    description: "Abbronzatura media classica.",
    minPhototype: 3,
  },
  {
    id: "scuro",
    label: "Scuro intenso",
    description: "Tono profondo, il massimo raggiungibile in sicurezza.",
    minPhototype: 4,
  },
  {
    id: "mantenimento",
    label: "Mantenimento",
    description: "Conserva l'abbronzatura già presa.",
    minPhototype: 2,
  },
];

export function getGoal(id: TanningGoalId): TanningGoal {
  return TANNING_GOALS.find((g) => g.id === id)!;
}

/** Indica se un obiettivo è raggiungibile per un dato fototipo. */
export function isGoalReachable(goalId: TanningGoalId, phototype: Phototype): boolean {
  return phototype >= getGoal(goalId).minPhototype;
}

export interface GoalAvailability {
  goal: TanningGoal;
  reachable: boolean;
}

/** Lista degli obiettivi con flag di raggiungibilità: utile alla UI per disabilitare quelli non adatti. */
export function goalsForPhototype(phototype: Phototype): GoalAvailability[] {
  return TANNING_GOALS.map((goal) => ({
    goal,
    reachable: phototype >= goal.minPhototype,
  }));
}

/** SPF consigliato in base al fototipo, innalzato quando l'UV della giornata è molto alto. */
export function recommendedSpf(phototype: Phototype, dailyUvMax: number): number {
  const base: Record<Phototype, number> = { 1: 50, 2: 50, 3: 30, 4: 30, 5: 20, 6: 15 };
  let spf = base[phototype];
  if (dailyUvMax >= 8 && spf < 50) spf = spf === 30 ? 50 : 30; // UV molto alto → un gradino in più
  return spf;
}

/**
 * Protezione "effettiva" usata nel calcolo dei tempi. Nella pratica si applica
 * molto meno prodotto del test di laboratorio, quindi l'SPF reale è molto più
 * basso di quello nominale: l'approssimazione ≈ √SPF è quella usata in
 * letteratura per la sotto-applicazione (es. SPF 50 → ~7). Il flacone
 * consigliato resta quello nominale, ma i tempi si basano su questo valore.
 */
export function effectiveSpf(nominalSpf: number): number {
  return Math.round(Math.sqrt(nominalSpf) * 10) / 10;
}

// --- Conversioni orarie -----------------------------------------------------

function minuteOfDay(isoTime: string): number {
  const hh = Number(isoTime.slice(11, 13));
  const mm = Number(isoTime.slice(14, 16));
  return hh * 60 + mm;
}

function minutesToHHMM(minute: number): string {
  const hh = Math.floor(minute / 60);
  const mm = Math.round(minute % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// --- Profilo UV giornaliero -------------------------------------------------

interface DayUvProfile {
  date: string;
  sunriseMin: number;
  sunsetMin: number;
  uvMax: number;
  /** campioni orari {minuto del giorno, UVI}, ordinati. */
  samples: { minute: number; uv: number }[];
}

function buildDayProfiles(forecast: Forecast): DayUvProfile[] {
  return forecast.daily.map((day) => {
    const samples = forecast.hourly
      .filter((h) => h.time.startsWith(day.date))
      .map((h) => ({ minute: minuteOfDay(h.time), uv: h.uvIndex }))
      .sort((a, b) => a.minute - b.minute);
    return {
      date: day.date,
      sunriseMin: minuteOfDay(day.sunrise),
      sunsetMin: minuteOfDay(day.sunset),
      uvMax: day.uvIndexMax,
      samples,
    };
  });
}

/** UVI interpolato linearmente al minuto richiesto (0 fuori dai campioni). */
function uvAtMinute(profile: DayUvProfile, minute: number): number {
  const s = profile.samples;
  if (s.length === 0) return 0;
  if (minute <= s[0]!.minute) return s[0]!.uv;
  if (minute >= s[s.length - 1]!.minute) return s[s.length - 1]!.uv;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]!;
    const b = s[i + 1]!;
    if (minute >= a.minute && minute <= b.minute) {
      const t = (minute - a.minute) / (b.minute - a.minute);
      return a.uv + t * (b.uv - a.uv);
    }
  }
  return 0;
}

interface SessionFromStart {
  durationMin: number;
  endMinute: number;
  reachedTarget: boolean;
  accumulatedDose: number;
  avgUv: number;
  peakUv: number;
}

/**
 * A partire da `startMinute`, accumula la dose minuto per minuto finché
 * raggiunge `targetDose` o finché arriva al tramonto. Restituisce la sessione.
 */
function sessionFromStart(
  profile: DayUvProfile,
  startMinute: number,
  targetDose: number,
): SessionFromStart {
  let dose = 0;
  let peakUv = 0;
  let minute = startMinute;
  const limit = profile.sunsetMin;
  const MAX_MINUTES = 120; // tetto di buon senso: nessuna sessione oltre 2 ore

  while (minute < limit && minute - startMinute < MAX_MINUTES) {
    const uv = uvAtMinute(profile, minute);
    if (uv > peakUv) peakUv = uv;
    dose += doseRatePerMinute(uv);
    minute += 1;
    if (dose >= targetDose) break;
  }

  const durationMin = minute - startMinute;
  const avgUv =
    durationMin > 0 ? dose / (UVI_ERYTHEMAL_W_PER_M2 * 60 * durationMin) : 0;

  return {
    durationMin,
    endMinute: minute,
    reachedTarget: dose >= targetDose,
    accumulatedDose: dose,
    avgUv,
    peakUv,
  };
}

export interface SessionPlan {
  date: string;
  /** "13:00" */
  startTime: string;
  endTime: string;
  durationMin: number;
  avgUv: number;
  peakUv: number;
  /** true se la sessione raggiunge la dose obiettivo entro il tramonto. */
  reachedTarget: boolean;
  withSunscreen: boolean;
  recommendedSpf: number;
  note?: string;
}

export interface WeeklyPlan {
  phototype: Phototype;
  goal: TanningGoal;
  withSunscreen: boolean;
  /** frazione della MED puntata per sessione (cautela effettiva usata). */
  sessionFraction: number;
  reachable: boolean;
  sessions: SessionPlan[];
  summary: string;
}

export interface PlanOptions {
  /** l'utente applicherà l'SPF consigliato? (modalità scelta dall'utente) */
  useSunscreen: boolean;
  /** frazione della MED per sessione (cautela). Default `DEFAULT_SESSION_FRACTION`. */
  sessionFraction?: number;
  /** preferenza di finestra: "peak" = ore intense/efficienti, "gentle" = moderate/lunghe. Default "peak". */
  windowPreference?: "peak" | "gentle";
  /** UVI sotto cui non si pianifica esposizione (default 2). */
  minUsefulUv?: number;
}

/**
 * Costruisce il piano settimanale: per ogni giorno propone la finestra di
 * esposizione che porta la pelle alla stessa frazione sicura della sua soglia,
 * sempre sotto la scottatura. La sessione giornaliera NON dipende dall'obiettivo
 * (quello determina solo quante sessioni servono nel tempo).
 */
export function buildWeeklyPlan(
  forecast: Forecast,
  phototype: Phototype,
  goalId: TanningGoalId,
  options: PlanOptions,
): WeeklyPlan {
  const goal = getGoal(goalId);
  const reachable = isGoalReachable(goalId, phototype);
  const minUsefulUv = options.minUsefulUv ?? 2;
  const sessionFraction = options.sessionFraction ?? DEFAULT_SESSION_FRACTION;
  const windowPreference = options.windowPreference ?? "peak";

  if (goal.protectionOnly) {
    return {
      phototype,
      goal,
      withSunscreen: options.useSunscreen,
      sessionFraction: 0,
      reachable: true,
      sessions: [],
      summary:
        "Obiettivo di sola protezione: nessuna esposizione mirata consigliata. " +
        "Applica sempre la protezione solare quando sei all'aperto.",
    };
  }

  if (!reachable) {
    return {
      phototype,
      goal,
      withSunscreen: options.useSunscreen,
      sessionFraction,
      reachable: false,
      sessions: [],
      summary:
        `Con il tuo fototipo (${phototype}) l'obiettivo "${goal.label}" non è ` +
        `raggiungibile in sicurezza: ti scotteresti senza ottenere quel tono. ` +
        `Scegli un obiettivo più chiaro o "Protezione & luminosità".`,
    };
  }

  const med = MED_BY_PHOTOTYPE[phototype];
  const profiles = buildDayProfiles(forecast);
  const sessions: SessionPlan[] = [];

  for (const profile of profiles) {
    const spf = recommendedSpf(phototype, profile.uvMax);
    const spfFactor = options.useSunscreen ? effectiveSpf(spf) : 1;
    // Dose "ambientale" da accumulare: per la pelle resta sessionFraction×MED,
    // ma con crema serve un fattore SPF in più di radiazione ambientale.
    const targetDose = sessionFraction * med * spfFactor;

    if (profile.uvMax < minUsefulUv) {
      sessions.push({
        date: profile.date,
        startTime: "-",
        endTime: "-",
        durationMin: 0,
        avgUv: 0,
        peakUv: profile.uvMax,
        reachedTarget: false,
        withSunscreen: options.useSunscreen,
        recommendedSpf: spf,
        note: "UV troppo basso: giornata poco utile per abbronzarsi.",
      });
      continue;
    }

    const best = pickBestWindow(profile, targetDose, windowPreference);
    if (!best) {
      sessions.push({
        date: profile.date,
        startTime: "-",
        endTime: "-",
        durationMin: 0,
        avgUv: 0,
        peakUv: profile.uvMax,
        reachedTarget: false,
        withSunscreen: options.useSunscreen,
        recommendedSpf: spf,
        note: "Nessuna finestra utile in giornata.",
      });
      continue;
    }

    const { startMinute, session } = best;
    sessions.push({
      date: profile.date,
      startTime: minutesToHHMM(startMinute),
      endTime: minutesToHHMM(session.endMinute),
      durationMin: session.durationMin,
      avgUv: round1(session.avgUv),
      peakUv: round1(session.peakUv),
      reachedTarget: session.reachedTarget,
      withSunscreen: options.useSunscreen,
      recommendedSpf: spf,
      note: session.reachedTarget
        ? undefined
        : "La protezione allunga molto la sessione: oggi la dose obiettivo non è del tutto raggiungibile, ma l'esposizione resta sicura.",
    });
  }

  return {
    phototype,
    goal,
    withSunscreen: options.useSunscreen,
    sessionFraction,
    reachable: true,
    sessions,
    summary: buildSummary(goal, options.useSunscreen, sessions, sessionFraction),
  };
}

interface BestWindow {
  startMinute: number;
  session: SessionFromStart;
}

/**
 * Sceglie la finestra di inizio migliore nella giornata.
 * - "peak": minimizza la durata (ore più intense, esposizione efficiente).
 * - "gentle": predilige un UV medio moderato (sessione più lunga e graduale).
 */
function pickBestWindow(
  profile: DayUvProfile,
  targetDose: number,
  preference: "peak" | "gentle",
): BestWindow | null {
  const STEP = 10;
  const candidates: BestWindow[] = [];

  for (let start = profile.sunriseMin; start <= profile.sunsetMin; start += STEP) {
    const session = sessionFromStart(profile, start, targetDose);
    if (session.durationMin < 3) continue; // troppo breve per essere sensata
    candidates.push({ startMinute: start, session });
  }
  if (candidates.length === 0) return null;

  const reached = candidates.filter((c) => c.session.reachedTarget);

  if (reached.length === 0) {
    // Nessuna finestra raggiunge l'obiettivo del giorno (tipico con SPF alto o
    // UV basso): scegli la sessione che accumula più dose utile restando sicura.
    return candidates.reduce((b, c) =>
      c.session.accumulatedDose > b.session.accumulatedDose ? c : b,
    );
  }

  if (preference === "peak") {
    // più efficiente = durata minore (UV medio più alto)
    return reached.reduce((b, c) => (c.session.durationMin < b.session.durationMin ? c : b));
  }
  // "gentle": UV medio più vicino a un valore moderato e confortevole
  const COMFORT_UV = 4;
  return reached.reduce((b, c) =>
    Math.abs(c.session.avgUv - COMFORT_UV) < Math.abs(b.session.avgUv - COMFORT_UV) ? c : b,
  );
}

function buildSummary(
  goal: TanningGoal,
  withSunscreen: boolean,
  sessions: SessionPlan[],
  sessionFraction: number,
): string {
  const usable = sessions.filter((s) => s.durationMin > 0);
  const protezione = withSunscreen
    ? "con la protezione consigliata applicata"
    : "senza protezione (consigliata comunque su viso e zone sensibili)";
  const pct = Math.round(sessionFraction * 100);
  return (
    `Obiettivo "${goal.label}" ${protezione}. ` +
    `Ogni sessione si ferma al ${pct}% della tua soglia di scottatura; ` +
    `${usable.length} giornate utili nei prossimi 7 giorni. ` +
    `Gli obiettivi più scuri richiedono semplicemente più sessioni, non sessioni più intense. ` +
    `Nessuna sessione supera la soglia di scottatura.`
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// --- Dose di una sessione effettiva (durata scelta dall'utente) --------------

export type SessionSafety = "safe" | "aggressive" | "burn";

export interface SessionDose {
  /** dose ricevuta dalla pelle come frazione della MED del fototipo. */
  skinDoseFraction: number;
  /** dose ambientale integrata sulla durata, J/m². */
  ambientDose: number;
  /** SPF effettivo applicato nel calcolo (1 se senza crema). */
  spfFactorUsed: number;
  avgUv: number;
  peakUv: number;
  /**
   * - "safe":       entro la frazione suggerita (≤ soglia consigliata)
   * - "aggressive": oltre il suggerito ma ancora sotto la scottatura
   * - "burn":       raggiunge o supera la soglia di scottatura (MED) → rischio
   */
  safety: SessionSafety;
}

export interface SessionDoseOptions {
  useSunscreen: boolean;
  /** soglia "suggerita" oltre cui la sessione è considerata aggressiva. Default `DEFAULT_SESSION_FRACTION`. */
  suggestedFraction?: number;
}

function hhmmToMinute(t: string): number {
  const m = t.match(/(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/**
 * Calcola la dose effettiva di una sessione di durata arbitraria — utile quando
 * l'utente accorcia (meno tempo) o prolunga (a proprio rischio) la sessione di
 * oggi. La `skinDoseFraction` risultante alimenta il ricalcolo del progresso.
 */
export function computeSessionDose(
  forecast: Forecast,
  phototype: Phototype,
  date: string,
  startTime: string,
  durationMin: number,
  options: SessionDoseOptions,
): SessionDose {
  const profile = buildDayProfiles(forecast).find((p) => p.date === date);
  const med = MED_BY_PHOTOTYPE[phototype];
  const suggested = options.suggestedFraction ?? DEFAULT_SESSION_FRACTION;
  const uvMax = profile ? profile.uvMax : 0;
  const spf = recommendedSpf(phototype, uvMax);
  const spfFactor = options.useSunscreen ? effectiveSpf(spf) : 1;

  if (!profile || durationMin <= 0) {
    return {
      skinDoseFraction: 0,
      ambientDose: 0,
      spfFactorUsed: spfFactor,
      avgUv: 0,
      peakUv: 0,
      safety: "safe",
    };
  }

  const startMin = hhmmToMinute(startTime);
  let ambientDose = 0;
  let peakUv = 0;
  for (let m = startMin; m < startMin + durationMin; m++) {
    const uv = uvAtMinute(profile, m);
    if (uv > peakUv) peakUv = uv;
    ambientDose += doseRatePerMinute(uv);
  }

  const skinDoseFraction = ambientDose / spfFactor / med;
  const avgUv = ambientDose / (UVI_ERYTHEMAL_W_PER_M2 * 60 * durationMin);
  // Piccola tolleranza: la sessione suggerita (≈ frazione esatta) resta "safe".
  const safety: SessionSafety =
    skinDoseFraction >= 1.0 ? "burn" : skinDoseFraction > suggested + 0.03 ? "aggressive" : "safe";

  return {
    skinDoseFraction: Math.round(skinDoseFraction * 1000) / 1000,
    ambientDose: Math.round(ambientDose),
    spfFactorUsed: spfFactor,
    avgUv: round1(avgUv),
    peakUv: round1(peakUv),
    safety,
  };
}
