// Client-side tracking of when the user last completed a successful
// dry-run for each brief. The RunNowButton consults this state to
// decide whether to show a «no preview recent» confirmation Dialog
// before dispatching the real workflow.
//
// Storage: localStorage, key `last-dry-run:<filename>`, ISO timestamp.
// Fresh window: 10 minutes — beyond that, the user is asked to
// confirm dispatching without a recent preview.

const KEY = (filename: string) => `last-dry-run:${filename}`;
const FRESH_WINDOW_MS = 10 * 60 * 1000;

export function setLastDryRun(filename: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(filename), new Date().toISOString());
  } catch {
    // ignore — quota / unavailable storage; the worst case is the
    // user sees the «no preview» Dialog more often.
  }
}

export function isDryRunFresh(filename: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ts = window.localStorage.getItem(KEY(filename));
    if (!ts) return false;
    const ms = Date.now() - new Date(ts).getTime();
    return ms >= 0 && ms < FRESH_WINDOW_MS;
  } catch {
    return false;
  }
}
