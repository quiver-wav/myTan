// Script di verifica: controlla che i dati meteo/UV arrivino correttamente.
// Esegui con:  npm run verify:meteo  (richiede Node 18+ e `npm install`)
//
// Cerca una località, ne stampa l'UV max sui 7 giorni e le ore centrali di oggi.

import { searchLocations, getForecast } from "../core/index.js";

const query = process.argv[2] ?? "Rimini";

async function main() {
  console.log(`\n🔎 Geocoding per "${query}"...`);
  const locations = await searchLocations(query);
  if (locations.length === 0) {
    console.error("Nessuna località trovata.");
    process.exit(1);
  }

  const loc = locations[0]!;
  console.log(
    `📍 ${loc.name}${loc.admin1 ? `, ${loc.admin1}` : ""} (${loc.country}) ` +
      `— ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)} [${loc.timezone}]`,
  );
  if (locations.length > 1) {
    console.log(`   (altre ${locations.length - 1} corrispondenze disponibili per la scelta utente)`);
  }

  console.log("\n☀️  Previsioni UV su 7 giorni...");
  const fc = await getForecast(loc.latitude, loc.longitude);

  console.log("\nGiorno        UV max   Alba    Tramonto");
  console.log("------------  ------   -----   --------");
  for (const d of fc.daily) {
    console.log(
      `${d.date}  ${String(d.uvIndexMax).padStart(5)}   ` +
        `${d.sunrise.slice(11)}   ${d.sunset.slice(11)}`,
    );
  }

  const todayHours = fc.hourly
    .filter((h) => h.time.startsWith(fc.daily[0]!.date))
    .filter((h) => {
      const hr = Number(h.time.slice(11, 13));
      return hr >= 9 && hr <= 17;
    });

  console.log("\nOggi, ore centrali (09-17):");
  console.log("Ora    UV     Nuvole   Temp");
  console.log("-----  -----  ------   ----");
  for (const h of todayHours) {
    console.log(
      `${h.time.slice(11)}  ${String(h.uvIndex).padStart(5)}  ` +
        `${String(h.cloudCover).padStart(4)}%    ${h.temperature}°C`,
    );
  }
  console.log("\n✅ Dati ricevuti correttamente.\n");
}

main().catch((err) => {
  console.error("❌ Verifica fallita:", err);
  process.exit(1);
});
