/**
 * Client-Side Telemetry & Error Reporting Pipeline
 * Captures, sanitizes, throttles, and forwards client runtime diagnostics to /api/log-error.
 */

let lastReportTime = 0;
let recentReportCount = 0;
const THROTTLE_WINDOW_MS = 10000;
const MAX_REPORTS_PER_WINDOW = 6;
const reportedErrorHashes = new Set<string>();

/**
 * Checks whether an error message is benign development noise (e.g. Vite HMR/Websocket)
 */
export function isIgnoredErrorMessage(msg: string): boolean {
  if (!msg || typeof msg !== "string") return true;
  const lower = msg.toLowerCase();
  return (
    lower.includes("websocket") ||
    lower.includes("[vite]") ||
    lower.includes("hmr") ||
    lower.includes("failed to connect to websocket") ||
    lower.includes("chrome-extension://") ||
    lower.includes("moz-extension://") ||
    lower.includes("safari-extension://") ||
    lower.includes("safari-web-extension://") ||
    lower.includes("ms-browser-extension://") ||
    lower.includes("resizeobserver loop completed") ||
    lower.includes("resizeobserver loop limit exceeded")
  );
}

/**
 * Resets throttling state (useful for test suites)
 */
export function resetTelemetryThrottling(): void {
  lastReportTime = 0;
  recentReportCount = 0;
  reportedErrorHashes.clear();
}

/**
 * Dispatches a client diagnostic or uncaught error to /api/log-error with rate limiting
 */
export async function reportClientError(
  error: unknown,
  source: string = "client"
): Promise<boolean> {
  const now = Date.now();

  // Reset window count if window elapsed
  if (now - lastReportTime > THROTTLE_WINDOW_MS) {
    recentReportCount = 0;
    reportedErrorHashes.clear();
    lastReportTime = now;
  }

  // Rate limiting guard
  if (recentReportCount >= MAX_REPORTS_PER_WINDOW) {
    return false;
  }

  // Extract and format error message
  let errorText = "";
  if (error instanceof Error) {
    errorText = `${error.name}: ${error.message}${error.stack ? ` | ${error.stack.split("\n")[1] || ""}` : ""}`;
  } else if (typeof error === "string") {
    errorText = error;
  } else {
    try {
      errorText = JSON.stringify(error);
    } catch {
      errorText = String(error);
    }
  }

  errorText = errorText.trim();
  if (!errorText || isIgnoredErrorMessage(errorText)) {
    return false;
  }

  // De-duplicate identical error strings within the throttle window
  const errorKey = `${source}:${errorText}`;
  if (reportedErrorHashes.has(errorKey)) {
    return false;
  }
  reportedErrorHashes.add(errorKey);
  recentReportCount++;

  const payload = {
    error: `[${source}] ${errorText}`.slice(0, 500),
    timestamp: new Date().toISOString(),
  };

  try {
    if (typeof window === "undefined") {
      // In Node.js testing environment
      return true;
    }

    const payloadJson = JSON.stringify(payload);

    // Prefer navigator.sendBeacon for non-blocking unmount/unload resilience
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payloadJson], { type: "application/json" });
      const sent = navigator.sendBeacon("/api/log-error", blob);
      if (sent) return true;
    }

    // Fallback to fetch
    const response = await fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payloadJson,
    });
    return response.ok;
  } catch (err) {
    // Suppress secondary reporting failures to avoid cascading errors
    return false;
  }
}
