/**
 * Extracts the user-friendly error message from a ConvexError or other error.
 * ConvexErrors serialized over network lose instanceof checks.
 */
export function getConvexErrorMessage(e: any, fallback: string): string {
  // Try to extract message from various possible shapes
  return (
    // ConvexError with data wrapper
    e?.data?.message ??
    e?.data?.name === "ConvexError" && e?.data?.message ??
    // Standard error object
    e?.message ??
    // Error stack contains message
    (e?.stack?.split("\n")[0] ?? fallback) ??
    fallback
  );
}
