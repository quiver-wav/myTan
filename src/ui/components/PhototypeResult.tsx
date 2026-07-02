// Schermata di risultato del questionario: mostra il fototipo stimato e chiede
// conferma prima di proseguire. Dà fiducia nel numero su cui si basa tutta l'app
// e permette di rifare il test se l'utente non si riconosce.

import { MED_BY_PHOTOTYPE, DEFAULT_SESSION_FRACTION, UVI_ERYTHEMAL_W_PER_M2 } from "../../core/index";
import { useStore } from "../store";
import { PHOTOTYPE_TONES as TONES } from "../tanColor";

export function PhototypeResult() {
  const { data, update } = useStore();
  const result = data.phototype!;
  const med = MED_BY_PHOTOTYPE[result.phototype];
  // Minuti indicativi prima della soglia sicura in una giornata estiva a UV 7,
  // senza protezione: MED × frazione sicura / dose al minuto a UV 7.
  const minutesAtUv7 = Math.round(
    (med * DEFAULT_SESSION_FRACTION) / (7 * UVI_ERYTHEMAL_W_PER_M2 * 60),
  );

  return (
    <div className="card">
      <div className="step-label">Il tuo profilo</div>
      <h1>{result.label}</h1>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        {TONES.map((tone, i) => (
          <span
            key={tone}
            aria-label={`Fototipo ${i + 1}`}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: tone,
              border:
                i + 1 === result.phototype
                  ? "3px solid var(--sun-dark)"
                  : "2px solid var(--line)",
            }}
          />
        ))}
      </div>
      <p className="muted">{result.description}.</p>
      <p className="muted">
        Indicativamente, in una giornata estiva con UV 7 la tua finestra sicura senza
        protezione è di circa <b>{minutesAtUv7} minuti</b>. myTan costruirà i tuoi piani
        su questa soglia, senza mai superarla.
      </p>
      <button className="block" onClick={() => update({ phototypeConfirmed: true })}>
        Mi riconosco, continua
      </button>
      <button
        className="ghost block"
        style={{ marginTop: 6 }}
        onClick={() => update({ phototype: null, phototypeConfirmed: false })}
      >
        Rifai il questionario
      </button>
    </div>
  );
}
