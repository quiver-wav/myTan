// Card "Oggi": countdown alla prossima finestra, sessione LIVE da "compagna di
// spiaggia" (wake lock, anello di progresso, pausa bagno, notifica di fine),
// oppure pianificazione con slider (durata → orario di fine, sforamento, dose).

import { useEffect, useMemo, useState } from "react";
import {
  computeSessionDose,
  safeDurationFrom,
  classifySafety,
  nowInTimezone,
  hhmmToMinute,
  minuteToHHMM,
  DEFAULT_SESSION_FRACTION,
  type Forecast,
  type WeeklyPlan,
  type SessionSafety,
} from "../../core/index";
import { useStore, type ActiveSession } from "../store";

const SAFETY_TEXT = {
  safe: "Sicura — entro la soglia consigliata",
  aggressive: "Oltre il consigliato, ma sotto la scottatura",
  burn: "Rischio scottatura: stai superando la tua soglia",
} as const;

const SAFETY_COLOR: Record<SessionSafety, string> = {
  safe: "var(--safe)",
  aggressive: "var(--warn)",
  burn: "var(--danger)",
};

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(
    new Date(`${iso}T12:00:00`),
  );

const weekday = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(new Date(`${iso}T12:00:00`));

function fmtDelta(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

/** Minuti di esposizione EFFETTIVA (pause escluse) della sessione attiva. */
function exposedMinutes(active: ActiveSession, now = Date.now()): number {
  const pausedCurrent = active.pausedAt ? (now - active.pausedAt) / 60_000 : 0;
  const exposed = (now - active.startedAt) / 60_000 - (active.pausedMin ?? 0) - pausedCurrent;
  return Math.max(0, Math.round(exposed));
}

function DoseMeter({ fraction }: { fraction: number }) {
  return (
    <>
      <div className="dose-meter">
        <div className="marker" style={{ left: `${Math.min(fraction / 1.25, 1) * 100}%` }} />
      </div>
      <div className="scale">
        <span>0</span>
        <span>soglia sicura</span>
        <span>scottatura</span>
      </div>
    </>
  );
}

function SafetyRow({ fraction }: { fraction: number }) {
  const safety = classifySafety(fraction);
  return (
    <div className="row" style={{ marginTop: 12 }}>
      <span className={`pill ${safety}`}>{Math.round(fraction * 100)}% della soglia</span>
      <span style={{ fontSize: 13, textAlign: "right", maxWidth: "60%" }}>
        {SAFETY_TEXT[safety]}
      </span>
    </div>
  );
}

/**
 * Anello di progresso della sessione live: pieno = soglia sicura raggiunta.
 * Grande e ad alto contrasto, pensato per essere letto sotto il sole.
 */
function SessionRing({
  doseFraction,
  exposedMin,
  paused,
  remainingMin,
}: {
  doseFraction: number;
  exposedMin: number;
  paused: boolean;
  remainingMin: number | null;
}) {
  const R = 70;
  const C = 2 * Math.PI * R;
  const pct = Math.min(doseFraction / DEFAULT_SESSION_FRACTION, 1);
  const color = paused ? "var(--muted)" : SAFETY_COLOR[classifySafety(doseFraction)];
  const sub = paused
    ? "in pausa"
    : doseFraction >= DEFAULT_SESSION_FRACTION
      ? "soglia raggiunta!"
      : remainingMin != null
        ? `≈ ${remainingMin} min alla soglia`
        : "UV quasi nullo adesso";

  return (
    <svg viewBox="0 0 180 180" width="180" style={{ display: "block", margin: "10px auto 0" }}>
      <circle cx="90" cy="90" r={R} fill="none" stroke="var(--line)" strokeWidth="13" />
      <circle
        cx="90"
        cy="90"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - pct)}
        transform="rotate(-90 90 90)"
        style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
      />
      <text x="90" y="88" textAnchor="middle" fontSize="36" fontWeight="800" fill="var(--ink)">
        {exposedMin}′
      </text>
      <text x="90" y="112" textAnchor="middle" fontSize="12" fill="var(--muted)">
        {sub}
      </text>
    </svg>
  );
}

/** Mostra una notifica (via service worker quando c'è, es. PWA installata). */
function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const fallback = () => {
    try {
      new Notification(title, { body });
    } catch {
      /* ambiente senza Notification costruibile (iOS): pazienza */
    }
  };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => (reg ? reg.showNotification(title, { body }) : fallback()))
      .catch(fallback);
  } else {
    fallback();
  }
}

