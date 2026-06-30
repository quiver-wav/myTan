import { useEffect, useMemo, useState } from "react";
import {
  getForecast,
  buildWeeklyPlan,
  computeSessionDose,
  projectRemaining,
  cumulativeTanByDate,
  getGoal,
  type Forecast,
} from "../../core/index";
import { useStore } from "../store";
import { ProgressChart } from "./ProgressChart";

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

function safetyOf(fraction: number): "safe" | "aggressive" | "burn" {
  if (fraction >= 1.0) return "burn";
  if (fraction > 0.83) return "aggressive";
  return "safe";
}

export function Dashboard() {
  const { data, update, reset, removeSession } = useStore();
  const phototype = data.phototype!.phototype;
  const goalId = data.goalId!;
  const location = data.location!;

  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const plan = useMemo(
    () =>
      forecast
        ? buildWeeklyPlan(forecast, phototype, goalId, { useSunscreen: data.useSunscreen })
        : null,
    [forecast, phototype, goalId, data.useSunscreen],
  );

  const projection = useMemo(
    () =>
      projectRemaining(phototype, goalId, data.history, {
        sessionsPerWeek: data.sessionsPerWeek,
      }),
    [phototype, goalId, data.history, data.sessionsPerWeek],
  );

  const goal = getGoal(goalId);
  const todayDate = forecast?.daily[0]?.date ?? "";

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
        <button className="ghost" onClick={reset}>
          Ricomincia
        </button>
      </div>

      {!forecast && !error && <div className="spinner">Carico i dati UV di {location.name}…</div>}
      {error && <div className="card">{error}</div>}

      {forecast && plan && (
        <>
          <TodayCard forecast={forecast} plan={plan} />

          <div className="card">
            <h2>Il tuo obiettivo: {goal.label}</h2>
            <ProgressView projection={projection} />
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
                  </span>
                  <span>
                    <span className={`pill ${safetyOf(s.skinDoseFraction)}`}>
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
                    <span className="uv">UV medio {s.avgUv} · SPF {s.recommendedSpf}</span>
                  </span>
                ) : (
                  <span className="uv">UV troppo basso</span>
                )}
              </div>
            ))}
            <p className="note">{plan.summary}</p>
          </div>

          <button className="ghost block" onClick={() => update({ goalId: null })}>
            Cambia obiettivo
          </button>
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

function TodayCard({ forecast, plan }: { forecast: Forecast; plan: ReturnType<typeof buildWeeklyPlan> }) {
  const { data, update, logSession } = useStore();
  const today = plan.sessions[0];
  const usable = !!today && today.durationMin > 0;

  const [duration, setDuration] = useState(today?.durationMin ?? 0);
  useEffect(() => {
    setDuration(today?.durationMin ?? 0);
  }, [today?.durationMin, today?.startTime, data.useSunscreen]);

  const dose = useMemo(() => {
    if (!usable || !today) return null;
    return computeSessionDose(forecast, data.phototype!.phototype, today.date, today.startTime, duration, {
      useSunscreen: data.useSunscreen,
    });
  }, [usable, today, duration, data.useSunscreen, data.phototype, forecast]);

  const alreadyLogged = !!today && data.history.some((s) => s.date === today.date);

  const safetyText = {
    safe: "Sicura — entro la soglia consigliata",
    aggressive: "Oltre il consigliato, ma sotto la scottatura",
    burn: "Rischio scottatura: stai superando la tua soglia",
  };

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Oggi</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={data.useSunscreen}
            onChange={(e) => update({ useSunscreen: e.target.checked })}
          />
          Userò la protezione
        </label>
      </div>

      {!usable && (
        <p className="muted" style={{ marginTop: 12 }}>
          Oggi l'UV è troppo basso per un'esposizione utile. Riprova in una giornata
          più soleggiata.
        </p>
      )}

      {usable && today && dose && (
        <>
          <p className="muted" style={{ marginTop: 10, marginBottom: 4 }}>
            Finestra suggerita: <b>{today.startTime}</b> · durata consigliata{" "}
            <b>{today.durationMin} min</b> (SPF {today.recommendedSpf})
          </p>

          <div className="row" style={{ marginTop: 14 }}>
            <span className="muted" style={{ fontSize: 13 }}>La tua durata</span>
            <span className="big" style={{ fontSize: 22 }}>{duration} min</span>
          </div>
          <input
            type="range"
            min={0}
            max={120}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />

          <div className="dose-meter">
            <div
              className="marker"
              style={{ left: `${Math.min(dose.skinDoseFraction / 1.25, 1) * 100}%` }}
            />
          </div>
          <div className="scale">
            <span>0</span>
            <span>soglia sicura</span>
            <span>scottatura</span>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <span className={`pill ${dose.safety}`}>
              {Math.round(dose.skinDoseFraction * 100)}% della soglia
            </span>
            <span style={{ fontSize: 13, textAlign: "right", maxWidth: "60%" }}>
              {safetyText[dose.safety]}
            </span>
          </div>

          {today.note && <p className="note">{today.note}</p>}

          <button
            className="block"
            style={{ marginTop: 14 }}
            onClick={() =>
              logSession({ date: today.date, skinDoseFraction: dose.skinDoseFraction })
            }
          >
            {alreadyLogged ? "Aggiorna sessione di oggi ✓" : "Registra sessione di oggi"}
          </button>
        </>
      )}
    </div>
  );
}

function ProgressView({ projection }: { projection: ReturnType<typeof projectRemaining> }) {
  const pctOfCeiling = projection.ceiling > 0 ? projection.currentTan / projection.ceiling : 0;
  const targetPct = projection.ceiling > 0 ? projection.targetTan / projection.ceiling : 0;

  return (
    <>
      <div className="bar" style={{ position: "relative" }}>
        <span style={{ width: `${Math.min(pctOfCeiling, 1) * 100}%` }} />
        <div
          style={{
            position: "absolute",
            top: -3,
            left: `${Math.min(targetPct, 1) * 100}%`,
            width: 3,
            height: 18,
            background: "#3a2e1f",
          }}
          title="obiettivo"
        />
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Abbronzatura attuale {Math.round(pctOfCeiling * 100)}% · l'asticella scura è il
        tuo obiettivo.
      </p>
      <div style={{ marginTop: 8 }}>
        {projection.reachedGoal && projection.daysNeeded === 0 ? (
          <span className="big">Obiettivo raggiunto! 🎉</span>
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
