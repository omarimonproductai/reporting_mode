# PRD: Brief Output History (capture + storage layer)

**Status**: Draft, 2026-05-16
**Scope**: Backend / API only. UI surfacing deferred to a follow-up PRD.

---

## 1. Introduction / Overview

The Cooltra Reporting Platform generates a brief text via GROQ on every execution and posts it to Slack. Today that text lives **only in Slack** — scattered across N channels (one per brief), inaccessible to anyone without channel membership, and impossible to compare across runs.

This PRD introduces a **persistence layer**: every successful execution stores the GROQ-generated markdown alongside the existing `.run.json` artifact, and the web app gains a dedicated API endpoint to fetch the last up to 3 outputs per brief.

**Explicitly out of scope of this PRD**: any UI for showing these outputs (landing page section, per-brief history view, etc.). That comes in a follow-up PRD once data is flowing.

---

## 2. Goals

1. Every successful brief execution writes its GROQ-generated markdown to a persistent location reachable by the web app within seconds.
2. The web app can fetch the last up to 3 brief outputs for any given brief via a single dedicated endpoint.
3. No new infrastructure: the existing GitHub Actions artifact pipeline (90-day retention) carries the new files.
4. No behaviour change in the Slack publishing flow: the executor still posts to Slack exactly as today; capture is additive, never a precondition.
5. Architecture is forward-compatible with the future UI work (landing feed + per-brief history view).

---

## 3. User Stories

(These motivate the storage layer; their UI is the next PRD.)

- **As a Cooltra team member**, I want to read past brief outputs without opening Slack, so I can review or share results even when I don't have channel access.
- **As an analyst tweaking a brief's prompt**, I want to compare today's output with the last 2 runs, so I can evaluate whether my prompt change made the brief more useful.
- **As an engineer debugging the brief system**, I want to see the exact text GROQ produced for a run that failed mid-pipeline, so I can confirm whether the failure was upstream (Mode/GROQ) or downstream (Slack delivery).
- **As a new team member onboarding**, I want to browse historical outputs across all briefs, so I can understand what kind of analyses the platform produces.

---

## 4. Functional Requirements

### Capture (Python executor)

1. The `executor.py:main()` flow MUST, immediately after a successful return from `generate_brief()` and BEFORE attempting the Slack post, write the GROQ-generated markdown text to `out/<filename-slug>.brief.md`, where `<filename-slug>` is the same slug already used for `<slug>.run.json` (the YAML filename without extension).
2. The captured content MUST be the **raw markdown** returned by GROQ (the value before `markdown_to_slack()` conversion). No Slack-mrkdwn transformations applied; no extra wrapping.
3. The file MUST be written as UTF-8 plain text with a trailing newline.
4. If `generate_brief()` raises or returns no text, NO `.brief.md` file is created. The executor MUST continue to write its `.run.json` record as today (status `failed` or `success` per existing logic) and MUST NOT block the Slack post on `.brief.md` write failures.
5. If writing the `.brief.md` file itself fails (e.g., disk error), the executor MUST log a warning and continue the Slack post. The `.brief.md` write is **best-effort**, not a precondition.

### Artifact upload (GitHub Actions workflows)

6. `.github/workflows/run-brief.yml` MUST extend its `actions/upload-artifact` step's `path:` glob to also include `out/*.brief.md` alongside `out/*.run.json`. Artifact name stays `run-<slug>-<run_id>`. Retention stays 90 days.
7. `.github/workflows/run-due-briefs.yml` MUST extend its artifact upload similarly. Artifact name stays `runs-due-<timestamp>-<run_id>`. Retention stays 90 days. A single scheduler tick may produce multiple `.brief.md` files (one per due brief that successfully generated text), all packaged into the same artifact zip.

### Web app — typed access layer

8. The web app MUST gain a new server-only library function `fetchLatestBriefOutputs(slug, limit = 3)` in `web/lib/outputs.ts`. (A new file is chosen over extending `web/lib/runs.ts` for clarity of responsibility — see §7 Technical Considerations.)
9. The function MUST iterate over the most recent artifacts (using the existing GitHub Actions Artifacts API, same patterns `run-*` and `runs-due-*` already used by `fetchLatestRuns`) and extract `<slug>.brief.md` entries when present, returning at most `limit` entries (default 3) sorted by artifact `created_at` descending.
10. Each returned entry MUST contain at minimum:
    - `markdown: string` — the raw GROQ markdown.
    - `created_at: string` — ISO timestamp from the artifact (i.e., approximately when the run finished).
    - `artifact_name: string` — the GitHub artifact name for traceability.
    - `run_status: "success" | "failed"` — cross-referenced from the same artifact's `<slug>.run.json`.

### Web app — public API endpoint

11. A new endpoint `GET /api/briefs/[name]/outputs` MUST be added. It returns a JSON payload `{ outputs: BriefOutput[] }` where `BriefOutput` matches the shape from §10.
12. The endpoint MUST verify the brief exists via `readBrief(name)` and return `404` with `{ error: "Brief no trobat" }` if not — same convention as the existing per-brief endpoints (`/api/briefs/[name]/run`, `/api/runs/[brief]`).
13. The endpoint MUST cap its response at 3 entries even if more are available within the 90-day window.
14. The endpoint MUST cache results in memory for 5 minutes using a `Map<slug, { fetchedAt, data }>` keyed by brief slug — same pattern as `/api/runs/[brief]`. The `?force=true` query parameter busts the cache.
15. On upstream failure (artifact list or zip download errors), the endpoint MUST return `502` with `{ error: "..." }` carrying the upstream message.

### Behaviour & semantics

