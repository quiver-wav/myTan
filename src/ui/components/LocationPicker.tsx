import { useEffect, useState } from "react";
import { searchLocations, type GeoLocation } from "../../core/index";
import { useStore } from "../store";

export function LocationPicker() {
  const { data, update } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsState, setGpsState] = useState<"idle" | "loading" | "error">("idle");

  // Seleziona una località e la salva tra le recenti (max 5, senza duplicati).
  const choose = (loc: GeoLocation) => {
    const saved = [loc, ...data.savedLocations.filter((s) => s.id !== loc.id)].slice(0, 5);
    update({ location: loc, savedLocations: saved });
  };

  const useGps = () => {
    if (!("geolocation" in navigator)) {
      setGpsState("error");
      return;
    }
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        choose({
          id: -1, // id riservato alla posizione GPS: la nuova sostituisce la vecchia
          name: "Posizione attuale",
          latitude,
          longitude,
          timezone: "auto", // risolto dall'API meteo in base alle coordinate
          country: "",
          countryCode: "",
          admin1: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
        });
      },
      () => setGpsState("error"),
      { timeout: 10_000 },
    );
  };

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchLocations(query);
        if (active) setResults(r);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const showSaved = query.trim().length < 2 && data.savedLocations.length > 0;

  return (
    <div className="card">
      <div className="step-label">Passo 2 di 3 · {data.phototype?.label}</div>
      <h1>Dove ti esponi al sole?</h1>
      <p className="muted">Cerca la tua città o località: i dati UV verranno presi da lì.</p>

      <button className="ghost block" onClick={useGps} disabled={gpsState === "loading"}>
        {gpsState === "loading" ? "Cerco la tua posizione…" : "Usa la posizione attuale"}
      </button>
      {gpsState === "error" && (
        <p className="note">
          Non riesco a ottenere la posizione: controlla i permessi, o cerca la località qui
          sotto.
        </p>
      )}

      <input
        type="text"
        placeholder="Es. Rimini, Catania, Milano…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {loading && <p className="muted">Cerco…</p>}

      {showSaved && (
        <>
          <p className="muted" style={{ marginBottom: 2 }}>Le tue località recenti:</p>
          {data.savedLocations.map((loc) => (
            <button key={loc.id} className="option" onClick={() => choose(loc)}>
              {loc.name}
              <span className="desc">
                {[loc.admin1, loc.country].filter(Boolean).join(", ")}
              </span>
            </button>
          ))}
        </>
      )}

      {results.map((loc) => (
        <button key={loc.id} className="option" onClick={() => choose(loc)}>
          {loc.name}
          <span className="desc">
            {[loc.admin1, loc.country].filter(Boolean).join(", ")}
          </span>
        </button>
      ))}
    </div>
  );
}
