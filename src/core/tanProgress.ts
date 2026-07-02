// Modello di abbronzatura multi-giorno: accumulo e decadimento nel tempo.
//
// L'abbronzatura non è istantanea né permanente:
//   - ACCUMULO: ogni sessione aumenta il livello di melanina, con crescita
//     "a saturazione" verso il massimo raggiungibile dal fototipo (più si è
//     già scuri, meno si guadagna per sessione).
//   - DECADIMENTO: senza esposizione l'abbronzatura svanisce col ricambio
//     cellulare (emivita ~28 giorni).
//
// Il livello di abbronzatura è una scala relativa 0..1 (0 = pelle non esposta
// del fototipo, 1 = pelle più scura in assoluto). Ogni fototipo ha un proprio
// tetto: un fototipo II non diventerà mai scuro come un fototipo V.
//
// Modello semplificato e calibrabile: serve a dare stime di progresso
// realistiche, non è una misura clinica.

import type { Phototype } from "./phototype";
import { DEFAULT_SESSION_FRACTION, type TanningGoalId } from "./tanning";

/** Massimo livello di abbronzatura raggiungibile per fototipo (scala 0..1). */
export const TAN_CEILING_BY_PHOTOTYPE: Record<Phototype, number> = {
  1: 0.15,
  2: 0.35,
  3: 0.55,
  4: 0.75,
  5: 0.9,
  6: 1.0,
};

/** Quanto rapidamente una sessione fa guadagnare colore (parametro calibrabile). */
const GAIN_K = 0.3;

/**
 * Resa di una sessione che raggiunge la scottatura (dose ≥ 1 MED): la pelle
 * danneggiata si abbronza PEGGIO, quindi sforare la soglia non solo non rende
 * di più, ma dimezza il guadagno. Senza questa penalità il modello premierebbe
 * chi si scotta — il contrario della fisiologia e del messaggio dell'app.
 */
const BURN_PENALTY = 0.5;

/** Emivita dell'abbronzatura in giorni (ricambio cellulare cutaneo). */
const HALF_LIFE_DAYS = 28;
const DAILY_DECAY = Math.pow(0.5, 1 / HALF_LIFE_DAYS);

/** Tetto di abbronzatura del fototipo. */
export function tanCeiling(phototype: Phototype): number {
  return TAN_CEILING_BY_PHOTOTYPE[phototype];
}

/**
 * Livello di abbronzatura obiettivo, sulla stessa scala 0..1.
 * Gli obiettivi sono espressi come frazione del tetto del fototipo:
 * dorato = metà del proprio massimo, ambrato = ~75%, scuro = 90% (il 100%
 * assoluto è un asintoto irraggiungibile a causa del decadimento).
 * "Mantenimento" fa eccezione: l'obiettivo è il livello che GIÀ possiedi.
 */
export function goalTargetTan(
  phototype: Phototype,
  goalId: TanningGoalId,
  startTan = 0,
): number {
  const ceiling = tanCeiling(phototype);
  if (goalId === "mantenimento") return Math.min(startTan, ceiling);
  const fractionByGoal: Record<TanningGoalId, number> = {
    protezione: 0,
    dorato: 0.5,
    ambrato: 0.75,
    scuro: 0.9,
    mantenimento: 0,
  };
  return ceiling * fractionByGoal[goalId];
}

/**
 * Applica una sessione: crescita a saturazione verso il tetto.
 * `doseFraction` è la dose ricevuta dalla pelle come frazione della MED.
 * Il guadagno cresce solo fino alla soglia di scottatura (1 MED): la dose
 * oltre quel punto non abbronza di più, e una sessione che scotta rende
 * la metà (vedi BURN_PENALTY).
 */
export function applySession(
  currentTan: number,
  doseFraction: number,
  ceiling: number,
): number {
  const effective = Math.min(Math.max(0, doseFraction), 1);
  let gain = GAIN_K * effective * (ceiling - currentTan);
  if (doseFraction >= 1) gain *= BURN_PENALTY;
  return Math.min(ceiling, currentTan + gain);
}

