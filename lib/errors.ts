/**
 * Extracts the user-friendly error message from a ConvexError or other error.
 * ConvexErrors serialized over network lose instanceof checks.
 * When the server throws `new ConvexError("string")`, the client's `error.data`
 * is that plain string, while `error.message` is the technical
 * "[Request ID: ...] Server Error" wrapper.
 */
export function getConvexErrorMessage(e: any, fallback: string): string {
  if (typeof e?.data === "string" && e.data.length > 0) {
    return e.data;
  }
  if (typeof e?.data?.message === "string" && e.data.message.length > 0) {
    return e.data.message;
  }
  if (typeof e?.message === "string" && e.message.length > 0) {
    return e.message;
  }
  const stackLine = e?.stack?.split("\n")[0];
  if (typeof stackLine === "string" && stackLine.length > 0) {
    return stackLine;
  }
  return fallback;
}
