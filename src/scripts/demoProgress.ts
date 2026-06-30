// Demo del modello di abbronzatura multi-giorno.
// Esegui con:  npm run demo:progress           (default fototipo 4, obiettivo scuro)
//              npm run demo:progress 2 dorato 3 (fototipo 2, dorato, 3 sessioni/sett.)

import {
  projectToGoal,
  tanCeiling,
  getGoal,
  type Phototype,
  type TanningGoalId,
} from "../core/index.js";

const phototype = (Number(process.argv[2] ?? 4) as Phototype);
const goalId = (process.argv[3] ?? "scuro") as TanningGoalId;
const sessionsPerWeek = Number(process.argv[4] ?? 4);

function bar(value: number, max: number, width = 30): string {
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
}

const goal = getGoal(goalId);
const proj = projectToGoal(phototype, goalId, { sessionsPerWeek });
const ceiling = tanCeiling(phototype);

console.log(`\n👤 Fototipo ${phototype} — obiettivo "${goal.label}" — ${sessionsPerWeek} sessioni/settimana\n`);
console.log(`   Tetto del fototipo:   ${ceiling.toFixed(2)}  ${bar(ceiling, 1)}`);
console.log(`   Obiettivo:            ${proj.targetTan.toFixed(2)}  ${bar(proj.targetTan, 1)}`);
console.log();

if (proj.reachedGoal) {
  console.log(`✅ Obiettivo raggiunto in ~${proj.daysNeeded} giorni (${proj.sessionsNeeded} sessioni).`);
} else {
  console.log(`⚠️  Obiettivo non raggiunto entro l'orizzonte di simulazione.`);
}

console.log("\nProgresso (un punto ogni 3 giorni):");
console.log("Giorno  Abbronzatura");
console.log("------  ------------");
for (const p of proj.curve.filter((_, i) => i % 3 === 0)) {
  const mark = p.tan >= proj.targetTan * 0.98 ? " 🎯" : "";
  console.log(`  ${String(p.day).padStart(3)}   ${p.tan.toFixed(2)} ${bar(p.tan, 1, 24)}${mark}`);
}
console.log();