/** Applica il decadimento naturale su un numero di giorni. */
export function applyDecay(currentTan: number, days: number): number {
  return currentTan * Math.pow(DAILY_DECAY, days);
}

export interface ProgressPoint {
  day: number;       // giorno dall'inizio (0-based)
  tan: number;       // livello di abbronzatura 0..1
  exposed: boolean;  // c'è stata una sessione quel giorno
}

export interface GoalProjection {
  reachedGoal: boolean;
  /** sessioni necessarie per raggiungere l'obiettivo (entro il limite). */
  sessionsNeeded: number;
  /** giorni di calendario necessari (dipende dalle sessioni a settimana). */
  daysNeeded: number;
  targetTan: number;
  ceiling: number;
  /** curva giorno per giorno, utile a disegnare un grafico di progresso. */
  curve: ProgressPoint[];
}

export interface ProjectionOptions {
  /** quante sessioni a settimana l'utente prevede di fare (default 4). */
  sessionsPerWeek?: number;
  /** dose per sessione come frazione della MED; default = frazione di sicurezza. */
  sessionDoseFraction?: number;
  /** livello di abbronzatura di partenza (default 0). */
  startTan?: number;
  /** orizzonte massimo di simulazione in giorni (default 90). */
  maxDays?: number;
  /**
   * Dose realmente ottenibile nei prossimi giorni secondo il meteo (indice =
   * giorni da oggi, dal piano settimanale): `null` = giornata non utile (UV
   * troppo basso o finestra passata). Oltre l'array si torna alla dose media.
   * Rende la proiezione coerente con il forecast reale.
   */
  upcomingDoses?: (number | null)[];
}

/**
 * Proietta nel tempo quante sessioni/giorni servono per raggiungere l'obiettivo,
 * tenendo conto sia dell'accumulo sia del decadimento nei giorni di riposo.
 */
export function projectToGoal(
  phototype: Phototype,
  goalId: TanningGoalId,
  options: ProjectionOptions = {},
): GoalProjection {
  const ceiling = tanCeiling(phototype);
  const targetTan = goalTargetTan(phototype, goalId, options.startTan ?? 0);
  const sessionsPerWeek = options.sessionsPerWeek ?? 4;
  const doseFraction = options.sessionDoseFraction ?? DEFAULT_SESSION_FRACTION;
  const maxDays = options.maxDays ?? 90;

  // Quali giorni della settimana prevedono una sessione (distribuite uniformemente).
  const exposureDays = pickExposureDays(sessionsPerWeek);

  let tan = options.startTan ?? 0;
  let sessionsNeeded = 0;
  let daysNeeded = 0;
  let reachedGoal = targetTan <= tan;
  const curve: ProgressPoint[] = [];
  // Consideriamo raggiunto a partire dal 98% dell'obiettivo (asintoto).
  const reachThreshold = targetTan * 0.98;

  for (let day = 0; day < maxDays; day++) {
    // Nei giorni coperti dal forecast la sessione avviene solo se il meteo la
    // permette, con la dose davvero ottenibile quel giorno.
    let dose = doseFraction;
    let weatherAllows = true;
    if (options.upcomingDoses && day < options.upcomingDoses.length) {
      const d = options.upcomingDoses[day];
      if (d == null) weatherAllows = false;
      else dose = d;
    }
    const exposed = exposureDays.includes(day % 7) && weatherAllows && tan < ceiling;
    if (exposed) {
      tan = applySession(tan, dose, ceiling);
      sessionsNeeded++;
    }
    tan = applyDecay(tan, 1);
    curve.push({ day, tan: round3(tan), exposed });

    if (!reachedGoal && tan >= reachThreshold) {
      reachedGoal = true;
      daysNeeded = day + 1;
    }
  }

  return {
    reachedGoal,
    sessionsNeeded: reachedGoal ? countSessionsUntil(curve, daysNeeded) : sessionsNeeded,
    daysNeeded: reachedGoal ? daysNeeded : maxDays,
    targetTan: round3(targetTan),
    ceiling: round3(ceiling),
    curve,
  };
}

