/**
 * Pipedrive Sync Log Helpers
 *
 * pipedrive_sync_log.entity_id is a UUID column (Gesher entity ID) and
 * pipedrive_id is an INTEGER. Writing a Pipedrive numeric ID or a lead UUID
 * string into the wrong column makes the whole insert fail, so values are
 * normalised here before logging.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Return the value only if it is a UUID, otherwise null
 */
export function toEntityUuid(value: string | number | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  return UUID_PATTERN.test(value) ? value : null;
}

/**
 * Return the value only if it is a positive integer Pipedrive ID, otherwise null
 */
export function toPipedriveId(value: string | number | null | undefined): number | null {
  const id = typeof value === 'string' ? Number(value) : value;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
}
