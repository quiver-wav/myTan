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
 * dorato = metà del proprio massimo, ambrato = ~80%, scuro = il massimo.
 */
export function goalTargetTan(phototype: Phototype, goalId: TanningGoalId): number {
  const ceiling = tanCeiling(phototype);
  // "scuro" punta al 90% del tetto (massimo pratico): il 100% assoluto è un
  // asintoto irraggiungibile a causa del decadimento.
  const fractionByGoal: Record<TanningGoalId, number> = {
    protezione: 0,
    dorato: 0.5,
    ambrato: 0.75,
    scuro: 0.9,
    mantenimento: 0.75,
  };
  return ceiling * fractionByGoal[goalId];
}

/**
 * Applica una sessione: crescita a saturazione verso il tetto.
 * `doseFraction` è la dose ricevuta dalla pelle come frazione della MED
 * (tipicamente la `sessionFraction` dell'obiettivo).
 */
export function applySession(
  currentTan: number,
  doseFraction: number,
  ceiling: number,
): number {
  const gain = GAIN_K * doseFraction * (ceiling - currentTan);
  return Math.min(ceiling, currentTan + Math.max(0, gain));
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
  /** dose per sessione come frazione della MED; default = quella dell'obiettivo. */
  sessionDoseFraction?: number;
  /** livello di abbronzatura di partenza (default 0). */
  startTan?: number;
  /** orizzonte massimo di simulazione in giorni (default 90). */
  maxDays?: number;
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
  const targetTan = goalTargetTan(phototype, goalId);
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
    const exposed = exposureDays.includes(day % 7) && tan < ceiling;
    if (exposed) {
      tan = applySession(tan, doseFraction, ceiling);
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
 * Le sessioni future sono assunte alla durata suggerita (frazione di sicurezza).
 * Se l'utente ha fatto sessioni più brevi, `currentTan` sarà più basso e
 * serviranno più giorni; se più lunghe, di meno.
 */
export function projectRemaining(
  phototype: Phototype,
  goalId: TanningGoalId,
  history: LoggedSession[],
  options: ProjectionOptions & { decayDaysSinceLast?: number } = {},
): RemainingProjection {
  let currentTan = tanFromHistory(phototype, history, { startTan: options.startTan });
  if (options.decayDaysSinceLast && options.decayDaysSinceLast > 0) {
    currentTan = applyDecay(currentTan, options.decayDaysSinceLast);
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
