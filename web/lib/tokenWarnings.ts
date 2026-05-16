/**
 * Tunable visual signals for the "output tokens" surfaced next to
 * a brief's last-run meta — in the sidebar (BriefSidebarList) and
 * in the ExecutionMetadata card on the brief detail page.
 *
 * The intent is to let a glance at the sidebar reveal which briefs
 * have started producing larger LLM outputs without opening them
 * one by one. Adjust the thresholds and class names below to tune
 * the behaviour for the whole app at once.
 *
 * Default ladder (Cooltra calibration, 2026-05-16):
 *   ≤ 250  → no colour change (inherits the muted parent colour)
 *   > 250  → orange (warning: brief is getting wordy)
 *   > 1000 → red    (danger: brief is unusually large; consider
 *                    trimming the prompt or breaking it up)
 */

export const OUTPUT_TOKEN_WARN_THRESHOLD = 250;
export const OUTPUT_TOKEN_DANGER_THRESHOLD = 1000;

export const OUTPUT_TOKEN_WARN_CLASS = "text-orange-600";
export const OUTPUT_TOKEN_DANGER_CLASS = "text-red-600";

/**
 * Return the Tailwind colour class for a given output-token count,
 * or an empty string when no override should apply (i.e. token
 * count is below the warning threshold; the parent's colour wins).
 */
export function outputTokenColorClass(n: number): string {
  if (n > OUTPUT_TOKEN_DANGER_THRESHOLD) return OUTPUT_TOKEN_DANGER_CLASS;
  if (n > OUTPUT_TOKEN_WARN_THRESHOLD) return OUTPUT_TOKEN_WARN_CLASS;
  return "";
}
