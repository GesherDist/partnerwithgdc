/**
 * Detects database errors caused by a migration that has not been applied yet,
 * so integration code can fall back or stop cleanly instead of leaving partial
 * side effects behind.
 */

export class MigrationRequiredError extends Error {
  constructor(public readonly migration: string, detail: string) {
    super(`Database migration ${migration} is required: ${detail}`);
    this.name = 'MigrationRequiredError';
  }
}

/**
 * True when `error` says that `column` does not exist (Postgres 42703, or
 * PostgREST PGRST204 "column not found in the schema cache").
 */
export function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  column: string
): boolean {
  if (!error) {
    return false;
  }
  const message = (error.message ?? '').toLowerCase();
  const missing = error.code === '42703' || error.code === 'PGRST204' || /does not exist|schema cache/.test(message);
  return missing && message.includes(column.toLowerCase());
}
