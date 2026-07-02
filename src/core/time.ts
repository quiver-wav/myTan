// Utilità di tempo del core: conversioni minuti↔HH:MM e "adesso" nel fuso
// orario della località scelta. Gli orari del forecast sono locali al luogo,
// quindi anche il "adesso" con cui li confrontiamo deve esserlo.

export function hhmmToMinute(t: string): number {
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

export function minuteToHHMM(minute: number): string {
  const hh = Math.floor(minute / 60);
  const mm = Math.round(minute % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Data (YYYY-MM-DD) e minuto del giorno correnti nel fuso orario indicato. */
export function nowInTimezone(
  timeZone: string,
  at: Date = new Date(),
): { date: string; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = Number(get("hour")) % 24; // alcuni engine restituiscono "24" a mezzanotte
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minute: hour * 60 + Number(get("minute")),
  };
}
