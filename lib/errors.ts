/**
 * Extracts the user-friendly error message from a ConvexError or other error.
 * ConvexErrors serialized over network lose instanceof checks.
 */
export function getConvexErrorMessage(e: any, fallback: string): string {
  if (e?.data?.message) {
    return e.data.message;
  }
  if (e?.message) {
    return e.message;
  }
  const stackLine = e?.stack?.split("\n")[0];
  if (typeof stackLine === "string" && stackLine.length > 0) {
    return stackLine;
  }
  return fallback;
}
