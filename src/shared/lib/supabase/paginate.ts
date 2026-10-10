/**
 * Supabase Pagination Helpers
 *
 * PostgREST caps every response at the project's `max-rows` setting (1000 by
 * default), silently truncating larger result sets. Use these helpers for
 * queries that must see every matching row.
 */

const DEFAULT_PAGE_SIZE = 1000;

/** Safety cap: 1000 pages x 1000 rows = 1,000,000 rows */
const MAX_PAGES = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Read every row of a query, page by page.
 *
 * `buildPage(from, to)` must return the query with a stable `.order(...)` and
 * `.range(from, to)` applied. Stops at the first page shorter than `pageSize`.
 * If the server's max-rows is below `pageSize`, the first page comes back short
 * and reading stops early; callers that use the result to *delete* records
 * therefore under-delete rather than over-delete.
 */
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * pageSize;
    const { data, error } = await buildPage(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      return rows;
    }
  }

  throw new Error(`fetchAllRows exceeded ${MAX_PAGES} pages`);
}

/**
 * Split a list into chunks, e.g. to keep `.in(column, values)` filters within
 * URL length limits.
 */
export function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}
