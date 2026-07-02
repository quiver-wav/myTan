// Colore stimato della pelle a partire dal livello di abbronzatura del modello.
// Presentazione pura (per questo vive nella UI, non nel core): interpola dalla
// tonalità base del fototipo verso un bronzo profondo, usando la scala assoluta
// 0..1 di tanProgress (il tetto del fototipo limita già quanto ci si scurisce).

import type { Phototype } from "../core/index";

/** Tonalità base (pelle non esposta) dei sei fototipi, dal più chiaro al più scuro. */
export const PHOTOTYPE_TONES = [
  "#f7e7d8",
  "#f0d2b2",
  "#dfb08a",
  "#b97f57",
  "#8a5a3b",
  "#5c3a26",
] as const;

/** Bronzo profondo: il punto d'arrivo della scala assoluta di abbronzatura. */
const DEEP_TAN = "#4a2e1a";

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Colore della pelle per un dato livello di abbronzatura (scala assoluta 0..1). */
export function tanToColor(phototype: Phototype, tan: number): string {
  const base = PHOTOTYPE_TONES[phototype - 1]!;
  return mixHex(base, DEEP_TAN, Math.max(0, Math.min(1, tan)));
}
