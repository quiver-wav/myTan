# myTan ☀️

App che aiuta ad abbronzarsi **in sicurezza**, costruendo un piano di esposizione
personalizzato in base al **fototipo** dell'utente e ai **dati UV reali** della
località scelta.

## Principi di progetto

- **Riduzione del danno, non massimo abbronzamento.** L'app non promette tinte
  impossibili e consiglia sempre la protezione adeguata.
- **Vincolo non negoziabile:** una sessione non supera mai la soglia di
  scottatura (MED) del fototipo dell'utente. L'utente sceglie luogo, ora e
  obiettivo; non può impostare esposizioni che lo fanno scottare.
- **Nessuna regola rigida "evita le 11-16".** L'app può proporre anche le ore
  centrali, ma dimensiona la durata della sessione sulla finestra sicura del
  singolo fototipo (per i fototipi chiari sarà breve).
- **Core portabile.** La logica e l'accesso ai dati vivono in `src/core` come
  TypeScript puro, senza dipendenze dall'interfaccia: riusabili identici da una
  PWA o da React Native.

## Stato attuale

- [x] Integrazione dati meteo/UV (Open-Meteo: geocoding + UV orario/giornaliero,
      copertura nuvolosa, alba/tramonto, 7 giorni) — `src/core/openMeteo.ts`
- [ ] Questionario Fitzpatrick → fototipo (I–VI)
- [ ] Motore: fototipo + UV → minuti di esposizione sicuri per ora/giorno
- [ ] Obiettivi di abbronzatura filtrati per fototipo
- [ ] Raccomandazione SPF
- [ ] UI / PWA

## Dati: Open-Meteo (gratis, senza API key)

- Geocoding: <https://geocoding-api.open-meteo.com/v1/search>
- Forecast (con `uv_index`): <https://api.open-meteo.com/v1/forecast>

La copertura nuvolosa è inclusa perché incide sull'UV effettivo di ogni fascia
oraria (es. a cielo coperto l'UV mattutino può dimezzarsi).

## Sviluppo

Richiede Node 18+ (per `fetch` nativo).

```bash
npm install
npm run verify:meteo            # verifica i dati per "Rimini"
npm run verify:meteo "Catania"  # o un'altra località
npm run typecheck
```
