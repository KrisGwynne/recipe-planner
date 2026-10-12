import "server-only";

/** Postgres unique_violation (23505), possibly wrapped by Drizzle (error.cause). */
export function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}
