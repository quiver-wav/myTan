// Grafico del progresso: abbronzatura nel tempo.
// - linea piena = andamento reale dalle sessioni registrate
// - linea tratteggiata = proiezione futura seguendo le durate suggerite
// - linea orizzontale = obiettivo

interface Point {
  date: string;
  tan: number;
}

interface Props {
  ceiling: number;
  target: number;
  todayDate: string;
  history: Point[];
  future: Point[];
}

// Variabili CSS del design system: il grafico segue tema chiaro/scuro da solo.
const COL = {
  sun: "var(--sun)",
  sunDark: "var(--sun-deep)",
  ink: "var(--ink)",
  line: "var(--line)",
  muted: "var(--muted)",
};

const W = 320;
const H = 150;
const PAD = { l: 10, r: 10, t: 12, b: 22 };

function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  return Math.round((db - da) / 86_400_000);
}

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(
    new Date(`${iso}T12:00:00`),
  );

export function ProgressChart({ ceiling, target, todayDate, history, future }: Props) {
  const all = [...history, ...future];
  if (all.length === 0) return null;

  const startDate = all.reduce((m, p) => (p.date < m ? p.date : m), all[0]!.date);
  const endDate = all.reduce((m, p) => (p.date > m ? p.date : m), all[0]!.date);
  const span = Math.max(1, daysBetween(startDate, endDate));
  const yMax = Math.max(ceiling, target) || 1;

  const x = (date: string) =>
    PAD.l + (daysBetween(startDate, date) / span) * (W - PAD.l - PAD.r);
  const y = (tan: number) =>
    PAD.t + (1 - Math.min(tan / yMax, 1)) * (H - PAD.t - PAD.b);

  const toPath = (pts: Point[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.date).toFixed(1)} ${y(p.tan).toFixed(1)}`).join(" ");

  const todayX = x(todayDate);
  const targetY = y(target);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Grafico del progresso">
      {/* obiettivo */}
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={targetY}
        y2={targetY}
        stroke={COL.ink}
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <text x={W - PAD.r} y={targetY - 4} textAnchor="end" fontSize="9" fill={COL.ink}>
        obiettivo
      </text>

      {/* oggi */}
      <line x1={todayX} x2={todayX} y1={PAD.t} y2={H - PAD.b} stroke={COL.line} strokeWidth={1} />
      <text x={todayX} y={H - PAD.b + 12} textAnchor="middle" fontSize="9" fill={COL.muted}>
        oggi
      </text>

      {/* proiezione futura */}
      {future.length > 0 && (
        <path d={toPath(future)} fill="none" stroke={COL.sun} strokeWidth={2} strokeDasharray="4 3" />
      )}

      {/* andamento reale */}
      {history.length > 0 && (
        <path d={toPath(history)} fill="none" stroke={COL.sunDark} strokeWidth={2.5} />
      )}
      {history.map((p) => (
        <circle key={p.date} cx={x(p.date)} cy={y(p.tan)} r={3} fill={COL.sunDark} />
      ))}

      {/* etichetta di sinistra solo se l'inizio è ben prima di oggi (evita sovrapposizione con "oggi") */}
      {daysBetween(startDate, todayDate) > 1 && (
        <text x={PAD.l} y={H - PAD.b + 12} fontSize="9" fill={COL.muted}>
          {shortDate(startDate)}
        </text>
      )}
      <text x={W - PAD.r} y={H - PAD.b + 12} textAnchor="end" fontSize="9" fill={COL.muted}>
        {shortDate(endDate)}
      </text>
    </svg>
  );
}