export function TodayCard({ forecast, plan }: { forecast: Forecast; plan: WeeklyPlan }) {
  const { data, update, logSession } = useStore();
  const phototype = data.phototype!.phototype;
  const today = plan.sessions[0];
  const usable = !!today && today.durationMin > 0;
  const active = data.activeSession;

  // Cronometro live: ri-render ogni 30 s quando c'è una sessione in corso.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [active]);

  // Wake lock: schermo acceso durante la sessione live, ri-acquisito quando
  // l'app torna visibile. Rilasciato automaticamente a fine sessione.
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible") {
          sentinel = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* negato dal sistema (batteria bassa, ecc.): il timer resta corretto */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [active]);

  // Durata pianificata (slider), riallineata quando cambia il suggerimento.
  const [duration, setDuration] = useState(today?.durationMin ?? 0);
  useEffect(() => {
    setDuration(today?.durationMin ?? 0);
  }, [today?.durationMin, today?.startTime, data.useSunscreen]);

  const nowLocal = nowInTimezone(forecast.timezone);
  const uvMaxToday = forecast.daily[0]?.uvIndexMax ?? 0;
  const tempAtStart = useMemo(() => {
    if (!today || today.startTime === "-") return null;
    const hh = today.startTime.slice(0, 2);
    const point = forecast.hourly.find((h) => h.time.startsWith(`${today.date}T${hh}`));
    return point ? Math.round(point.temperature) : null;
  }, [forecast, today]);

  // --- pianificazione con slider ---
  const dose = useMemo(() => {
    if (!usable || !today) return null;
    return computeSessionDose(forecast, phototype, today.date, today.startTime, duration, {
      useSunscreen: data.useSunscreen,
    });
  }, [usable, today, duration, data.useSunscreen, phototype, forecast]);

  const plannedSafe = useMemo(() => {
    if (!usable || !today) return null;
    return safeDurationFrom(forecast, phototype, today.date, today.startTime, {
      useSunscreen: data.useSunscreen,
    });
  }, [usable, today, data.useSunscreen, phototype, forecast]);

  const endTime =
    usable && today ? minuteToHHMM(hhmmToMinute(today.startTime) + duration) : "";
  const overshoot =
    plannedSafe?.reachedTarget && duration > plannedSafe.durationMin
      ? duration - plannedSafe.durationMin
      : 0;
  const alreadyLogged = !!today && data.history.some((s) => s.date === today.date);

  // Countdown alla prossima finestra (solo quando non c'è una sessione attiva).
  const minutesToWindow = usable && today ? hhmmToMinute(today.startTime) - nowLocal.minute : 0;
  const nextUsableDay = !usable
    ? plan.sessions.slice(1).find((s) => s.durationMin > 0)
    : undefined;

  // --- sessione live ---
  const exposedMin = active ? exposedMinutes(active) : 0;
  const paused = !!active?.pausedAt;
  const liveDose = useMemo(() => {
    if (!active) return null;
    return computeSessionDose(
      forecast,
      phototype,
      active.date,
      active.startTime,
      Math.min(exposedMin, 120),
      { useSunscreen: active.withSunscreen },
    );
  }, [active, exposedMin, forecast, phototype]);
  const liveSafe = useMemo(() => {
    if (!active) return null;
    return safeDurationFrom(forecast, phototype, active.date, active.startTime, {
      useSunscreen: active.withSunscreen,
    });
  }, [active, forecast, phototype]);

  const startSession = () => {
    const now = nowInTimezone(forecast.timezone);
    update({
      activeSession: {
        date: now.date,
        startTime: minuteToHHMM(now.minute),
        startedAt: Date.now(),
        withSunscreen: data.useSunscreen,
        pausedAt: null,
        pausedMin: 0,
      },
    });
    // Il permesso notifiche va chiesto su gesto utente: questo è il momento giusto.
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  };

  const pauseSession = () => {
    if (!active || active.pausedAt) return;
    update({ activeSession: { ...active, pausedAt: Date.now() } });
  };

  const resumeSession = () => {
    if (!active?.pausedAt) return;
    update({
      activeSession: {
        ...active,
        pausedAt: null,
        pausedMin: (active.pausedMin ?? 0) + (Date.now() - active.pausedAt) / 60_000,
      },
    });
  };

  const endSession = (register: boolean) => {
    if (!active) return;
    if (register) {
      const mins = Math.max(1, Math.min(exposedMinutes(active), 120));
      const d = computeSessionDose(forecast, phototype, active.date, active.startTime, mins, {
        useSunscreen: active.withSunscreen,
      });
      logSession({
        date: active.date,
        skinDoseFraction: d.skinDoseFraction,
        startTime: active.startTime,
        durationMin: mins,
        withSunscreen: active.withSunscreen,
      });
    }
    update({ activeSession: null });
  };

  // Notifica (+vibrazione) al raggiungimento della soglia sicura (pause incluse:
  // il timer riparte a ogni pausa/ripresa perché `active` cambia identità).
  useEffect(() => {
    if (!active || active.pausedAt || !liveSafe?.reachedTarget) return;
    const remaining = liveSafe.durationMin - exposedMinutes(active);
    if (remaining <= 0) return;
    const t = setTimeout(() => {
      navigator.vibrate?.(400);
      notify("myTan", "Soglia sicura raggiunta: è il momento di uscire dal sole.");
    }, remaining * 60_000);
    return () => clearTimeout(t);
  }, [active, liveSafe]);

  // Sessione rimasta aperta da un giorno precedente (app chiusa senza terminare).
  const staleActive = !!active && active.date !== nowLocal.date;

  const remainingToSafe =
    liveSafe?.reachedTarget && active
      ? Math.max(0, liveSafe.durationMin - exposedMin)
      : null;

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Oggi</h2>
        {!active && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={data.useSunscreen}
              onChange={(e) => update({ useSunscreen: e.target.checked })}
            />
            Userò la protezione
          </label>
        )}
      </div>

      {uvMaxToday >= 8 && (
        <p className="banner warn">
          UV molto alto oggi (max {Math.round(uvMaxToday * 10) / 10}): acqua, occhiali e
          cappello{tempAtStart != null ? ` · ~${tempAtStart}°C nella finestra` : ""}.
        </p>
      )}

      {staleActive && active && (
        <div className="banner">
          Hai una sessione del <b>{longDate(active.date)}</b> rimasta aperta (iniziata alle{" "}
          {active.startTime}).
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => endSession(true)}>Registrala</button>
            <button className="ghost" onClick={() => endSession(false)}>
              Scarta
            </button>
          </div>
        </div>
      )}

      {active && !staleActive && liveDose && (
        <>
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Sessione iniziata alle <b>{active.startTime}</b>
            {active.withSunscreen ? " · con protezione" : " · senza protezione"}
          </p>

          <SessionRing
            doseFraction={liveDose.skinDoseFraction}
            exposedMin={exposedMin}
            paused={paused}
            remainingMin={remainingToSafe}
          />
          <SafetyRow fraction={liveDose.skinDoseFraction} />

          {liveSafe?.reachedTarget && exposedMin >= liveSafe.durationMin && !paused && (
            <p className="banner warn">
              Soglia sicura raggiunta: esci dal sole e registra la sessione.
            </p>
          )}

          {paused && (
            <p className="banner">
              Sessione in pausa: il conteggio è fermo. Ricorda che acqua e asciugamano
              riducono la protezione — riapplica la crema prima di riprendere.
            </p>
          )}

          {active.withSunscreen && exposedMin >= 100 && !paused && (
            <p className="banner">Sei al sole da {exposedMin} min: riapplica la protezione.</p>
          )}

          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            {paused ? (
              <button className="ghost block" onClick={resumeSession}>
                Riprendi
              </button>
            ) : (
              <button className="ghost block" onClick={pauseSession}>
                Pausa bagno
              </button>
            )}
            <button className="block" onClick={() => endSession(true)}>
              Termina ({exposedMin} min)
            </button>
          </div>
        </>
      )}

      {!active && !usable && (
        <>
          <p className="muted" style={{ marginTop: 12 }}>
            {plan.goal.protectionOnly
              ? plan.summary
              : (today?.note ?? "Oggi l'UV è troppo basso per un'esposizione utile.")}
          </p>
          {!plan.goal.protectionOnly && nextUsableDay && (
            <div className="banner countdown">
              <span>
                Prossima finestra:{" "}
                <b style={{ textTransform: "capitalize" }}>{weekday(nextUsableDay.date)}</b> alle{" "}
                <b>{nextUsableDay.startTime}</b> · {nextUsableDay.durationMin} min
              </span>
            </div>
          )}
        </>
      )}

      {!active && usable && today && dose && (
        <>
          {minutesToWindow > 1 ? (
            <div className="banner countdown">
              <span>
                Prossima sessione tra <b>{fmtDelta(minutesToWindow)}</b> — alle{" "}
                <b>{today.startTime}</b> per {today.durationMin} min
              </span>
            </div>
          ) : (
            <div className="banner countdown">
              <span>
                <b>La finestra è adesso</b> — {today.durationMin} min consigliati
              </span>
            </div>
          )}

          <p className="muted" style={{ marginTop: 10, marginBottom: 4 }}>
            Finestra suggerita: <b>{today.startTime}</b> · durata consigliata{" "}
            <b>{today.durationMin} min</b> (SPF {today.recommendedSpf})
          </p>

          <div className="row" style={{ marginTop: 14 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              La tua durata · {today.startTime}–{endTime}
            </span>
            <span className="big" style={{ fontSize: 22 }}>
              {duration} min
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={120}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
          {overshoot > 0 && (
            <p className="note" style={{ marginTop: 2 }}>
              ⚠️ +{overshoot} min oltre la finestra sicura ({plannedSafe!.durationMin} min).
            </p>
          )}

          <DoseMeter fraction={dose.skinDoseFraction} />
          <SafetyRow fraction={dose.skinDoseFraction} />

          {today.note && <p className="note">{today.note}</p>}
          {data.useSunscreen && duration >= 90 && (
            <p className="note">
              Sessione lunga: riapplica la crema a metà, e dopo bagno o sudore.
            </p>
          )}

          <button className="block" style={{ marginTop: 14 }} onClick={startSession}>
            Inizia sessione ora
          </button>
          <button
            className="ghost block"
            style={{ marginTop: 6 }}
            onClick={() =>
              logSession({
                date: today.date,
                skinDoseFraction: dose.skinDoseFraction,
                startTime: today.startTime,
                durationMin: duration,
                withSunscreen: data.useSunscreen,
              })
            }
          >
            {alreadyLogged ? "Aggiorna la sessione registrata ✓" : "Registra senza timer"}
          </button>
        </>
      )}
    </div>
  );
}