16. The "max 3" cap is **read-time only**. The executor and workflows never delete artifacts. Artifacts naturally expire after the 90-day GitHub-Actions retention. For monthly briefs this happens to give exactly 3 runs (3 × 30d ≈ 90d); for higher-frequency briefs only the 3 most recent are surfaced via the API.
17. The capture is idempotent within a single executor run — running the executor twice on the same brief produces two separate runs, each with its own artifact bundle, so no file-level idempotency logic is required.
18. Brief outputs are accessible to any user who can reach the web app. No per-brief access control. (This matches user decision Q5.A: same level as the rest of the platform. A future OAuth integration is anticipated platform-wide but is out of scope here.)

---

## 5. Non-Goals (Out of Scope)

- **UI surfacing**. No landing-page section, no `/feed` page, no embed in the brief detail view. Follow-up PRD.
- **Permanent history beyond 90 days**. We accept the GitHub Actions retention limit. Long-term archival (S3 / repo commits / external DB) is a separate decision and not in scope.
- **Search across outputs**. Free-text search through brief markdown is not in this PRD.
- **Per-brief opt-out**. Every successful run captures its output; we don't expose a YAML flag like `surface_in_feed: false`.
- **Capture of CSV thread replies**. CSV files continue to go only to Slack thread; they are not archived in the artifact bundle.
- **Re-derivation of the Slack-formatted text**. The web app stores raw markdown; the Slack-mrkdwn version is only ever produced in-line by the executor before the Slack post. We do not store both.
- **Comparing / diffing outputs in the API**. Each entry is returned standalone.
- **Removal of `.run.json` from failed runs**. Failed runs continue to produce a `.run.json` with status `failed` and no `.brief.md`. The future UI will surface this as "sense output capturat".

---

## 6. Design Considerations

Not applicable. This PRD is backend-only; no design surface.

A future UI PRD will pick up the rendering decisions (`react-markdown` library, layout, cross-linking from the brief detail view, output diffing, etc.).

---

## 7. Technical Considerations

### File naming

- The slug is the YAML filename without extension (e.g., `app-version-adoption` for `briefs/app-version-adoption.yml`).
- The extension `.brief.md` mirrors the existing `.run.json` convention and stays grep-friendly inside the artifact zip.

### Artifact prefixes

Two prefixes exist today and both must carry `.brief.md`:

| Prefix | Source | Contents |
|---|---|---|
| `run-<slug>-<run_id>` | `run-brief.yml` (manual / API dispatched) | One `.run.json` (and now one `.brief.md` if GROQ succeeded). |
| `runs-due-<timestamp>-<run_id>` | `run-due-briefs.yml` (scheduled scanner) | One `.run.json` per fired brief (and now one `.brief.md` per brief that produced text). |

The web `fetchLatestBriefOutputs` MUST handle both prefixes, mirroring the existing `fetchLatestRuns` in `web/lib/runs.ts`.

### Cache strategy

5-minute in-memory cache at the API route, same as `/api/runs/[brief]`. Module-level `Map` lives per Vercel function instance — acceptable for an internal tool of this scale.

### Markdown encoding

GROQ may return markdown with non-ASCII characters (Catalan / Spanish accents, emojis). The executor MUST write the file as UTF-8 without BOM. The web app reads as UTF-8 via `zip.file().async("string")` (JSZip default).

### Failure isolation

The `.brief.md` write is best-effort. The executor's existing `try / except BaseException / finally` envelope already ensures `.run.json` is always written; we extend it so that a `.brief.md` write failure logs a warning but does NOT alter the executor's exit code or its Slack-post path.

### Why a new lib file (`outputs.ts`) instead of extending `runs.ts`

Each module gets ONE responsibility:
- `lib/runs.ts` answers "what's the latest run record for brief X?" — singular, metadata-only.
- `lib/outputs.ts` answers "what are the last N output markdowns for brief X?" — collection, content-heavy.

Sharing the artifact-listing primitive between them is a code-organisation concern the implementer can address by extracting a helper if it becomes duplicative.

### Dependencies

No new Python or JS dependencies. Python uses standard `open()`. The web app already depends on JSZip for the same artifact extraction.

---

## 8. Success Metrics

1. **Capture rate**: 100% of successful runs (GROQ returned text + Slack post succeeded) produce a `.brief.md` file alongside the `.run.json`. Verifiable by inspecting recent artifacts on GitHub.
2. **Endpoint response time**: `GET /api/briefs/[name]/outputs` returns 3 outputs in <2s P95 (cold cache), <50ms P95 (warm cache). Acceptable given internal-tool scale.
3. **Zero regression**: existing brief executions still publish to Slack with no observable change in latency or content. Verifiable by comparing pre/post artifact timestamps and Slack messages on a known brief.
4. **Forward-compat for UI**: the `BriefOutput` response shape is sufficient for the (future) landing feed + per-brief history view without additional fields. Confirmable by paper-prototyping both UIs against the schema and noting no gaps.

---

## 9. Open Questions

1. **Should `.brief.md` include any frontmatter** (e.g., `---\nbrief: app-version-adoption\nrun_id: 12345\nfinished_at: 2026-05-16T10:00:00Z\n---`)? The current proposal is pure markdown body, relying on the colocated `.run.json` and the artifact `created_at` for metadata. Frontmatter would make the file self-describing if inspected outside the artifact context (e.g., manual download for debugging). Defer to implementer; both are defensible.
2. **Order of operations**: should `.brief.md` be written BEFORE or AFTER the Slack post? FR #1 currently specifies BEFORE — captures more in failed-Slack scenarios. If we ever decide we only care about content that actually reached Slack, this can flip to AFTER.
3. **Future archival**: when (if ever) the team needs > 90-day history, the natural extension is committing each captured `.brief.md` to a `history/<brief>/<timestamp>.md` path on `main` from a follow-up step in the workflow. Not in scope, noted for future planning.