export interface LoggedSession {
  /** data della sessione, "YYYY-MM-DD". */
  date: string;
  /** dose ricevuta dalla pelle come frazione della MED (da `computeSessionDose`). */
  skinDoseFraction: number;
  /** dettagli opzionali, mostrati nello storico. */
  startTime?: string;
  durationMin?: number;
  withSunscreen?: boolean;
}

/**
 * Livello di abbronzatura risultante dalle sessioni EFFETTIVAMENTE svolte,
 * applicando accumulo e decadimento tra le date. È il punto di partenza reale
 * da cui ristimare il tempo all'obiettivo.
 */
export function tanFromHistory(
  phototype: Phototype,
  sessions: LoggedSession[],
  options: { startTan?: number } = {},
): number {
  const ceiling = tanCeiling(phototype);
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  let tan = options.startTan ?? 0;
  let prevDate: string | null = null;
  for (const s of sorted) {
    if (prevDate) tan = applyDecay(tan, daysBetween(prevDate, s.date));
    tan = applySession(tan, s.skinDoseFraction, ceiling);
    prevDate = s.date;
  }
  return tan;
}

/**
 * Andamento dell'abbronzatura nel tempo dalle sessioni EFFETTIVE: per ogni
 * sessione, il livello cumulato a quella data (con decadimento tra le date).
 * Serve a disegnare la parte "passata" del grafico di progresso.
 */
export function cumulativeTanByDate(
  phototype: Phototype,
  sessions: LoggedSession[],
): { date: string; tan: number }[] {
  const ceiling = tanCeiling(phototype);
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const out: { date: string; tan: number }[] = [];
  let tan = 0;
  let prevDate: string | null = null;
  for (const s of sorted) {
    if (prevDate) tan = applyDecay(tan, daysBetween(prevDate, s.date));
    tan = applySession(tan, s.skinDoseFraction, ceiling);
    out.push({ date: s.date, tan: round3(tan) });
    prevDate = s.date;
  }
  return out;
}

export interface RemainingProjection extends GoalProjection {
  /** livello di abbronzatura attuale stimato dalle sessioni svolte. */
  currentTan: number;
}

/**
 * Ristima quanto manca all'obiettivo a partire dalle sessioni già svolte.
 * Le sessioni future sono assunte alla durata suggerita (frazione di sicurezza)
 * o, nei giorni coperti dal forecast, alla dose che il meteo permette davvero.
 * Passando `today`, l'abbronzatura viene fatta decadere dall'ultima sessione
 * ad oggi: riaprire l'app dopo settimane mostra il livello sbiadito reale.
 */
export function projectRemaining(
  phototype: Phototype,
  goalId: TanningGoalId,
  history: LoggedSession[],
  options: ProjectionOptions & { today?: string } = {},
): RemainingProjection {
  let currentTan = tanFromHistory(phototype, history, { startTan: options.startTan });
  if (options.today && history.length > 0) {
    const lastDate = history
      .map((s) => s.date)
      .sort()
      .at(-1)!;
    currentTan = applyDecay(currentTan, daysBetween(lastDate, options.today));
  }
  const proj = projectToGoal(phototype, goalId, { ...options, startTan: currentTan });
  return { ...proj, currentTan: round3(currentTan) };
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  return Math.max(0, Math.round((db - da) / 86_400_000));
}

function pickExposureDays(sessionsPerWeek: number): number[] {
  const n = Math.max(1, Math.min(7, Math.round(sessionsPerWeek)));
  const days: number[] = [];
  for (let i = 0; i < n; i++) {
    days.push(Math.round((i * 7) / n) % 7);
  }
  return days;
}

function countSessionsUntil(curve: ProgressPoint[], days: number): number {
  return curve.slice(0, days).filter((p) => p.exposed).length;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
