/**
 * Extracts the user-friendly error message from a ConvexError or other error.
 * ConvexErrors serialized over network lose instanceof checks.
 */
export function getConvexErrorMessage(e: any, fallback: string): string {
  // ConvexError from backend (serialized with data wrapper)
  if (e?.data?.type === "ConvexError" || e?.data?.name === "ConvexError") {
    return e.data.message ?? e.message ?? fallback;
  }
  // Native JS Error or other error
  if (e?.message) {
    return e.message;
  }
  return fallback;
}
