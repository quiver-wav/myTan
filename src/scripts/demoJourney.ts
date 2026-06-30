// Demo: tempo all'obiettivo, durata modificabile della sessione di oggi
// (con classificazione di sicurezza) e ricalcolo del tempo residuo.
// Esegui con:  npm run demo:journey            (Catania, fototipo 4, scuro, 5/sett)

import {
  searchLocations,
  getForecast,
  buildWeeklyPlan,
  computeSessionDose,
  projectToGoal,
  projectRemaining,
  type Phototype,
  type TanningGoalId,
} from "../core/index.js";

const city = process.argv[2] ?? "Catania";
const phototype = Number(process.argv[3] ?? 4) as Phototype;
const goalId = (process.argv[4] ?? "scuro") as TanningGoalId;
const sessionsPerWeek = Number(process.argv[5] ?? 5);

const SAFETY_LABEL = {
  safe: "✅ sicura (entro il suggerito)",
  aggressive: "⚠️  oltre il suggerito, ma sotto la scottatura",
  burn: "🛑 RISCHIO SCOTTATURA (oltre la soglia)",
} as const;

async function main() {
  const loc = (await searchLocations(city))[0]!;
  const fc = await getForecast(loc.latitude, loc.longitude);
  console.log(`\n📍 ${loc.name} — fototipo ${phototype} — obiettivo "${goalId}" — ${sessionsPerWeek} sessioni/sett.`);

  // 1) Tempo stimato all'obiettivo seguendo le durate suggerite.
  const initial = projectToGoal(phototype, goalId, { sessionsPerWeek });
  console.log(
    `\n⏱️  Stima iniziale (durate suggerite): obiettivo in ~${initial.daysNeeded} giorni ` +
      `(${initial.sessionsNeeded} sessioni).`,
  );

  // Sessione suggerita di oggi.
  const plan = buildWeeklyPlan(fc, phototype, goalId, { useSunscreen: false });
  const today = plan.sessions[0]!;
  console.log(
    `\n☀️  Oggi (${today.date}) suggerito: ${today.startTime}-${today.endTime} = ${today.durationMin} min.`,
  );

  // 2) L'utente cambia la durata: confronto dose e sicurezza.
  console.log("\nSe oggi ti esponi per...");
  console.log("Durata    Dose pelle (% soglia)   Sicurezza");
  console.log("--------  ---------------------   ---------");
  for (const dur of [15, today.durationMin, today.durationMin + 20, today.durationMin + 40]) {
    const d = computeSessionDose(fc, phototype, today.date, today.startTime, dur, { useSunscreen: false });
    const tag = dur === today.durationMin ? " (suggerita)" : "";
    console.log(
      `${String(dur).padStart(3)} min   ${String(Math.round(d.skinDoseFraction * 100)).padStart(4)}%` +
        `                   ${SAFETY_LABEL[d.safety]}${tag}`,
    );
  }

  // 3) Ricalcolo del tempo residuo in base all'esposizione EFFETTIVA.
  //    Confronto due abitudini sulle giornate utili dei prossimi giorni:
  //    durata suggerita vs metà durata.
  const usableDays = plan.sessions.filter((s) => s.durationMin > 0);
  console.log("\n🔁 Ricalcolo in base a quanto ti esponi DAVVERO (storico sulle giornate utili):");
  for (const factor of [1, 0.5]) {
    const history = usableDays.map((s) => {
      const dur = Math.round(s.durationMin * factor);
      const dose = computeSessionDose(fc, phototype, s.date, s.startTime, dur, { useSunscreen: false });
      return { date: s.date, skinDoseFraction: dose.skinDoseFraction };
    });
    const remaining = projectRemaining(phototype, goalId, history, { sessionsPerWeek });
    const label = factor === 1 ? "durata suggerita" : "metà durata    ";
    const esito = remaining.reachedGoal
      ? `mancano ~${remaining.daysNeeded} giorni (${remaining.sessionsNeeded} sessioni)`
      : `a questo ritmo NON raggiungi l'obiettivo`;
    console.log(
      `   ${label}: dopo ${history.length} sessioni → abbronzatura ${remaining.currentTan.toFixed(2)}; ${esito}`,
    );
  }
  console.log();
}

main().catch((err) => {
  console.error("❌ Demo fallita:", err);
  process.exit(1);
});
