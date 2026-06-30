import { useEffect, useState } from "react";
import { searchLocations, type GeoLocation } from "../../core/index";
import { useStore } from "../store";

export function LocationPicker() {
  const { data, update } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="card">
      <div className="step-label">Passo 2 di 3 · {data.phototype?.label}</div>
      <h1>Dove ti esponi al sole?</h1>
      <p className="muted">Cerca la tua città o località: i dati UV verranno presi da lì.</p>
      <input
        type="text"
        placeholder="Es. Rimini, Catania, Milano…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {loading && <p className="muted">Cerco…</p>}
      {results.map((loc) => (
        <button key={loc.id} className="option" onClick={() => update({ location: loc })}>
          {loc.name}
          <span className="desc">
            {[loc.admin1, loc.country].filter(Boolean).join(", ")}
          </span>
        </button>
      ))}
    </div>
  );
}
