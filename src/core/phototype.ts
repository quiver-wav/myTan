// Questionario di Fitzpatrick → fototipo (I–VI).
//
// Standard medico per stimare la reattività della pelle al sole. Si compone di
// una parte "costituzionale" (occhi, capelli, pelle, lentiggini) e una parte
// "reattiva" (come la pelle reagisce ed abbronza). Ogni risposta vale 0–4 punti;
// la somma determina il fototipo.
//
// File puro: nessuna dipendenza dall'interfaccia. Le domande sono dati, così la
// UI (PWA o React Native) le può rendere senza riscrivere la logica.

export type Phototype = 1 | 2 | 3 | 4 | 5 | 6;

export interface FitzOption {
  label: string;
  score: number;
}

export interface FitzQuestion {
  id: string;
  text: string;
  options: FitzOption[];
}

/**
 * Set di 7 domande (4 costituzionali + 3 reattive). La domanda d'esempio
 * dell'utente ("cosa succede dopo un'ora di sole intenso senza protezione?")
 * corrisponde a `reaction_burn`.
 */
export const FITZPATRICK_QUESTIONS: FitzQuestion[] = [
  {
    id: "eyes",
    text: "Di che colore sono i tuoi occhi?",
    options: [
      { label: "Azzurro chiaro, grigio, verde chiaro", score: 0 },
      { label: "Azzurro, grigio o verde", score: 1 },
      { label: "Nocciola / marrone chiaro", score: 2 },
      { label: "Marrone scuro", score: 3 },
      { label: "Marrone scurissimo / nero", score: 4 },
    ],
  },
  {
    id: "hair",
    text: "Di che colore sono i tuoi capelli naturali?",
    options: [
      { label: "Rosso o biondo molto chiaro", score: 0 },
      { label: "Biondo", score: 1 },
      { label: "Castano chiaro", score: 2 },
      { label: "Castano scuro", score: 3 },
      { label: "Nero", score: 4 },
    ],
  },
  {
    id: "skin",
    text: "Di che colore è la tua pelle nelle zone non esposte al sole?",
    options: [
      { label: "Rossiccia / molto bianca", score: 0 },
      { label: "Bianca / chiara", score: 1 },
      { label: "Beige chiaro", score: 2 },
      { label: "Olivastra / marrone chiaro", score: 3 },
      { label: "Marrone scuro", score: 4 },
    ],
  },
  {
    id: "freckles",
    text: "Quante lentiggini hai sulla pelle non esposta?",
    options: [
      { label: "Molte", score: 0 },
      { label: "Parecchie", score: 1 },
      { label: "Poche", score: 2 },
      { label: "Pochissime", score: 3 },
      { label: "Nessuna", score: 4 },
    ],
  },
  {
    id: "reaction_burn",
    text: "Se stai un'ora al sole intenso di mezzogiorno senza protezione, cosa succede di solito?",
    options: [
      { label: "Scottatura dolorosa con vesciche, poi la pelle si spella", score: 0 },
      { label: "Mi scotto e dopo qualche giorno mi spello", score: 1 },
      { label: "Mi scotto leggermente, a volte mi spello un po'", score: 2 },
      { label: "Raramente mi scotto", score: 3 },
      { label: "Non mi scotto mai", score: 4 },
    ],
  },
  {
    id: "reaction_tan",
    text: "Quanto ti abbronzi dopo ripetute esposizioni?",
    options: [
      { label: "Pochissimo o per niente", score: 0 },
      { label: "Abbronzatura leggera", score: 1 },
      { label: "Abbronzatura discreta", score: 2 },
      { label: "Mi abbronzo facilmente", score: 3 },
      { label: "Divento scuro/a molto facilmente", score: 4 },
    ],
  },
  {
    id: "reaction_face",
    text: "Quanto diventa scuro il tuo viso dopo un'esposizione prolungata?",
    options: [
      { label: "Mai più scuro", score: 0 },
      { label: "Poco più scuro", score: 1 },
      { label: "Moderatamente scuro", score: 2 },
      { label: "Molto scuro", score: 3 },
      { label: "Estremamente scuro", score: 4 },
    ],
  },
];

export interface PhototypeResult {
  phototype: Phototype;
  /** punteggio totale del questionario */
  score: number;
  /** etichetta pronta per la UI, es. "Fototipo III" */
  label: string;
  /** descrizione sintetica del comportamento al sole */
  description: string;
}

const PHOTOTYPE_DESCRIPTIONS: Record<Phototype, string> = {
  1: "Si scotta sempre, non si abbronza mai",
  2: "Si scotta facilmente, si abbronza poco e con difficoltà",
  3: "A volte si scotta, si abbronza gradualmente",
  4: "Si scotta raramente, si abbronza facilmente",
  5: "Si scotta molto di rado, si abbronza intensamente",
  6: "Non si scotta praticamente mai, pelle naturalmente scura",
};

/**
 * Soglie di punteggio → fototipo. Sono un adattamento del Fitzpatrick
 * self-assessment al set di 7 domande (punteggio massimo 28) e sono
 * calibrabili da un unico punto.
 */
const SCORE_THRESHOLDS: { maxScore: number; phototype: Phototype }[] = [
  { maxScore: 7, phototype: 1 },
  { maxScore: 12, phototype: 2 },
  { maxScore: 17, phototype: 3 },
  { maxScore: 22, phototype: 4 },
  { maxScore: 26, phototype: 5 },
  { maxScore: Infinity, phototype: 6 },
];

/** Calcola il fototipo a partire dai punteggi delle risposte (uno per domanda). */
export function classifyPhototype(scores: number[]): PhototypeResult {
  const score = scores.reduce((sum, s) => sum + s, 0);
  const match = SCORE_THRESHOLDS.find((t) => score <= t.maxScore)!;
  const phototype = match.phototype;
  return {
    phototype,
    score,
    label: `Fototipo ${toRoman(phototype)}`,
    description: PHOTOTYPE_DESCRIPTIONS[phototype],
  };
}

function toRoman(n: Phototype): string {
  return ["I", "II", "III", "IV", "V", "VI"][n - 1]!;
}
