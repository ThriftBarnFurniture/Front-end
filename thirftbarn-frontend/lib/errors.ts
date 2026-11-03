/** Read messages from Error instances and structured API errors safely. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message || fallback;
  }
  return fallback;
}
