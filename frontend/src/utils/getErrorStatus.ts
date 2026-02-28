// Extracts HTTP status code from thrown fetch errors and custom error objects.
export function getErrorStatus(err: unknown): number | undefined {
  if (err != null && typeof err === 'object' && 'status' in err) {
    const s = (err as { status?: unknown }).status
    if (typeof s === 'number') return s
  }
  return undefined
}
