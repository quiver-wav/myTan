import { useEffect, useMemo, useState } from "react";
import {
  getForecast,
  buildWeeklyPlan,
  projectRemaining,
  cumulativeTanByDate,
  classifySafety,
  nowInTimezone,
  getGoal,
  type Forecast,
  type Phototype,
} from "../../core/index";
import { useStore } from "../store";
import { tanToColor } from "../tanColor";
import { ProgressChart } from "./ProgressChart";
import { TodayCard } from "./TodayCard";

const dateFmt = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const formatDate = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00`));

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Classe del badge UV in base all'intensità (scala OMS). */
function uvClass(uv: number): string {
  if (uv >= 8) return "extreme";
  if (uv >= 6) return "high";
  if (uv >= 3) return "mid";
  return "low";
}

export function Dashboard() {
  const { data, update, reset, removeSession } = useStore();
  const phototype = data.phototype!.phototype;
  const goalId = data.goalId!;
  const location = data.location!;

  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tick al minuto: tiene aggiornati "adesso", la finestra di oggi e il timer.
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMinuteTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Conferma in due tocchi per "Ricomincia" (cancella tutto).
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 4000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  useEffect(() => {
    let active = true;
    setForecast(null);
    setError(null);
    getForecast(location.latitude, location.longitude)
      .then((f) => active && setForecast(f))
      .catch(() => active && setError("Impossibile recuperare i dati meteo. Riprova."));
    return () => {
      active = false;
    };
  }, [location.latitude, location.longitude]);

  const plan = useMemo(() => {
    if (!forecast) return null;
    return buildWeeklyPlan(forecast, phototype, goalId, {
      useSunscreen: data.useSunscreen,
      now: nowInTimezone(forecast.timezone),
    });
    // minuteTick tiene la finestra di oggi allineata all'ora corrente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast, phototype, goalId, data.useSunscreen, minuteTick]);

  const todayDate = forecast?.daily[0]?.date ?? "";

  const projection = useMemo(() => {
    // Nei giorni coperti dal forecast la proiezione usa la dose che il meteo
    // permette davvero; oggi va escluso se la sessione è già registrata.
    const upcomingDoses = plan?.sessions.map((s, i) => {
      if (i === 0 && data.history.some((h) => h.date === s.date)) return null;
      return s.durationMin > 0 ? s.skinDoseFraction : null;
    });
    return projectRemaining(phototype, goalId, data.history, {
      sessionsPerWeek: data.sessionsPerWeek,
      today: todayDate || undefined,
      upcomingDoses,
    });
  }, [phototype, goalId, data.history, data.sessionsPerWeek, plan, todayDate]);

  const goal = getGoal(goalId);

  const historyPoints = useMemo(
    () => cumulativeTanByDate(phototype, data.history),
    [phototype, data.history],
  );
  const futurePoints = useMemo(() => {
    if (!todayDate) return [];
    const cap = projection.reachedGoal ? Math.min(projection.daysNeeded + 4, 60) : 45;
    const pts = projection.curve
      .filter((p) => p.day <= cap)
      .map((p) => ({ date: addDays(todayDate, p.day + 1), tan: p.tan }));
    // parte dal livello attuale di oggi, così la linea è continua col punto reale
    return [{ date: todayDate, tan: projection.currentTan }, ...pts];
  }, [projection, todayDate]);

  const sortedHistory = [...data.history].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="row" style={{ margin: "8px 2px 0" }}>
        <div className="step-label" style={{ margin: 0 }}>
          {data.phototype?.label} · {location.name} · {goal.label}
        </div>
        <button
          className="ghost"
          onClick={() => (confirmReset ? reset() : setConfirmReset(true))}
        >
          {confirmReset ? "Sicuro? Cancella tutto" : "Ricomincia"}
        </button>
      </div>

      {!forecast && !error && <div className="spinner">Carico i dati UV di {location.name}…</div>}
      {error && <div className="card">{error}</div>}

      {forecast && plan && (
        <>
          <TodayCard forecast={forecast} plan={plan} />

          <div className="card">
            <h2>Il tuo obiettivo: {goal.label}</h2>
            <SkinPreview
              phototype={phototype}
              current={projection.currentTan}
              target={projection.targetTan}
            />
            <ProgressView projection={projection} goalId={goalId} />
            <div style={{ marginTop: 10 }}>
              <ProgressChart
                ceiling={projection.ceiling}
                target={projection.targetTan}
                todayDate={todayDate}
                history={historyPoints}
                future={futurePoints}
              />
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <span className="muted" style={{ fontSize: 13 }}>Sessioni a settimana</span>
              <span>
                {[2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    className={n === data.sessionsPerWeek ? "" : "ghost"}
                    style={{ padding: "6px 10px", marginLeft: 4 }}
                    onClick={() => update({ sessionsPerWeek: n })}
                  >
                    {n}
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className="card">
            <h2>Storico sessioni</h2>
            {sortedHistory.length === 0 ? (
              <p className="muted">
                Nessuna sessione registrata. Registra la sessione di oggi per iniziare a
                tracciare i progressi.
              </p>
            ) : (
              sortedHistory.map((s) => (
                <div className="day" key={s.date}>
                  <span className="when" style={{ textTransform: "capitalize" }}>
                    {formatDate(s.date)}
                    {(s.startTime || s.durationMin) && (
                      <>
                        <br />
                        <span className="uv" style={{ textTransform: "none" }}>
                          {s.startTime ?? ""}
                          {s.startTime && s.durationMin ? " · " : ""}
                          {s.durationMin ? `${s.durationMin} min` : ""}
                          {s.withSunscreen ? " · SPF" : ""}
                        </span>
                      </>
                    )}
                  </span>
                  <span>
                    <span className={`pill ${classifySafety(s.skinDoseFraction)}`}>
                      {Math.round(s.skinDoseFraction * 100)}% soglia
                    </span>
                    <button
                      className="ghost"
                      style={{ padding: "4px 8px", marginLeft: 8 }}
                      onClick={() => removeSession(s.date)}
                      aria-label="Rimuovi sessione"
                    >
                      ✕
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <h2>Prossimi 7 giorni</h2>
            {plan.sessions.map((s) => (
              <div className="day" key={s.date}>
                <span className="when" style={{ textTransform: "capitalize" }}>
                  {formatDate(s.date)}
                </span>
                {s.durationMin > 0 ? (
                  <span style={{ textAlign: "right" }}>
                    {s.startTime}–{s.endTime} · <b>{s.durationMin} min</b>
                    <br />
                    <span className="uv">
                      <span className={`uvchip ${uvClass(s.avgUv)}`}>UV {s.avgUv}</span>
                      {" "}SPF {s.recommendedSpf}
                    </span>
                  </span>
                ) : (
                  <span className="uv" style={{ textAlign: "right", maxWidth: "55%" }}>
                    {s.note ?? "Giornata non utile"}
                  </span>
                )}
              </div>
            ))}
            <p className="note">{plan.summary}</p>
          </div>

          <div className="row">
            <button className="ghost block" onClick={() => update({ goalId: null })}>
              Cambia obiettivo
            </button>
            <button className="ghost block" onClick={() => update({ location: null })}>
              Cambia località
            </button>
          </div>
        </>
      )}

      <div className="disclaimer">
        myTan non è un dispositivo medico né un consulto dermatologico. L'abbronzatura
        è una risposta della pelle ai raggi UV: usa sempre la protezione e non superare
        le durate sicure consigliate.
      </div>
    </div>
  );
}

/**
 * Anteprima del colore della pelle: dove sei oggi → dove stai andando.
 * Traduce il livello di abbronzatura del modello in tonalità reali.
 */
function SkinPreview({
  phototype,
  current,
  target,
}: {
  phototype: Phototype;
  current: number;
  target: number;
}) {
  const from = tanToColor(phototype, current);
  const to = tanToColor(phototype, target);
  return (
    <div className="skin-preview">
      <div className="swatch-wrap">
        <span className="swatch" style={{ background: from }} />
        <span className="lbl">Oggi</span>
      </div>
      <div className="skin-grad" style={{ background: `linear-gradient(90deg, ${from}, ${to})` }} />
      <div className="swatch-wrap">
        <span className="swatch" style={{ background: to }} />
        <span className="lbl">Obiettivo</span>
      </div>
    </div>
  );
}

function ProgressView({
  projection,
  goalId,
}: {
  projection: ReturnType<typeof projectRemaining>;
  goalId: string;
}) {
  const pctOfCeiling = projection.ceiling > 0 ? projection.currentTan / projection.ceiling : 0;
  const targetPct = projection.ceiling > 0 ? projection.targetTan / projection.ceiling : 0;

  const bar = (
    <>
      <div className="bar" style={{ position: "relative" }}>
        <span style={{ width: `${Math.min(pctOfCeiling, 1) * 100}%` }} />
        <div
          style={{
            position: "absolute",
            top: -3,
            left: `${Math.min(targetPct, 1) * 100}%`,
            width: 3,
            height: 16,
            borderRadius: 2,
            background: "var(--ink)",
          }}
          title="obiettivo"
        />
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Abbronzatura attuale {Math.round(pctOfCeiling * 100)}% · l'asticella scura è il
        tuo obiettivo.
      </p>
    </>
  );

  // "Mantenimento": l'obiettivo è tenere il livello attuale, non crescere.
  if (goalId === "mantenimento") {
    if (projection.currentTan < 0.03) {
      return (
        <>
          {bar}
          <p className="muted" style={{ marginTop: 8 }}>
            Non hai ancora un'abbronzatura da mantenere: registra le tue sessioni, o
            scegli un obiettivo di crescita.
          </p>
        </>
      );
    }
    const horizon = Math.min(27, projection.curve.length - 1);
    const inAMonth = projection.curve[horizon]?.tan ?? projection.currentTan;
    const keptPct = Math.round((inAMonth / projection.currentTan) * 100);
    return (
      <>
        {bar}
        <div style={{ marginTop: 8 }}>
          {keptPct >= 95 ? (
            <span className="muted">
              Questo ritmo mantiene la tua abbronzatura (≈{keptPct}% tra un mese).
            </span>
          ) : (
            <span className="muted">
              A questo ritmo tra un mese ne conserveresti solo ~{keptPct}%: aumenta le
              sessioni a settimana.
            </span>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {bar}
      <div style={{ marginTop: 8 }}>
        {projection.reachedGoal && projection.daysNeeded === 0 ? (
          <span className="big">Obiettivo raggiunto!</span>
        ) : projection.reachedGoal ? (
          <>
            <span className="big">~{projection.daysNeeded} giorni</span>
            <span className="muted"> · {projection.sessionsNeeded} sessioni alla durata suggerita</span>
          </>
        ) : (
          <span className="muted">
            A questa frequenza l'obiettivo non si raggiunge: aumenta le sessioni a
            settimana o scegli un obiettivo più chiaro.
          </span>
        )}
      </div>
    </>
  );
}
