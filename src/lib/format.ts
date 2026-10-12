/** "35 min", "1 hr", "1 hr 20 min". */
export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Estimated nutrition gets a ~ prefix (PP-145: never colour alone). */
export function approx(value: string, estimated: boolean): string {
  return estimated ? `~${value}` : value;
}

/** "Kris" from "Kris Gwynne"; undefined if there's no name. */
export function firstName(name: string | null | undefined): string | undefined {
  return name?.trim().split(/\s+/)[0] || undefined;
}
