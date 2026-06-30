// Demo end-to-end del motore: questionario → fototipo → piano settimanale.
// Esegui con:  npm run demo:plan            (default: Catania, obiettivo "scuro")
//              npm run demo:plan Rimini ambrato
//
// Usa dati UV reali da Open-Meteo.

import {
  searchLocations,
  getForecast,
  classifyPhototype,
  goalsForPhototype,
  buildWeeklyPlan,
  type TanningGoalId,
} from "../core/index.js";

const city = process.argv[2] ?? "Catania";
const goalId = (process.argv[3] ?? "scuro") as TanningGoalId;

// Risposte di esempio al questionario Fitzpatrick (pelle medio-scura → fototipo IV).
const sampleAnswers = [2, 3, 3, 4, 3, 3, 3];

async function main() {
  const result = classifyPhototype(sampleAnswers);
  console.log(`\n👤 Questionario → ${result.label} (punteggio ${result.score})`);
  console.log(`   ${result.description}`);

  console.log("\n🎯 Obiettivi disponibili per questo fototipo:");
  for (const { goal, reachable } of goalsForPhototype(result.phototype)) {
    console.log(`   ${reachable ? "✅" : "🚫"} ${goal.label} — ${goal.description}`);
  }

  const locations = await searchLocations(city);
  const loc = locations[0]!;
  console.log(`\n📍 ${loc.name}, ${loc.admin1 ?? ""} (${loc.country})`);

  const forecast = await getForecast(loc.latitude, loc.longitude);

  for (const useSunscreen of [false, true]) {
    const plan = buildWeeklyPlan(forecast, result.phototype, goalId, { useSunscreen });
    console.log(
      `\n=== PIANO "${plan.goal.label}" — ${useSunscreen ? "CON" : "SENZA"} protezione ===`,
    );
    console.log(plan.summary);
    if (!plan.reachable) continue;

    console.log("\nGiorno        Orario        Durata  UVmedio  SPF  Note");
    console.log("------------  -----------   ------  -------  ---  ----");
    for (const s of plan.sessions) {
      const orario = s.durationMin > 0 ? `${s.startTime}-${s.endTime}` : "—";
      const durata = s.durationMin > 0 ? `${s.durationMin} min` : "—";
      console.log(
        `${s.date}  ${orario.padEnd(11)}   ${durata.padStart(6)}  ` +
          `${String(s.avgUv).padStart(7)}  ${String(s.recommendedSpf).padStart(3)}  ` +
          `${s.note ?? ""}`,
      );
    }
  }
  console.log();
}

main().catch((err) => {
  console.error("❌ Demo fallita:", err);
  process.exit(1);
});
