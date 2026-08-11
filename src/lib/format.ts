export function num(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

export function compact(n: number | null): string {
  if (n === null) return "—";
  if (n >= 10_000)
    return Intl.NumberFormat("en-GB", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  return Intl.NumberFormat("en-GB").format(n);
}

export function multiple(n: number | null): string {
  if (n === null) return "—";
  return n >= 10 ? `${Math.round(n)}×` : `${n.toFixed(1)}×`;
}

export function age(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 70) return `${Math.round(days / 7)} wks`;
  return `${Math.round(days / 30.4)} mos`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  });
}

export function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}
