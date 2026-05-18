# PRD: Online Brief Management Platform

## 1. Introduction / Overview

Cooltra's reporting platform today consists of a set of YAML files in this repository (`briefs/*.yml`), executed by a Python script via GitHub Actions, with a read-only static dashboard published to GitHub Pages. Creating or editing a brief currently requires editing YAML files on GitHub — a barrier for non-technical users.

This feature replaces the static dashboard with a **self-service web application** where any Cooltra user can create, edit, and monitor reporting briefs through a friendly UI, with **zero git knowledge required**. The platform follows a Product-Led Growth (PLG) philosophy: every field is self-explanatory through inline help, so users can be productive without onboarding.

The data layer stays hybrid: briefs continue to be persisted as YAML files in this repository (committed via the GitHub API from the web app), while a future migration to a database is planned for when per-user isolation is introduced.

**Goal**: enable anyone at Cooltra to manage reporting briefs through a web UI, while preserving the existing GitHub-Actions-driven execution and Slack delivery pipeline.

## 2. Goals

1. A non-technical Cooltra employee can create their first brief within 5 minutes of opening the URL, without external help.
2. Every brief in `briefs/*.yml` is visible, viewable, and editable through the web UI without git operations.
3. Each brief shows its last execution status, timestamp, and token consumption (input + output) at a glance.
4. The schedule editor allows expressing any common schedule (daily / weekly / monthly / specific days at specific times) without ever typing cron syntax.
5. The platform runs entirely on free infrastructure tiers; expected monthly cost is **0 €** at current usage.
6. The data model accommodates a future per-user brief ownership without breaking changes.

## 3. User Stories

- **As a product analyst**, I open the platform URL, see the list of existing briefs in a sidebar, click one, and read its prompt and configuration in a panel on the right.
- **As a product analyst creating my first brief**, I click "+ New brief", fill in the form (with each field accompanied by a short inline description of what's expected), pick a schedule from a visual calendar-style selector, and save — without ever knowing what cron syntax is.
- **As an operations lead**, I open the platform and at a glance see which briefs ran today, which failed, and how many tokens each one consumed.
- **As a member of the data team**, I open the calendar view and visually see at which times during the week each brief is scheduled to run, to spot collisions or plan capacity.
- **As an engineer debugging an unexpected output**, I see in a small unobtrusive footer the latest git commit that the platform's executor is running, with its timestamp in local Cooltra time, so I can correlate a behavior change with a deploy.
- **As a future user with auth enabled** (out of scope today), my own briefs appear at the top of the sidebar, while shared ones are below.

## 4. Functional Requirements

### Layout & Navigation

1. The application MUST present a **persistent lateral sidebar** on the left containing the list of existing briefs.
2. The sidebar MUST include a **prominent "+ New brief" button positioned above the list**.
3. Each item in the sidebar list MUST display: the brief's `name`, the time and status of its last execution, and a small badge with the total tokens consumed (formatted as `input + output`, e.g. `1.2k + 0.4k`).
4. Clicking a brief in the sidebar MUST open its detail/edit view in the main content area.
5. The application MUST have a **navigation entry "Calendar"** that opens the calendar view (see §4.6).

### Brief List & Detail View

6. The main content area for a brief MUST present every field of the brief as an editable form: `name`, `schedule`, `slack_channel`, optional `reference_link` (URL appended to the Slack message), list of `sources` (each with `mode_report_token` and list of queries — each query being `{token, csv}`), and `prompt`. The `timezone` field has been removed from the data model; the company runs in a single TZ (`Europe/Madrid`, displayed as "Catalunya") hardcoded in the Python scheduler.
7. **Each field MUST have an adjacent inline description** explaining what the field is for, the expected format, and a concrete example. The description MAY be expanded/collapsed but is visible by default for a new user (PLG: no onboarding needed).
8. The `prompt` field MUST be a multi-line text area with monospace font and visible line wrapping, sized to comfortably show ~20 lines without scrolling.
9. The application MUST allow the user to add and remove **sources** dynamically (rows of the form).
10. For each query within a source, the application MUST allow the user to **enable or disable CSV attachment to Slack** independently (this replaces the current per-brief `csv` flag). The default is `false`.
10a. ~~**Early-data freshness warning**~~ **WITHDRAWN 2026-05-16**: this requirement (added 2026-05-16 during the 4.x polish bundle) called for an amber Alert above the ExecutionMetadata card before 10:00 local Catalunya time, warning users that the daily Mode data dump might not yet be complete. Removed at user request — in practice scheduled briefs run after 10:00 and users dispatching Run Now already know the data-freshness state, so the alert was noise rather than signal. Component file `EarlyDataWarning.tsx` and its mount on `/briefs/[name]` removed in the same change that closed task 12.0 (PR #48).
10b. **Reference link** (added 2026-05-16): each brief MUST have an optional `reference_link` field — a URL surfaced in the Slack message so recipients can click through to the original data source / additional context. UI rules:
    - Optional input (no asterisk) inside the **Content** section, below Prompt.
    - Validation: empty OR a string starting with `http://` / `https://`.
    - YAML: emitted only when non-empty.
    - Slack rendering: when present, the executor appends a new line at the end of the message body in the form `🔗 <URL|Reference link>` (Slack mrkdwn syntax for a labelled clickable link). When absent, nothing is appended.

### Slack Channel Selection

11. The `slack_channel` field MUST be a **searchable dropdown** populated from a live list of Slack workspace channels (the option list comes from the Slack API at runtime; details in §7).
12. The dropdown MUST allow **typeahead search** to filter by channel name. When the list exceeds ~10 entries, search becomes the primary discovery affordance.
13. By default, the dropdown options MUST be **only channels where the bot is currently a member** (so the user picks among valid destinations without thinking about invites).
14. The user MUST still be allowed to **type a channel name that is not in the dropdown** (e.g., a channel created moments ago, or one where the bot was just invited). The save action does NOT block on dropdown membership.
15. When the user selects (or types) a channel where the bot is NOT currently a member, the platform MUST display a **non-blocking inline warning** below the field, containing:
    - A clear explanation that the bot must be in the channel to publish.
    - A code snippet `/invite @<bot-name>` with a **"Copy" button** that puts it on the user's clipboard.
    - A subtle "Refresh" link that re-queries the channel list (so once the user invites the bot, they can confirm and dismiss the warning without page reload).
16. A **"Refresh channels" affordance** (icon button next to the dropdown) MUST force-bust the server-side channel cache and re-render the list. This handles the case where an admin invites the bot to a new channel and wants to see it appear immediately.
17. **Save MUST always proceed** even when the warning is shown — the user has been informed of the consequence. Runtime delivery will fail loudly with the existing executor error path if the bot is still not in the channel at execution time.

### Schedule Editor

18. The schedule MUST be set through a **visual builder** (no raw cron typing required in the default flow). The builder allows the user to specify:
    - The frequency: every day, specific days of the week, specific day of the month, or every N hours.
    - The time(s) of day (HH:MM, in 15-minute increments).
    (Time zone is not configurable — see §6 "No per-brief Time Zone field". The builder labels times as Catalunya local.)
19. The visual builder MUST emit a **valid cron expression** persisted to the YAML, plus a human-readable description shown to the user (e.g., "Cada dimarts a les 10:00 hora local Cooltra").
20. The visual builder MAY include a small "Advanced: edit cron directly" toggle for power users; this is a stretch goal, not a v1 requirement.

### Manual Test Runs (added 2026-05-16 after user feedback)

T1. The brief detail view MUST expose a **"Run Now" button** at the **top of the form** (above the Brief Name field), prominent so users can fire an on-demand execution with one click. The button triggers the same GitHub Actions workflow used by the schedule (`run-brief.yml`, `workflow_dispatch`). The button is also rendered on the new-brief page but **disabled until the brief has been saved** (a tooltip / hint on the disabled state explains: «Crea el brief abans de poder executar-lo» or equivalent). Once the brief exists, "Run Now" becomes enabled (subject to the cooldown in T2).
T2. To prevent Slack spam and runaway token consumption, the platform MUST enforce a **cooldown of 2 minutes per brief between Run Now dispatches**:
    - **Client-side**: after a successful dispatch, the button stays disabled for 120 seconds and displays a countdown (e.g. `Run Now — torna a provar en 1:42`).
    - **Server-side**: the API endpoint MUST reject a second dispatch for the same brief within 120 seconds with HTTP 429 and a `retry_after_seconds` body. The state is in-memory in the serverless function; cross-instance accuracy is best-effort.
T3. On a successful dispatch the platform MUST toast a confirmation and, if available, link to the GitHub Actions run page so the user can monitor progress.
T4. Adding the Run Now button requires extending the platform's GitHub PAT scope to include `actions:write` (currently only `contents:write` + `metadata:read`). This is a manual operator action documented in the rollout runbook.

### Per-Brief Execution Metadata

21. The detail view MUST display, prominently and above the editable form:
    - The **timestamp** of the last execution (in local Cooltra time, with a tooltip showing the UTC original).
    - The **status** of the last execution (success / failed / never run), color-coded.
    - The **tokens consumed** in that last execution, split as **input** and **output** if available, otherwise total.
22. If the brief has never run, the section MUST display "Mai executat" (or equivalent) rather than empty.
22a. **Artifact id placement** (updated 2026-05-17): the GitHub Actions artifact name backing the last run (e.g. `run-analitza-els-vlt-25977621231`) MUST NOT clutter the headline card alongside status/timestamp/tokens. Move it to a small «Debug info» block pinned to the bottom of the brief detail page, in font-mono `text-zinc-400` text, only rendered when a run record is available. Useful for the occasional case of opening the artifact directly on GitHub Actions; invisible to anyone not specifically looking for it. Implementation: a tiny `BriefDebugFooter` client component that fetches `/api/runs/[brief]` independently of the card.

### Calendar View

23. ~~The calendar view MUST display a **weekly grid** (Monday → Sunday columns, 24h rows or compressed by hour blocks) showing every scheduled brief as a colored event at its scheduled time.~~ **Revised in MVP scope (2026-05-16): the `/schedule` page is a simple table, not a weekly grid.** Each row is one brief; columns are `Brief`, `Proper enviament` (next fire time), `Schedule` (humanised cron), `Última run` (status + timestamp). The weekly-grid aspiration is dropped for now — the operational team validated that "next fire time in a sortable list" answers their questions without a calendar metaphor.
24. Clicking the brief name MUST open the corresponding brief's detail view.
25. The schedule view MUST interpret every cron in `Europe/Madrid` (the operational timezone of Cooltra). Timestamps are rendered in Catalunya local time via `Intl.DateTimeFormat("ca-ES", { timeZone: "Europe/Madrid" })`.
26. **Sortable columns** (added 2026-05-16, requirement 9.0): three of the four columns are sortable by clicking the column header:
    - `Brief` — alphabetical (locale `ca`). Default direction ASC.
    - `Proper enviament` — by next-fire timestamp. Default direction ASC (soonest first). Default landing sort.
    - `Última run` — by the moment of the last run. Default direction DESC (most recent first).
    Clicking the **active** column header toggles ASC ↔ DESC; clicking a different column changes the sort criterion and resets to that column's default direction. Briefs missing a sort value (no valid cron for `Proper enviament`; `Mai executat` for `Última run`) always sink to the bottom regardless of direction. Tiebreak inside a partition is alphabetical by brief name. Sort state does not persist across visits (each load returns to default `Proper enviament` ASC).
26a. The `Última run` cell MUST surface both the status (`✓ Èxit` / `✗ Error` / `Mai executat`) and, when applicable, the **moment of the last run** as a two-line cell — top line is the status with its colour-coded icon, bottom line is «fa Xh · HH:MM ds DD/MM» in font-mono muted, matching the visual rhythm of the `Proper enviament` column on the left.

### Persistence & Synchronization

27. **Reads** of brief content MUST come from the canonical source: the `briefs/*.yml` files in this repository, fetched via the GitHub API.
28. **Writes** (create, update, delete a brief) MUST go through a **serverless backend endpoint** that uses the GitHub API to commit the change to the `main` branch of this repository.
29. The commit author for changes made through the platform MUST be a service identity (e.g., `cooltra-reporting-bot`), with a commit message that describes the change (e.g., `Update brief: app-version-adoption`).
30. After a successful write, the platform MUST display a confirmation toast and the new state of the brief MUST be reflected in the UI within 5 seconds (after the API returns).
31. Concurrent edits to the same brief MUST be detected (compare the commit SHA the user started from with the current SHA); a conflict MUST be reported with a "your version vs the current version" comparison.

### Execution Tracking

32. Each execution of a brief by GitHub Actions MUST publish a small JSON artifact containing: brief name, start time, end time, status, input tokens, output tokens, and any error message.
33. The web app MUST read these artifacts via the GitHub Actions API to render the per-brief execution metadata (§4.21).
34. If the latest artifact is older than 95 days (GitHub's retention limit), the application MUST display "Cap execució recent registrada" gracefully.

### Footer / Version Information

35. The application MUST display, **discretely** at the bottom of every page (in a small footer in muted color), the short SHA and message of the latest commit on `main`, plus the timestamp of that commit converted to **local Cooltra time** (Europe/Madrid).
36. This footer information MUST come from the GitHub API at page load time.

### Schema Migration

37. The existing briefs (`briefs/fraude-bikes-unit-economics.yml`, `briefs/app-version-adoption.yml`) MUST be migrated to the new schema where `csv` lives at the query level rather than the brief level. The migration is one-time and committed as part of the rollout. **The `slack_channel` field stays at the brief level** (no per-query channel override in this version — see Non-Goals).

### Mode space catalog (future requirement)

38. The `mode_report_token` and `queries[].token` form fields MUST eventually be replaced by name-based comboboxes populated from the Cooltra Mode space (`https://app.mode.com/ecooltra706/spaces/9d367a761ba1`). The user picks reports / queries by their human-readable name; the YAML still stores the underlying tokens. Implementation tracked as task 8.0; deferred for now. The current free-text inputs remain functional as the fallback path even after the comboboxes ship (Mode API down / token not in catalog / etc.).

### Brief output history (future capability)

The platform produces brief content that lives **only in Slack** — scattered across multiple channels (one per brief), inaccessible to anyone without channel access, and impossible to compare across runs. A future capability captures every successful GROQ output and surfaces the last N entries per brief through the web app. The first iteration is **backend-only** (capture + storage + API); the UI shape for surfacing these outputs (landing feed, per-brief history view, or combination) is a separate decision to make once data is flowing.

39. Every successful brief execution MUST produce a `out/<filename-slug>.brief.md` file containing the **raw markdown returned by GROQ** (the value before `markdown_to_slack()` conversion). The capture is best-effort and never blocks the Slack post: a failure to write `.brief.md` MUST be logged as a warning, never raised; the executor's `.run.json` and Slack post continue as today.
40. Failed runs (where GROQ produced no text — Mode failure, GROQ exception, etc.) MUST NOT produce a `.brief.md`. The future UI surfaces these as "sense output capturat" alongside the existing `failed` status.
41. Both GitHub Actions workflows (`run-brief.yml`, `run-due-briefs.yml`) MUST extend their `actions/upload-artifact` glob to include `out/*.brief.md` alongside `out/*.run.json`. Artifact names, prefixes (`run-*` / `runs-due-*`) and 90-day retention remain unchanged.
42. A new endpoint `GET /api/briefs/[name]/outputs` MUST return up to **3** most-recent brief outputs as `{ outputs: BriefOutput[] }`, where each entry is `{ markdown, created_at, artifact_name, run_status }`. The endpoint MUST reuse the existing artifact-listing primitives (same patterns used by `/api/runs/[brief]`), validate the brief exists via `readBrief` (404 otherwise), cache results in memory for 5 minutes (bustable via `?force=true`), and return 502 with the upstream message on Mode / GitHub failure.
43. The "max 3 outputs per brief" cap is **read-time only**. Artifacts are never deleted by us; they expire naturally after the 90-day GitHub Actions retention. For monthly briefs this happens to align (3 × ~30d ≈ 90d); for higher-frequency briefs the older runs are silently dropped from the API response.
44. Outputs are accessible to any user authenticated against the web app — same access level as the rest of the platform. No per-brief gating in this iteration. Long-term archival (> 90d) and finer-grained access control are explicitly out of this requirement; the platform-wide future OAuth integration (see §7 Future-readiness for auth) is the proper place to address them.

(Implementation tracked as **task 10.0** — currently deferred. The UI shape — landing feed, per-brief history embed, or a combination — is a separate decision to make after the capture layer is in place.)

### Mode catalog landing (future capability)

The current `/` page is essentially empty — just a heading. With the Mode space catalog data already available via `/api/mode/space-catalog` (req 38), the platform has everything it needs to make `/` a useful **browse view** of the Cooltra Mode space, cross-referenced with which briefs already use each query. The sidebar (briefs + Schedule link + New brief) is untouched; only the right-hand main content area changes.

45. The web app `/` page MUST become a **Mode catalog browse view**. Sidebar layout is unchanged; the change is confined to the right-hand main content area.
46. The catalog MUST list every report from the configured Mode space (via the existing `/api/mode/space-catalog` endpoint), one entry per report. Each report is rendered as a **card-styled accordion** (rounded, bordered, subtle shadow, with a hover/open shadow lift). The accordion header shows a small Database-icon tile, the report name, the report token (font-mono, muted) and **two badges** on the right: «N queries» (count of queries inside the report) and «M briefs» (count of UNIQUE briefs across all queries of this report — a brief that uses two queries from the same report counts once; renders muted «0 briefs» when nothing references the report). All accordions are **collapsed by default** when the user lands on the page. There is no "expand all" affordance in this iteration.
47. Inside each open accordion, every query MUST render with: query name + query token (font-mono, muted) + a **«usat per N briefs» badge**. The badge value reflects how many briefs in the repo currently reference this query token in any of their sources.
48. **Revised 2026-05-16 during 11.x implementation:** clicking the «usat per N briefs» badge MUST open a **Popover** anchored to the badge, listing the N briefs as links to `/briefs/<filename>`. Click outside (or re-click the badge) to dismiss. Originally specced as an inline-expand below the query row; reverted to a popover because the shadcn AccordionContent measures and locks its inner height to `--radix-accordion-content-height` at open time, and any dynamic content addition / removal AFTER the accordion opens left the card either clipping new content (when growing) or showing residual whitespace (when shrinking). A Popover renders via portal and is therefore immune to the accordion's measured-height invariant. The badge's visual style flips (emerald → zinc-900 background) via `data-state=open` so the open state reads clearly.
49. When a query has **zero** matching briefs, the badge MUST still render as «0 briefs» (visually muted), and a **discreet** «Create brief →» inline CTA MUST appear next to it. Clicking the CTA navigates to `/briefs/new` with the report token pre-filled in the first source's `mode_report_token` field (via query string, e.g. `?prefill_report=<token>`). The CTA is a Product-Led-Growth nudge: subtle by default, present so curious users can take action without leaving the catalog.
50. A free-text search MUST filter the catalog at all times:
    - Empty search → every report visible (all closed by default unless the user opens them).
    - Non-empty search → match against query names AND query tokens AND report names. Reports with a matching query auto-expand to surface the hit; reports with no match are hidden.
51. The cross-reference (which briefs use which query) MUST be computed server-side on each request from the brief YAMLs — a single pass over `briefs/*.yml` indexed by query token. The result is cached together with the catalog under the same 5-minute TTL as `/api/mode/space-catalog` so subsequent renders don't repeat the YAML walk.
52. Behaviour when the catalog can't be loaded (Mode API down): the page MUST surface a fallback message «Mode no disponible — torna a provar més tard» with a Refresh button that busts the cache. The sidebar continues to function regardless. Existing brief detail pages also continue to work — the catalog landing is an additional surface, not a precondition for the rest of the platform.
53. **At-a-glance stats strip** (added 2026-05-16 during 11.x implementation): a small line above the search input MUST surface three numbers describing the catalog scale: «N reports · M queries · X en ús per algun brief». Updates with the catalog data on every render. No interaction; informational only.
54. **Brief view mode humanises Mode tokens** (added 2026-05-16 during 11.x implementation, generalising what was deferred in §7 of the original PRD): on the brief detail page in view mode (not editing), the Mode report token and each query token MUST be rendered with the **human name as the primary line** and the raw token muted underneath, matching the visual rhythm of the BriefForm comboboxes and the catalog landing. The view mode subscribes to the shared `useSpaceCatalog()` client cache so no extra network round-trip is introduced (the catalog is already fetched once for the comboboxes). When the catalog is still loading or the token is no longer present in the configured space (renamed / deleted at Mode), view mode falls back to rendering the raw token in font-mono — the brief still functions, the cosmetic enhancement is best-effort.
55. **Sidebar Catalog entry** (added 2026-05-16 during 11.x implementation): once the user navigates away from `/`, they MUST be able to return without typing the URL. `SidebarNav` MUST include a "Catalog" link with a Database lucide icon, immediately above the existing "Schedule" entry. Active state highlights when `pathname === "/"`. The skeleton fallback for the sidebar reserves the same vertical space so the loading state doesn't visually shift when the nav lands.
56. **Output-token colour signal** (added 2026-05-16 during 11.x implementation): the "output tokens" number rendered next to a brief's last-run meta (sidebar `RunMeta` + ExecutionMetadata card) MUST be colour-coded so users can spot expensive briefs at a glance without opening them. Thresholds + colour classes live in **one tunable file**, `web/lib/tokenWarnings.ts`, so the whole app can be re-calibrated from a single place. Default ladder (Cooltra calibration): `≤ 250` keeps the muted parent colour, `> 250` switches to `text-orange-600`, `> 1000` switches to `text-red-600`. The "input tokens" stay muted regardless — only the output count is signalled, since input growth typically tracks the source data size while output growth is what a prompt change actually controls.

(Implementation tracked as **task 11.0** — landed 2026-05-16, merged via PR #44.)

### Brief output history — UI surfacing (future capability)

Task 10.0 captured every successful GROQ output behind `<slug>.brief.md` and exposed up to 3 entries per brief via `GET /api/briefs/[name]/outputs`. This subsection specifies the UI that consumes that data and turns the platform into a single pane of glass for past brief outputs — closing the loop on the original motivation: «no més voltes per N canals de Slack per veure què va dir cada brief».

57. The web app MUST gain a new top-level page `/history` and a corresponding "History" entry in `SidebarNav`. The entry sits immediately below the existing "Schedule" link, uses an appropriate lucide icon (suggested: `History` or `Clock`), and shows the standard active-route highlight when the user is on `/history`. The `SidebarSkeleton` MUST reserve an additional placeholder row so the loading state doesn't visually shift when the nav lands.
58. The `/history` page MUST display brief outputs **grouped by brief**, ordered by the moment of each brief's most recent captured output (descending — most recent brief at the top). Each row represents ONE brief and surfaces its **latest** captured output: brief name, timestamp (relative «fa Xh» + absolute «HH:MM ds DD/MM» Catalunya time), Slack channel (with `#` prefix), and the markdown text of that output rendered cleanly. The row is **expandable**; expanding reveals the brief's older captured outputs (up to 3 total per brief — the existing 10.0 cap) in descending chronological order INSIDE the same row. This means the global page is NOT a strict chronological feed of all runs; an older run of brief A may visually appear inside A's expansion below a more recent run of brief B if B happens to have fired between two of A's runs. This is intentional — each brief's history has context within itself, not interleaved with others.
59. Briefs without any captured outputs (recently created and never executed, or every execution failed before GROQ produced text) MUST appear at the **bottom of the list**, sorted alphabetically among themselves, each row collapsed by default with a muted placeholder copy («Cap output capturat encara»). They never carry an expander.
60. Briefs that have been **DELETED** from `briefs/` MUST NOT appear in either the global page or the per-brief drawer, even if their captured outputs still exist in GitHub Actions artifacts within the 90-day retention window. The history view's authoritative brief set is the CURRENT `listBriefs()` result. Renamed briefs (filename changed) lose their pre-rename history because the filename is the slug — consistent with the slug-stability decision documented elsewhere; the older artifacts under the old slug are effectively orphaned and not surfaced.
61. The brief detail page (`/briefs/[name]`) MUST gain a **"History" button** rendered in the same title-row toolbar as Run Now (immediately to its left). Clicking opens a **right-sliding drawer** (shadcn `Sheet`, side="right") on top of the current page; the drawer body shows the same per-brief grouped content used in the global `/history` page but scoped to that single brief, expanded by default so all available outputs (up to 3) are visible at once without an extra click. Closing the drawer returns to the brief detail with no loss of scroll position or form state — the brief detail page stays mounted behind the drawer.
62. Markdown rendering for both surfaces MUST use a single shared component (e.g. `<BriefMarkdown>`) backed by `react-markdown` + `remark-gfm` (for tables and task lists, which GROQ occasionally emits). Sanitisation defaults stay on — no raw HTML allowed even though usage is internal. Headers, paragraphs, lists, code blocks, blockquotes and tables MUST render legibly inside a constrained-width column matching the rest of the app's typography (Inter for body, JetBrains Mono for code spans / fences). Long outputs scroll naturally with the page (global) or inside the drawer's scrollable content area (per-brief).

(Implementation tracked as **task 12.0** — currently deferred until prioritised. UI sketch confirmed with user via Q1.A «History» label, Q2.C drawer for per-brief, Q3.C bottom placeholder for never-captured briefs.)

### Authentication & Access Control (future capability)

The platform is today openly accessible — anyone with the URL can read, edit and dispatch every brief. This subsection introduces a thin **access wall**: every visitor must authenticate before seeing any surface, but once inside, every authenticated user sees and edits every brief. Ownership is captured as a label (`owner_email` populated server-side from the session) but does NOT gate any action in this iteration — the field exists to enable a future per-user view without a schema break. Motivation: retire Non-Goal §5 #1, comply with internal data-handling expectations, and avoid leaking Mode / Slack-channel listings to anyone who guesses the Vercel URL.

A1. The web app MUST require authentication before ANY page (`/`, `/briefs/*`, `/schedule`, `/history`) and ANY API endpoint (`/api/*` excluding the auth callbacks themselves) renders or responds. Unauthenticated browser requests MUST be redirected to `/sign-in` preserving the originally requested URL; unauthenticated API requests MUST return HTTP 401.

A2. Authentication MUST be via **email magic link**. The sign-in page exposes a single field («Email») and a Submit button. On submit the platform emails the address a one-click sign-in URL valid for **10 minutes, single use**. Clicking the link establishes the session and redirects to the originally requested URL (or `/` if none).

A3. Sign-in MUST be **restricted by email domain**. Only addresses ending in `@cooltra.com` or `@felyx.com` are accepted. The check runs server-side TWICE: when the magic-link is requested (so the user gets immediate feedback «Aquest email no està autoritzat — utilitza un compte @cooltra.com o @felyx.com») AND when the magic-link is clicked (defence in depth against a link forwarded to a non-allowed inbox). The allowed-domain list MUST live in an env var `AUTH_ALLOWED_DOMAINS` (CSV) so adding / removing a tenant is one Vercel env-var edit, no code change.

A4. Sessions MUST be **JWT-only** (no DB), persisted as an `HttpOnly Secure SameSite=Lax` cookie. **Lifetime: 30 days, sliding** (each authenticated request refreshes expiry).

A5. The sidebar footer MUST surface the logged-in email (truncated if long) and a small **«Sign out»** button immediately above the build-info footer. Sign out clears the cookie and redirects to `/sign-in`.

A6. Authentication MUST stay transparent to the Python executor and the GitHub Actions workflows — these run server-side / scheduled and do not interact with user sessions. The executor's existing `GITHUB_TOKEN` / `SLACK_BOT_TOKEN` continue as the operational credentials for the scheduled pipeline.

A7. **Migration of existing briefs**: a one-time commit during rollout MUST bulk-assign `owner_email: oriol@cooltra.com` to every existing brief's YAML. **New briefs** created post-rollout MUST have their `owner_email` set server-side to the logged-in user's email at the moment of `POST /api/briefs` — the form UI does NOT expose an Owner field. **Edits** MUST preserve the existing `owner_email` value (the owner does not change just because someone else edited the YAML).

A8. **Audit trail via git history only**: every mutation endpoint (`POST/PUT/DELETE /api/briefs/*`) MUST include the logged-in user's email in the commit message authored by the service identity. Format: `Update brief: <slug> (by <user-email>)` (and analogous «Create brief: …», «Delete brief: …»). The YAML payload MUST NOT grow a `last_edited_by` or similar field — `git log` is the audit source of truth. Run Now (`POST /api/briefs/[name]/run`) does not mutate YAML; the dispatcher's email is captured in the existing GitHub Actions `workflow_dispatch` event metadata (searchable via the Actions API) so no `.run.json` change is needed.

A9. **The access wall is total**: there is no read-only public view of any brief, schedule, history, catalog or output. Unauthenticated visitors only see the sign-in page and the build-info footer.

A10. **Ownership has no UI gating in this iteration**: edit, delete, Run Now, new-brief, `/history`, `/schedule` and the Mode catalog are all reachable by every authenticated user without role checks. Future iterations may introduce «My briefs» filters or visibility scoping, which is why `owner_email` is captured even though it's decorative today.

(Implementation tracked as **task 13.0** — currently deferred until prioritised. Auth model resolved with user 2026-05-16: magic-link (Resend free tier), domain-restricted to `@cooltra.com` / `@felyx.com`, JWT-only sessions 30-day sliding, access-wall semantics, bulk migration to `oriol@cooltra.com`, audit via commit messages only.)

### Scheduler reliability via Vercel Cron (added 2026-05-17, task 14.0)

GitHub Actions' `schedule:` triggers are throttled in practice on this repo — observed cadence ~1 fire/hour despite `*/15 * * * *`, causing briefs scheduled at minutes other than `:00` to arrive 5–6 hours late in production. The diagnostic was confirmed via sidebar capture 2026-05-17: `:15` / `:30` briefs at "captured fa 5-6h" while `0 * * * *` briefs remained < 1h. The `is_due()` algorithm in `due_runner.py` is correct — the failure is upstream, in the GH Actions ticking layer itself, documented as best-effort under high load. This subsection moves the ticking layer off GH Actions and onto **Vercel Cron**, an infrastructure that runs independently of the executor pipeline and is documented as significantly more punctual. The Python executor (`scripts/executor.py`), the per-brief `run-brief.yml` workflow, the YAML data model, and Slack delivery are all untouched — only the *trigger* of the master scan changes.

S1. The web app MUST expose a new endpoint `GET /api/scheduler/tick` invoked by Vercel Cron every 5 minutes. The endpoint enumerates every brief in `briefs/*.yml`, evaluates each `schedule` cron in `Europe/Madrid` against a 5-minute window, and dispatches `run-brief.yml` (via the existing `dispatchBriefRun()` in `web/lib/dispatch.ts`) for every brief whose previous fire falls within the window. (Method note: Vercel Cron invokes cron paths as GET — not configurable per cron entry. The handler was originally shipped as POST in 14.4 and corrected in 14.9 after the cutover.)

S2. The window MUST be **strict** (`<`, not `<=`) and equal to the cron interval (5 min, i.e. 300 000 ms). Reason: Vercel Cron is documented as significantly more punctual than GH Actions (sub-minute drift); the inclusive `<=` semantics from `due_runner.py:76-82` were a defensive accommodation for GH drift that does not apply here. A strict bound prevents double-dispatch on the rare case where two consecutive ticks arrive exactly on-time. The cost: a tick that drifts by ≥ the full interval misses one fire — acceptable given Vercel's drift profile and that Run Now (task 6.0) remains as a manual recovery path.

S3. The endpoint MUST authenticate the caller by comparing the `Authorization: Bearer <secret>` header with a `CRON_SECRET` env var. Any mismatch returns HTTP 401 with no body. Vercel Cron auto-injects this header when the env var is set; manual smoke tests (S8) supply it explicitly via `curl -H`. The check MUST run BEFORE any GitHub or filesystem call so unauthenticated traffic costs essentially nothing.

S4. Brief enumeration MUST reuse the existing `listBriefs()` + `readBrief()` + `parseBrief()` pipeline so the scheduler shares the same parsing rules as the rest of the web app (no second YAML reader to keep in sync). The "is due" predicate MUST reuse `cron-parser` (already installed for `web/lib/cron.ts:nextFireAt`) configured with `tz: "Europe/Madrid"` — no manual port of Python's `croniter` required; the library handles the TZ-aware previous-fire calculation directly.

S5. **Failure isolation**: if `dispatchBriefRun()` fails for a given brief, the endpoint MUST log the error and continue with the remaining briefs. The response MUST always reach HTTP 200 with a JSON body `{ scanned, due, dispatched, failures }`, where `failures` is an array of `{ brief, message }` for briefs whose dispatch returned non-OK. (Equivalent to `due_runner.py`'s per-subprocess isolation: one brief crashing must not stop the others.)

S6. The endpoint MUST emit one `console.log` line per invocation with a structured payload `{ event: "scheduler.tick", scanned, due, dispatched, failures, took_ms }` so Vercel's Function Logs UI surfaces the scan health without parsing the response body. The log line is the operational source of truth; the JSON response is for ad-hoc curl smoke tests.

S7. The GitHub Actions workflow `.github/workflows/run-due-briefs.yml` MUST be **retired in the same PR** that ships the endpoint — the file deleted along with `scripts/due_runner.py`. The per-brief `run-brief.yml` workflow, which the new endpoint dispatches, remains. Rationale for atomic cutover: running both schedulers in parallel would publish each due brief twice to Slack (the per-brief workflow is reentrant but emits a fresh Slack message each call). Rollback path: revert the PR — the old `run-due-briefs.yml` returns and resumes ticking on the next GH Actions tick (worst-case latency back to pre-fix behaviour, but no data loss).

S8. **Smoke test before merge** (the sufficiency criterion — there are no automated tests): on the Vercel preview deployment, hit `GET /api/scheduler/tick` with `curl -H "Authorization: Bearer <CRON_SECRET>"`, verify the JSON response lists the briefs as `due:[]` / `dispatched:[]` consistent with the current minute, and inspect the Vercel Function Logs entry for the structured `scheduler.tick` payload. Post-merge verification follows the team's sidebar-capture method: confirm that briefs scheduled at `:15` / `:30` / `:45` arrive in Slack within their scheduled hour over the following 24h. Vercel Cron does NOT fire on preview deployments — the curl path validates the endpoint logic, while the post-merge production deploy validates the cron→endpoint wiring. **CRITICAL**: the curl must use the same HTTP method as Vercel Cron (GET); a POST smoke test would validate a handler signature that never matches the actual cron traffic — see 14.9 for the postmortem.

(Implementation tracked as **task 14.0** — currently in flight on `feature/14.0-vercel-cron-scheduler`. Architecture decision recorded with user 2026-05-17: Vercel Pro plan confirmed, `*/5 * * * *` schedule with strict 5-min window, single-PR atomic cutover with PR-revert rollback path, scheduler-tick observability via JSON response + structured `console.log`, smoke test via curl on preview + sidebar capture in production.)

### Sidebar brief actions menu (added 2026-05-17, task 15.0)

The sidebar already lets the user navigate to a brief with one click. After 6.0 (Run Now) and 12.0 (History drawer) shipped, the brief detail page grew two prominent actions at the top toolbar. Getting to either still required a navigation step from the sidebar, then a click on the action. This subsection collapses that to a single interaction: a kebab menu next to each sidebar row exposes Edit, Run Now and History inline. Confirmed user value: an operations lead skimming the sidebar can dispatch a brief or peek at its last output without ever loading the detail page.

M1. Every brief in the sidebar list MUST surface a kebab (`⋮`, lucide `MoreVertical`) on the right edge of its row. The kebab MUST be hidden by default (`opacity-0`) and reveal on row hover (`group-hover:opacity-100`) or keyboard focus (`focus-visible:opacity-100`). Once the popover is open, the kebab MUST stay visible regardless of cursor position (`data-[state=open]:opacity-100`) so the user can interact with the menu without the trigger blinking away.

M2. Clicking the kebab MUST open a popover anchored to the trigger containing **three actions in order**: **Edit**, **Run Now**, **History**. Each action MUST show a lucide icon (Edit/Play/History respectively) followed by the English label. The popover MUST close on outside click and on Escape (standard Radix behaviour).

M3. **Edit** MUST navigate to `/briefs/<filename>?edit=1`. The detail page MUST detect the `edit=1` query parameter and mount the BriefForm pre-activated in `mode="edit"` so the user lands on the editable form without an extra click. Absence of the parameter preserves today's default (`mode="view"`). The URL parameter is not stripped after activation — keeping it lets a refresh re-land in edit mode and is intentional.

M4. **History** MUST navigate to `/briefs/<filename>?history=1`. The detail page MUST detect the `history=1` query parameter and pass `initialOpen={true}` to the HistoryDrawerButton, which opens the drawer immediately on mount and triggers the same `/api/briefs/<filename>/outputs` fetch a manual click would. The brief detail page renders behind the drawer as usual, so closing the drawer returns the user to the brief detail (not back to the sidebar) — consistent with task 12.0 semantics.

M5. **Run Now** from the kebab MUST share the same 2-minute cooldown state as the header Run Now button (task 6.0 T2). The cooldown deadline lives in `localStorage` under `runnow:<filename>` (already established in 6.0) and a new `runnow:dispatched` window CustomEvent fires after every successful dispatch so any other Run Now consumer in the same tab refreshes its cooldown view live (without it, only cross-tab `storage` events would trigger a refresh and the same-page header button would look stale until reload). The menu item MUST render the remaining countdown inline (`Run Now (1:42)`) when the cooldown is active and stay disabled while the cooldown holds. Server-side rejection (HTTP 429) MUST be honoured identically to the header button — the kebab is not a back-door around the cooldown.

(Implementation tracked as **task 15.0** — currently in flight on `feature/sidebar-brief-kebab-menu`. UX decisions recorded with user 2026-05-17: 1.A Edit auto-activated via query param, 2.A Run Now shares cooldown with header, 3.A History auto-opens drawer via query param, 4.B kebab visible only on hover/focus.)

### Publish / Unpublish brief (added 2026-05-17, task 16.0)

Today every brief in `briefs/*.yml` is implicitly active: as soon as the YAML lands on `main`, the Vercel Cron scanner picks it up and the next matching schedule fires a real Slack post. There's no halfway state — to pause a brief without losing its YAML, the user has to either set the schedule to something distant (hacky and forgettable) or delete the brief and re-create it later (loses git history continuity). This subsection adds an explicit **Published / Draft** toggle on every brief that gates whether the cron applies. Drafts stay fully editable, fully Run-Now-able (after a confirmation dialog), and fully visible across the UI — they just don't get auto-dispatched by the scheduler. Confirmed value: lets the user park a half-written brief, iterate the prompt over multiple sessions, and only let the cron pick it up when the brief is genuinely ready.

PT1. Every brief MUST carry a boolean `published` field in its YAML. The field is **explicit in every YAML emitted by the platform** — `serializeBrief` always writes `published: true` or `published: false`, never omits it. Existing briefs missing the field are tolerated by `parseBrief` (legacy compatibility) and treated as `published: true` so behaviour is preserved before the migration commit lands.

PT2. **Migration commit**: as part of the task 16.0 rollout, a one-time commit MUST bulk-add `published: true` to every existing brief in `briefs/*.yml`. Reason: the current state of the world is «everything in the repo is live», and the migration must preserve that. After the migration, *every* brief carries an explicit `published` field. New briefs are the only path that produces drafts by default (see PT9).

PT3. The brief detail view MUST surface a **Published toggle** at the top of the form, in the same title-row toolbar as Run Now and History (immediately to the left of Run Now). UI: a shadcn `Switch` primitive with an English label «Published» and, when off, the label flips to «Draft» in a muted zinc. The Switch reflects the current saved state in view mode (read-only — clicking it requires entering edit mode); in edit mode, the Switch is interactive and the change is staged like any other form field, committed on Save.

PT4. The detail view MUST also surface a **status badge** beside the brief name in the page header (NOT inside the form), visible regardless of view/edit mode:
    - `Published` — emerald background (`bg-emerald-50 text-emerald-700`), small uppercase text.
    - `Draft` — zinc background (`bg-zinc-100 text-zinc-600`), same shape.
    The badge is the user's at-a-glance signal even when the form isn't open; the toggle is the *action* to change it. Two surfaces, one for read, one for write — same pattern as the rest of the form.

PT5. The sidebar (`BriefSidebar` / `BriefSidebarList`) MUST visually de-emphasise drafts:
    - Row text rendered with `opacity-60` (the same opacity already used for disabled affordances elsewhere).
    - A small `Draft` chip rendered after the brief name (font-mono `text-[10px]`, muted zinc background, rounded), inline so it shares the row's truncation behaviour gracefully.
    - The dot-status (success/failed/never-run) and token badge stay rendered at full opacity — they still describe the brief's last run, which is meaningful even for drafts.
    - Sort order unchanged: alphabetical by name; drafts mix with published in the same list. (No separate «Drafts» section in this iteration.)

PT6. `/schedule` MUST render drafts in a draft-styled row:
    - Brief name in `opacity-60` plus a `Draft` chip in the «Brief» column (identical to the sidebar treatment).
    - The «Proper enviament» column shows the next computed fire time but in muted style with a Tooltip on hover: «Aquest brief està despublicat — el cron no s'aplicarà fins que es publiqui». Reason: the cron expression is still valid, the user is intentionally not letting it run; surfacing what *would* fire helps the user decide if the schedule is still right.
    - «Última run» and «Schedule» columns unchanged — same data either way.
    - Sort order unchanged; drafts mix with published in the same table.

PT7. The scheduler endpoint `/api/scheduler/tick` MUST filter drafts out of the candidate set **before** evaluating `isDue()`. Implementation: a single `.filter((b) => b.published !== false)` after `parseBrief` in the existing pipeline. The structured `console.log` payload (S6) MUST gain a new field `skipped_draft` reflecting the count of briefs filtered out so the operator can see the draft volume in Vercel Function Logs without parsing YAML. The JSON response payload (S5) MUST surface the same field for ad-hoc curl checks.

PT8. **Run Now confirmation for drafts**: when the user clicks Run Now on a brief with `published: false` (either from the header button OR the sidebar kebab item), the platform MUST open a shadcn Dialog before dispatching:
    - Title: «Brief despublicat».
    - Body: «Aquest brief està en mode Draft — el cron no l'executa automàticament. Vols executar-lo manualment ara?».
    - Buttons: «Cancel» (outline, secondary) + «Run anyway» (primary, dispatches via the same code path as the unconfirmed flow).
    - The 2-minute cooldown (T2) applies AFTER the user confirms — the dialog itself is not gated by cooldown. A second Run Now within the cooldown window still gets the 429 toast.
    - Published briefs (the common case) MUST NOT see the dialog: Run Now stays one-click. The dialog is the gentle nudge for the explicit «I know this is a draft, I want to run it anyway» state.

PT9. **New brief default**: `/briefs/new` MUST initialise the form with `published: false`. The Switch is visible from the first render so the user can flip it on before Create if they want. Rationale: drafts-by-default lets users edit the prompt over multiple sessions without an accidental cron post landing in Slack before the brief is genuinely ready. The Create button label is unchanged («Create»); publish state is just one more field, not a separate action surface.

PT10. **No separate publish/unpublish endpoints**: `POST /api/briefs` and `PUT /api/briefs/[name]` already accept the full brief payload — `published` flows through the existing zod schema + `serializeBrief` + GitHub commit pipeline like any other field. No `/api/briefs/[name]/publish` route is added. The commit message naturally surfaces the change (the existing «Update brief: <slug>» line is unchanged; users wanting an audit trail of publish toggles read it from `git log` on the YAML).

PT11. `/history` is **not filtered** by publish state. A draft brief that was previously published has captured outputs; surfacing those at `/history` (and inside the per-brief drawer) stays useful — the publish toggle controls future scheduler behaviour, not historical visibility. Drafts that have never produced outputs naturally fall to the «Cap output capturat encara» bottom partition (see §4 req 59) without any extra logic.

(Implementation tracked as **task 16.0** — currently deferred until prioritised. Decisions recorded with user 2026-05-17: 1.A priority before Mode data preview, 2.B drafts-by-default for new briefs, 3.C Run Now asks confirmation when draft, 4.A+B+D three surfaces — sidebar opacity+badge, /schedule draft-styled rows, detail page prominent toggle.)

### Mode data preview (added 2026-05-17, task 17.0)

Today the cycle for validating that a brief is wired to the right Mode query is painful: pick a `mode_report_token` + `queries[].token` in the form, save, hit Run Now, wait 30–90 s for the workflow + Mode run + Slack post, then realise in Slack that the query returned 0 rows / the wrong columns / stale data. Iterating means doing the loop again. This subsection adds a **server-fed preview** of the last successful Mode run for a selected query, rendered inline in the BriefForm so the user can validate query token + report token + column shape **before** ever saving the brief or dispatching a real run. The preview reuses Mode's most recent run on the parent report (no fresh SQL execution) so the latency is sub-3-seconds and the load on Mode is negligible.

P1. The query row inside each source MUST surface a **«Preview data» button** immediately to the right of the `QueryCombobox`, using the lucide `Eye` icon plus the English label. The button is rendered both in edit and view modes — in view mode it offers a fast «see what this brief is wired to» without entering edit. The button is rendered for every query row, not once per source: each query gets its own preview because that's the unit the user is validating.

P2. The button MUST be **disabled** when either `mode_report_token` for the parent source OR the query's `token` is empty (no point previewing nothing). Disabled state surfaces a tooltip in Catalan explaining «Selecciona report i query abans de fer preview». Once both fields are populated (whether picked from the catalog combobox or typed free-text), the button enables — the preview works against the raw tokens, not the catalog.

P3. Clicking the button MUST open a **shadcn `Sheet` panel (side="right")**, matching the visual rhythm of the History drawer (task 12.0 / 15.0). The brief form stays mounted behind the Sheet; closing the Sheet (Escape, outside click, or X) returns the user to the form with no loss of scroll position or form state. Multiple Preview clicks in a row (different queries in different rows) MUST reuse the same Sheet — open one, close to dismiss, open another.

P4. The Sheet header MUST surface, in this order:
    - **Query name** (font-medium) when the token resolves to a name in the space catalog; the raw token (font-mono, muted) underneath. When the token is not in the catalog, the raw token is the primary line and there is no secondary line.
    - **Run timestamp** in font-mono muted: «Last Mode run · fa 4h · HH:MM ds DD/MM» (Catalunya local). Tooltip on hover reveals the raw UTC ISO of the run completion. Helps the user spot a stale upstream pipeline at a glance.
    - **Rows count** + **columns count**: «N rows · M columns». When N > 10 (the preview cap), the count surfaces the full N so the user knows the preview is a slice.
    - **Refresh button** (lucide `RefreshCw`, ghost variant, size xs) on the right edge of the header that re-fetches with `?force=true`, bypassing the cache.

P5. The Sheet body MUST render a **table** with one column per Mode query column and up to **10 rows** of data. Column headers come from the keys of the first row's JSON object (mirroring how the executor passes data to GROQ in `executor.py:build_user_message`). Cells render `null` as a muted «null» token, numbers right-aligned, strings left-aligned, nested objects / arrays as a `<code>`-styled compact JSON snippet (single line, truncated with ellipsis if >80 chars; full content available on hover via Tooltip). The table MUST scroll horizontally inside the Sheet body when the column count exceeds the panel width — no column truncation or hiding, just `overflow-x-auto` on the table wrapper.

P6. **Edge cases the Sheet body MUST handle distinctly**:
    - **No previous run on the report**: «Cap run previ d'aquest report a Mode. Desa el brief i fes Run Now per disparar el primer fetch.» No table, no error styling — informational state. Useful for newly-added queries that have never been executed.
    - **Latest run failed (state ≠ succeeded)**: «L'últim run d'aquest report ha fallat (state: <state>). Tria un altre report o investiga a Mode.» With a discreet link to the Mode UI report page (`https://app.mode.com/<account>/reports/<token>/runs`).
    - **Query token not found in the latest run**: «Aquesta query no apareix dins de l'últim run del report. Pot ser que s'hagi renombrat o esborrat a Mode.» Helps catch typos in the typed-free-text path.
    - **Query returned 0 rows**: empty table + small «Cap fila retornada en aquest run» under it. Not an error — could be a legitimate state (filter too restrictive, off-day, …) the user wants to know about.
    - **Mode API failure** (upstream 5xx, rate limit, auth): «Mode no disponible — torna a provar més tard» + Retry button that re-fires `?force=true`.

P7. **Fetch strategy = reuse latest run** (decision recorded with user 2026-05-17): the preview MUST NOT trigger a fresh report run. Instead, it MUST list the report's existing runs via `GET /reports/{report_token}/runs`, pick the most recent **succeeded** one, list its query_runs, find the one matching the requested `query_token`, and fetch its `results/content.json`. Rationale: previews are about *structure validation* and *recency check*, not *fresh data*. A fresh run takes 30–120 s and consumes Mode execution capacity; reusing the latest succeeded run answers the user's question in 1–3 s at zero Mode cost.

P8. New server endpoint `GET /api/mode/preview/[report]/[query]` MUST:
    - Accept the `report` (Mode report token) and `query` (Mode query token) as path params.
    - Accept `?limit=<n>` as an override (default 10, max 50 — anything higher is an anti-pattern for a UI preview).
    - Accept `?force=true` to bypass cache.
    - Return `{ kind: "ready", run: { completed_at, state }, query: { token, name }, columns: string[], rows: object[], total_rows: number }` on success.
    - Return `{ kind: "no-previous-run" }` (HTTP 200) when the report has no succeeded runs.
    - Return `{ kind: "run-failed", run: { state, …} }` (HTTP 200) when the latest run is in a failed state.
    - Return `{ kind: "query-not-found" }` (HTTP 200) when the report has runs but the query token isn't present in the latest one.
    - Return HTTP 502 with `{ error: <upstream-message> }` on Mode 5xx / network failure.

P9. **Caching**: the endpoint MUST cache results in an in-memory `Map<string, …>` keyed by `<report>:<query>:<limit>` with a 5-minute TTL, matching `/api/channels`, `/api/runs/[brief]`, and `/api/briefs/[name]/outputs`. `?force=true` busts the entry. The cache is per-serverless-instance (no cross-instance coherence), same accepted trade-off as the other Mode endpoints.

P10. The endpoint MUST never expose the Mode token / secret to the client — same `server-only` discipline as `web/lib/mode.ts`. All Mode HTTP calls happen server-side; the client only receives the sanitised payload.

P11. The button MUST work uniformly for both **catalog-picked** and **typed-free-text** tokens. The preview validates against Mode directly — the catalog is just an autocomplete affordance. This means the Preview affordance is also the validation path for tokens that aren't in the configured space (e.g. a query the user wants to add from another Mode space, falling back to the executor's flexible token-handling).

(Implementation tracked as **task 17.0** — currently deferred until prioritised. Decisions recorded with user 2026-05-17: 1.A reuse latest run, 2.A Sheet side="right", 3.A 10-row cap, 4.A 5-min TTL + ?force=true.)

### Dry-run output (added 2026-05-17, task 18.0)

Today the cycle for iterating a brief's prompt is painful even after task 17.0 lands: edit the prompt → Save (commits to GitHub) → Run Now (~30-90 s for workflow + Mode + GROQ + Slack post) → open Slack, find the channel, read the output → judge it → repeat. The Slack channel ends up full of test posts that operators / stakeholders watching the channel see; the cycle latency dominates iteration. This subsection adds a **dry-run path**: a button («Preview output») that runs the full Mode → GROQ pipeline against the **current form state** (saved or unsaved) and renders the LLM output inline in the platform UI — **no Slack post, no GitHub commit, no workflow dispatch**. Latency target: 5-15 s end-to-end. The output streams progressively so the user sees content forming, matching the way they'd see a chatbot reply, and can cancel mid-generation if they spot the output veering off.

D1. The platform MUST expose a **Preview output** affordance from THREE surfaces, all driving the same shared Sheet UI (described in D3):
    - **Detail page header**: a button «Preview output» (English chrome) immediately to the left of «Run Now». Triggers a dry-run against the **persisted** state of the brief (the YAML on disk) — useful when the user just wants to see what the brief currently emits without entering edit mode.
    - **Form footer in edit mode**: a button rendered below the existing action row, only when `mode === "edit"`. Triggers a dry-run against the **current form state** (including unsaved edits) — the cycle this feature is primarily aimed at: «I just tweaked the prompt, let me see the new output before deciding to Save».
    - **Sidebar kebab menu**: a fourth item «Preview output» (lucide `Sparkles` or similar) below the existing Edit / Run Now / History entries. Triggers against the **persisted** state. Same one-click UX as the existing kebab actions.

D2. The dry-run MUST execute the **full Mode → GROQ pipeline** that the production executor (`scripts/executor.py`) runs, EXCEPT:
    - **No Slack post** (`post_brief_to_slack` is never called).
    - **No GitHub commit** (the dry-run never touches the YAML).
    - **No `.run.json` artifact write** (dry-runs are ephemeral by design — they don't show up in `/history`, in ExecutionMetadata, or in the scheduler logs).
    - **No `.brief.md` artifact write** (same reason).
    Mode fetching, GROQ prompt construction, GROQ inference all happen identically — fidelity to production is what makes the dry-run trustworthy.

D3. The Sheet that surfaces the output MUST be a **right-side panel** (shadcn `Sheet side="right"`), matching the visual rhythm of the History drawer (12.0 / 15.0) and the Mode preview Sheet (17.0). The Sheet body MUST contain, in this order:
    - **Phase indicator** at the top: one of «Carregant Mode data…», «Generant amb GROQ…», «Llest» (Catalan narrative); a small spinner during the first two phases. When the operation fails, the indicator flips to an error variant («Error a Mode» / «Error a GROQ») with the upstream message right below.
    - **Streamed markdown body**: the LLM output rendered as it arrives (token-by-token) via the same `<BriefMarkdown>` component the History drawer uses (12.0). The user sees content forming progressively rather than waiting for the full response.
    - **Token meta** at the bottom (visible only after completion): «Input X · Output Y · Total Z tokens». Same shape as ExecutionMetadata's row but inline at the foot of the Sheet — informational, not interactive.
    - **Cancel button** at the top right while the dry-run is in flight (`status: "loading"` or `"streaming"`). Clicking it aborts the GROQ stream via `AbortController`, the Sheet shows the partial output frozen + a small «(Cancel·lat)» note.

D4. **No cooldown** on dry-run dispatches (decision recorded with user 2026-05-17). Dry-runs don't touch Slack, don't dispatch workflows, and don't persist anything; the only cost is GROQ token usage which the user pays for. A user iterating a prompt may legitimately fire 5-10 dry-runs in a couple of minutes — gating that with a Run-Now-style 2-minute cooldown would defeat the cycle this feature is designed to enable.

D5. **The dry-run MUST be cancellable mid-flight**. Clicking the Cancel button aborts the GROQ HTTP stream via `AbortController`; the server-side handler propagates the abort to the GROQ SDK call. Partial output already rendered stays on screen with a «(Cancel·lat)» badge so the user can still read what was generated up to the cancellation point. Re-clicking Preview output starts a fresh stream.

D6. **The dry-run MUST NOT block on a saved brief**: the form-footer trigger sends the IN-MEMORY form values as the dry-run payload, not the on-disk YAML. The header and kebab triggers send the persisted brief. This is the practical reason the form-footer button exists at all — without it, dry-running unsaved changes would require Save+Discard cycles that defeat the iteration speed-up.

D7. **The Sheet MUST stay mounted** while the dry-run runs; closing it (Escape, outside-click, X) ABORTS the in-flight stream (same `AbortController` cleanup as cancel). Re-opening with the same inputs starts a fresh stream — dry-runs are not cached because the user's intent in re-opening IS to see a new generation (LLM output is non-deterministic; that's the value).

D8. New endpoint `POST /api/briefs/dry-run` MUST:
    - Accept the **full Brief payload** in the request body (not a reference to a saved brief) — same shape as `briefSchema` but with `slack_channel` and `schedule` ignored by the handler. This way the same endpoint serves both the «persisted brief» and «in-memory form state» triggers without needing two endpoints.
    - Validate the payload against `briefSchema` server-side; reject with 400 + zod errors on parse failure.
    - Stream the response as `text/event-stream` (Server-Sent Events) so the client can render tokens as they arrive. Event types: `mode-fetched`, `groq-chunk` (with `{ delta: string }`), `complete` (with `{ usage: { input, output, total } }`), `error` (with `{ phase: "mode" | "groq" | "validation", message: string }`).
    - Honour `request.signal` to abort the GROQ stream when the client disconnects (Cancel button or Sheet close).
    - Skip the `.run.json` / `.brief.md` / Slack / GitHub side effects entirely.

D9. **Env var requirement**: `GROQ_API_KEY` MUST be present in Vercel env vars (Production + Preview). Already exists as a GitHub Secret for the executor pipeline; needs a copy into the Vercel env-var inventory. Operator action documented in the rollout note for task 18.0.

D10. **Hybrid architecture preserved**: Run Now CONTINUES to dispatch the GitHub Actions workflow (the executor.py path). Only the dry-run flow uses the new Vercel-side TS implementation. Rationale: Run Now is the path that publishes to Slack + writes the audit artifacts; keeping it on the existing well-tested executor path means we don't double-implement the production Slack delivery code. The Vercel-side TS path exists exclusively to deliver the low-latency iteration cycle for dry-runs.

D11. **Output is NEVER persisted**: dry-runs don't write to `out/`, don't show up in `/api/briefs/[name]/outputs`, don't appear in `/history` or per-brief drawers. The Sheet is the only surface they exist in; closing it discards the output. This is intentional — dry-runs are exploratory by nature; capturing every iteration would clutter the history with noise that doesn't represent what was actually delivered to stakeholders.

(Implementation tracked as **task 18.0** — currently deferred until prioritised. Decisions recorded with user 2026-05-17: 1.C hybrid architecture (GH Actions for Run Now, Vercel endpoint for dry-run), 2.A right-side Sheet with progressive streaming, 3.ABD three trigger surfaces (detail header, form footer, sidebar kebab), 4.A no cooldown.)

### Prompt Assistant (added 2026-05-17, task 19.0)

Today the hardest barrier for new users creating a brief is the **prompt** field. The UI surfaces a Tooltip with an example («Resumeix les dades en 3 bullets…»), but writing a prompt that produces a useful Slack message requires non-trivial prompt-engineering skill. Field help tells you *what* a prompt is; it doesn't help you *write* a good one. This subsection adds a **conversational AI assistant** that helps the user generate or refine prompts in plain language. Two scenarios it serves:
- **Generation**: a brand-new brief with an empty `prompt` field. The user types «Vull saber quins app versions tenen menor adopció i quin segment d'usuaris es queda darrere» → the assistant proposes a complete prompt grounded in the brief's selected sources.
- **Refinement**: a brief whose prompt already exists. The user types «fes-ho més curt», «afegeix percentatges», «no incloguis introducció» → the assistant edits the prompt incrementally.

A1. The brief detail view (and `/briefs/new`) MUST surface a **«Prompt Assistant» toggle button** inside the BriefForm Content section, immediately adjacent to the Prompt field's label row (next to the Info icon). The button uses a lucide `Bot` (or `Sparkles`, TBD during impl) icon + the English label «Prompt Assistant». Clicking it opens the assistant Sheet (A2). The button is visible in both view and edit modes — the chat is read-only-useful even when not editing (the user can look back at past suggestions), but the «Apply this prompt» action requires the form to be in edit mode (A6). **Beta marker** (added 2026-05-18 as a small post-19.0 chore): both the trigger button AND the Sheet header MUST render a small uppercase «Beta» chip next to the label, signalling that the feature's output quality is still being calibrated (see Open Question 12 on the model selector path). The chip styling matches `DraftChip` — small font-mono uppercase, rounded, border + bg + text in amber-50/200/700.

A2. The assistant UI MUST be a **shadcn `Sheet side="right"`** (matching the History drawer / Mode preview / Dry-run sheets — fourth Sheet in the brief detail view, all coherent visually). Width `sm:max-w-2xl` for comfortable chat reading. The Sheet body is a vertical layout:
    - **Header**: «Prompt Assistant» title + a small Catalan subtitle «T'ajudo a escriure el prompt d'aquest brief». Refresh / Clear conversation button on the right that wipes the localStorage entry for this brief (with a confirmation Dialog — clearing chat history is a one-click action with no undo).
    - **Message list**: chronological list of `ChatMessage[]` (user + assistant). Each message bubble rendered with role-appropriate styling (user: zinc-100 right-aligned; assistant: white left-aligned). Assistant suggestions of a complete prompt MUST surface an **«Apply this prompt»** button below the message (A6). The list scrolls; newest message at the bottom; auto-scroll on new chunks during streaming.
    - **Input row** at the bottom: a multi-line Textarea + a Send button (Enter to send, Shift+Enter for newline). Disabled while a response is streaming.

A3. **LLM model**: GROQ Llama 3.3 70b (`llama-3.3-70b-versatile`) — the same model the production executor uses. Decision recorded with user 2026-05-17: reuses the existing `GROQ_API_KEY` (already added to Vercel as part of task 18.0). No new env var, no new model cost. Llama 3.3 70b is well-suited for instruction-following tasks like prompt rewriting (validated empirically by the executor's own brief-generation track record). If output quality is unsatisfactory for prompt-engineering specifically, a future task can introduce a model selector (see Open Question 12).

A4. **Conversation persistence**: localStorage per brief, key `prompt-assistant:<filename>`. Stores the full message history as JSON. Decision recorded with user 2026-05-17:
    - Survives a page refresh inside the same browser → the user can close and re-open the Sheet without losing context.
    - Does NOT sync across devices or browsers → two operators editing the same brief from different machines see different conversations.
    - Is wiped when the user clicks «Clear conversation» (A2).
    - Capped at 50 messages per brief — beyond that, the oldest are evicted to prevent runaway localStorage growth.
    - No backend mirror, no commit to GitHub, no field on the YAML — the brief schema is unchanged.

A5. **Context the assistant receives**: a system prompt server-side that includes:
    - The **brief's metadata**: name, current `prompt` (empty for new briefs), the list of sources with their report and query names (resolved from the space catalog when available, raw tokens otherwise).
    - A **few-shot block of 3 existing briefs** chosen as «well-crafted prompts». Selection heuristic for v1: take the 3 briefs in the repo whose `prompt` field is longest (proxy for «the author put thought into it»). The few-shot block shows the report+queries+prompt triple for each, so the assistant learns Cooltra's house style. The endpoint computes this list server-side from `listBriefs()` + `parseBrief()` — same primitives used elsewhere.
    - The **conversation history** the user has had so far (passed through unchanged).
    - **NOT real Mode data**: decision recorded — a fresh Mode fetch every chat session adds 3-10 s latency that kills the «instant chat» feel. Prompt engineering rarely requires seeing rows; the user knows what columns exist, and the assistant infers it from the query name. (Open Question 13 covers re-evaluating this if users ask.)

A6. **«Apply this prompt» button**: when the assistant emits a complete suggested prompt (detected via a structured tag in the response — `<suggested_prompt>...</suggested_prompt>`), the message bubble renders an «Apply this prompt» button. Clicking it:
    - Writes the suggested prompt into the BriefForm's `prompt` field (via the form's shared React Context — see A10).
    - If the form is in `view` mode, automatically flips it to `edit` mode so the user can see the change in the editable Textarea.
    - Does NOT auto-save — the user reviews the change and clicks Save / Create explicitly.
    - Triggers a small Sonner toast «Prompt actualitzat» so the action's effect is unambiguous.

A7. **Streaming response**: the endpoint returns Server-Sent Events (same pattern as 18.0's `/api/briefs/dry-run`) so the assistant's reply renders token-by-token in the chat. Latency to first token < 1 s; full reply 3-8 s typically. The user can cancel mid-stream (Stop button replaces the Send button while streaming) — same `AbortController` pattern as the dry-run.

A8. **Cancellation**: the Send button transitions to a Stop button while a response is in flight. Clicking it aborts the SSE stream. The partial assistant reply stays in the message list with a small «(aturat)» badge, mirroring the dry-run's «(Cancel·lat)» behaviour.

A9. **Error handling**: GROQ rate limit → red Alert below the input «Hi ha massa peticions en aquest moment. Espera uns segons i torna a provar». Stream error → similar Alert «No s'ha pogut completar la resposta». Cap retry-button — the user just re-sends. Cap cooldown — same rationale as dry-run, chat sessions are user-paced and rate limits are GROQ's responsibility.

A10. **State sharing with BriefForm**: the «Apply this prompt» action needs to write into the form's `prompt` field. Two implementation options for the implementer to evaluate:
    - **(a) React Context (`PromptAssistantProvider`)** mounted at the BriefForm root, exposing `applyPrompt(text)` to the Sheet. The form sets up the context with a setter that calls `setValue("prompt", text, { shouldDirty: true })`.
    - **(b) Custom event dispatched on `window`** (`promptassistant:apply`). The form listens and applies. Decouples the components but harder to type-check.
    Recommendation: **(a) React Context** — same pattern as `useDryRun` (18.8), idiomatic, type-safe, scoped to a single form instance.

A11. **Endpoint contract**: `POST /api/briefs/prompt-assist` accepts a payload `{ messages: ChatMessage[], context: { briefName, currentPrompt, sources: SourceContext[] } }` and responds with `text/event-stream`. The handler server-side composes the system prompt (including the few-shot block), prepends it to the conversation history, calls GROQ with `stream: true`, and forwards chunks as SSE `data: { delta: string }` events. Final event: `data: { kind: "complete" }`. Errors via `data: { kind: "error", message }` events. **No payload validation against `briefSchema`** — the endpoint doesn't trust or persist anything; it just needs the metadata it'll embed into the system prompt.

A12. **No PR comment / no commit**: the assistant never edits files, never commits to GitHub. The «Apply this prompt» action only touches the in-memory form state; the user explicitly Saves to persist.

(Implementation tracked as **task 19.0** — currently deferred until prioritised. Decisions recorded with user 2026-05-17: 1.B GROQ Llama 3.3 70b (reuse existing key), 2.B localStorage per brief (`prompt-assistant:<filename>`), 3.* metadata + few-shot (selected on best-UX grounds: real-data context adds 3-10 s latency that kills chat feel), 4.A Sheet right-side toggle from within the BriefForm.)

### Prompt-design tooling polish & raw-mode handling (added 2026-05-18, task 20.0)

The three prompt-design tooling features (17.0 Mode data preview, 18.0 Dry-run output, 19.0 Prompt Assistant) shipped with an accumulated polish-debt and a real bug in the dry-run path when the brief is in raw mode (empty prompt — a capability added by PR #69 «optional prompt → raw mode»). This subsection bundles the polish and closes that loop before further features land on top of the same area.

Three intertwined themes:
1. **Raw-mode handling** — the dry-run endpoint calls GROQ with an empty system prompt, generating phantom text from the data alone. The fix is to replicate the «no LLM call» logic that `scripts/executor.py:540-545` already implements for production.
2. **Empty-prompt validations** — a brief with no prompt requires at least one query with `csv: true` (otherwise the Slack post is empty); the Save action must be gated and the Preview must contextualise the raw-mode state.
3. **Right-side Sheets coherence** — the four right-side Sheets (Mode preview, History drawer, Prompt Assistant, Dry-run Preview) have slightly different resize behaviours and toolbar hierarchies; we unify them.

PD1. **«Preview output» renames to «Preview»** across every chrome surface: detail-page header, BriefForm footer (edit mode), sidebar kebab menu item. Pragmatic motivation: «Preview output» is long enough that the row `[Cancel] [Save] · [Publish] [Preview output] [Run Now] [History]` wraps to two lines at the detail-page header in edit mode (issue D from the polish review). «Preview» — a single word — fits. Semantically it stays unambiguous: the word was over-descriptive. This is one of the rare cases where we rename a chrome label after ship; documented here.

PD2. **Sidebar kebab — menu reorder**. The current order («Edit / Run Now / History / Preview output / Publish») places Preview second-to-last, misaligned with its actual use frequency (Preview is the second most common action after Edit). New order: **Edit · Preview · Run Now · History · Publish/Unpublish**. Icons and per-item logic stay unchanged.

PD3. **BriefForm action-row — single-line layout in edit mode**. After PD1, the top-of-form action row holds, in one line: `[Cancel] [Save]` (left) · `[Publish/Unpublish] [Preview] [Run Now] [History]` (right). The two-row wrap that surfaced before PD1 disappears. The wrapping container keeps `flex-wrap` as a safety net for sub-`sm` breakpoints (even though the project is desktop-only per §5).

PD4. **Save gate: «empty prompt requires at least one CSV-enabled query»**. When `brief.prompt.trim() === ""` AND `brief.sources.every(s => s.queries.every(q => !q.csv))`, Save (or Create) MUST be disabled with a Catalan hint surfaced below the action row: «Sense prompt, almenys una query ha de tenir CSV activat per tenir contingut a publicar a Slack.» The validation lives in the zod schema as a `.superRefine()`; the error attaches to the brief root (cross-field), surfaced through the existing `validityHint` line in BriefForm. This is a **blocking** gate (the same level as the other required-fields validations) — not a soft toast.

PD5. **Dry-run BUG fix — raw-mode handling**. `/api/briefs/dry-run` MUST detect `brief.prompt.trim() === ""` server-side and emit `raw-mode-data` events (one per query) instead of calling GROQ. Event shape:
```ts
{ kind: "raw-mode-data", queryName: string, reportTitle: string, columns: string[], rows: object[], total_rows: number }
```
After all `raw-mode-data` events the server emits a `complete` event with `{ usage: null }` (no tokens — the field is nullable on the wire). The client (DryRunSheet) detects the first raw-mode event and transitions its state machine to the new `"raw-mode"` status. **No change to `executor.py`** — the production raw-mode logic has been correct since PR #69; only the Vercel-side dry-run path needs the parallel branch.

PD6. **DryRunSheet raw-mode UI**. When the first event is `raw-mode-data` (instead of `mode-fetched` or `groq-chunk`), the Sheet MUST render:
- **Info Alert at the top of the body**: «Aquest brief està en raw mode (sense prompt). No s'invoca cap LLM. Aquesta és la previsualització de què s'enviarà a Slack.»
- **Slack message mock**: a block reproducing exactly what the production executor would publish. Header line in font-mono: `📎 <Brief Name> — DD/MM/YYYY — volcat de dades` (identical to `executor.py:379`). Below it, a small list `N CSV attachments` with one item per query showing its estimated filename (`<query_slug>.csv`).
- **Per-query data preview**: for each query, a block with the query name + source report as header + a `PreviewTable` (the component reused from 17.0) showing up to **10 rows** + a footer «Showing 10 of N rows» when total > 10.
- **No token usage** at the foot (no LLM call happened).
- **No Cancel button** (raw mode doesn't stream GROQ; the Mode fetch is still cancellable via Sheet close as in the standard path).

PD7. **Empty-prompt + Preview triggers — uniform behaviour**. The three «Preview» triggers (detail header / form footer in edit / sidebar kebab) MUST stay **always enabled** regardless of whether the prompt is empty. The raw-mode detection is server-side inside `/api/briefs/dry-run` (PD5), not a client-side gate. Justification: the user may legitimately use Preview to validate what they'd see in Slack under raw mode; disabling the trigger would be counter-intuitive. No prior visual signal on the kebab — the context surfaces inside the Sheet when it opens (user decision recorded 2026-05-18).

PD8. **PreviewSheet resize handle — bug fix (17.0 regression)**. The visual handle (`GripVertical` at `inset-y-0 left-0` with pointer-capture) appears but drag is unresponsive (issue F from the polish review). Most likely root cause: the `GripVertical` SVG inside the handle div intercepts the `pointerdown` event before it reaches the parent listener (lucide icons are interactive by default). Fix: apply `[&_svg]:pointer-events-none` to the handle wrapper so the SVG no longer captures pointer events, and widen the visual handle to 6 px while extending the hit-test area to ~16 px via a `::before` pseudo-element (`before:absolute before:-left-1.5 before:-right-1.5 before:inset-y-0`). The drag remains discoverable but easier to grab.

PD9. **Resize handle applied to every right-side Sheet**. PromptAssistantSheet, DryRunSheet, HistoryDrawerButton and PreviewSheet MUST all expose the same resize affordance. Implementation via a shared `useResizableSheetWidth()` hook (see §7). Thresholds (matching the existing PreviewSheet values):
- `MIN_WIDTH = 480`
- `MAX_WIDTH = 1400`
- `DEFAULT_WIDTH = 672`
- LocalStorage key **shared** across all four Sheets: `right-sheet:width`. Resizing one re-calibrates all the others on the next open — coherent visual rhythm as the user alternates Sheets within a session (user decision recorded 2026-05-18: a single shared width, not per-Sheet).

PD10. **Vercel build skip — yellow setting**. The project's «Ignored Build Step» (`git diff --quiet HEAD^ HEAD ':(exclude)briefs/*.yml' && exit 0 || exit 1`) is currently flagged yellow because the Production deployment still runs the previous configuration (build always). Action: the new setting applies on the next Production deploy automatically. **No code change required**, just document the expected behaviour in README («Vercel skip-build script — production deploy is skipped when only `briefs/*.yml` files have changed»). If an operator wants to force-sync, a manual redeploy from the Vercel UI does it.

(Implementation tracked as **task 20.0** — pre-prioritised, in flight on branch `claude/prompt-design-tooling-rcLIR`. Decisions recorded with user 2026-05-18: 1.B resize handle present but drag broken, 2.A shared `right-sheet:width` localStorage key, 3 no kebab visual signal for raw-mode briefs, 4 Slack-mock + per-query 10-row tables for the raw-mode DryRunSheet body.)

## 5. Non-Goals (Out of Scope)

- ~~**Authentication and per-user briefs**. The platform is openly accessible; everyone sees and edits everything. The data model includes a nullable `owner_email` field reserved for a future auth phase but it is never populated in this version.~~ **SUPERSEDED 2026-05-16 by §4 «Authentication & Access Control»**: authentication is now required (magic-link, domain-restricted to `@cooltra.com` / `@felyx.com`), and `owner_email` is now populated on every brief. **Per-user data isolation remains out of scope**: every authenticated user still sees and edits every brief; `owner_email` is captured but does not gate any action.
- **Migration from YAML files to a database**. Briefs remain YAML in the repository for this version.
- **Per-query Slack channel override**. Within a single brief, all queries publish to the same channel (the brief's `slack_channel`). If you need different destinations for different queries, create separate briefs.
- **Channel metadata in the dropdown** (description, member count, last brief posted there, last activity). The dropdown shows only channel name and a public/private icon; richer metadata is a future iteration.
- **Auto-inviting the bot to a channel from the platform**. The platform tells the user the `/invite` command to run in Slack themselves; it never invites on the user's behalf (would require additional bot scopes and admin approval).
- **LLM model selection per brief**. The Groq model remains hardcoded in the executor (`llama-3.3-70b-versatile`). Adding per-brief model selection is a future improvement.
- **Real-time updates**. The platform polls on page load and on user actions; it does not push updates via WebSockets or Server-Sent Events.
- **Mobile-first UI**. The application is responsive but designed primarily for desktop use; mobile may have a degraded experience for the calendar view.
- **Bulk import/export of briefs**. Users create and edit briefs one at a time.
- **Custom prompts library / templates**. Users write prompts from scratch; there is no template gallery yet.
- **Approval workflows / drafts**. A save commits directly to `main`; there is no draft state or review flow today.

## 6. Design Considerations

- **Language policy** (added 2026-05-16 after user feedback on the 2.0 preview):
  - **UI chrome is always in English**: every clickable button label, every form field label, page headings, navigation entries, table column headers, status badges. Reason: teams across Cooltra share the vocabulary in English (e.g. «el _Slack channel_»), so support and documentation reference the exact words the user sees on screen.
  - **Narrative, help, and feedback strings are localised to the user's language** (default Catalan): inline help texts, validation error messages, toasts, dialog descriptions, loading / empty / error states, the «Carregat a HH:MM» indicator and similar status copy.
  - When localised text references a UI chrome element, the chrome term stays in English in line. Example: the form must render «El **Brief Name** és obligatori» (not «El nom del brief és obligatori»).
  - Multi-language support is **a confirmed future requirement**, not a maybe. This version intentionally ships localised strings inline (zod messages in `schemas.ts`, `FIELD_HELP` in `BriefForm.tsx`, toasts, dialog bodies, fallbacks, etc.) to keep the 2.0 diff focused. A dedicated task (see future-tasks 7.0 in the tasks file) will:
    1. Inventory every Catalan string in the web app.
    2. Move them into a single dictionary structure under `web/lib/i18n/<locale>.ts` accessed via a small `t(key)` helper.
    3. Pick the runtime mechanism — leaning toward an in-house dictionary now, swappable to `next-intl` later if locale-aware routing / pluralisation / formatted messages become necessary.
    4. Add the second language catalog (likely Spanish or English) and a locale switcher.
    Until that task is completed, all localised copy is the literal Catalan string in its component.
- **Help-text affordance**: every form field exposes its explanation behind a small **Info icon next to the label**. Hover (or keyboard focus) opens a shadcn Tooltip with the help text; on touch devices a tap toggles it. Originally implemented as a click-triggered shadcn Popover during 2.0; switched to Tooltip after user feedback that the icon felt empty on hover. Reason for hiding the help in the first place: when always-visible, the descriptions crowded the form visually. (Deviates from the original "no expandable tooltips" stance below, kept for history; the user revised the call after seeing 2.0 live.)
- **Form layout: Brief Name above, Content section, Distribution section.** The detail view is structured as a single `Brief Name` field at the top (the brief's identity), followed by two bordered cards:
  - **Content** card — what the LLM ingests + the metadata that travels with the message: the list of `Sources` (each one a Mode report plus its queries), the `Prompt`, and the optional `Reference link` (a URL appended to the Slack message). (Previously labelled "Inputs" until 2026-05-16.)
  - **Distribution** card — when and where the brief is published: `Schedule` and `Slack Channel`. (Previously labelled "Outputs"; Time Zone is no longer surfaced; see the next bullet.)
  This grouping was added after 2.0 user review to give users a mental model of the brief lifecycle (data in → LLM → message out) before they read any individual field.
- **Canonical UI labels** (the chrome strings that appear on screen and that support / documentation must reference; the corresponding YAML keys are shown in parens — see §4.6 for the structural data model):
  - Brief Name (`name`)
  - Schedule (`schedule`)
  - Slack Channel (`slack_channel`)
  - Reference link (`reference_link`, optional)
  - Sources (`sources[]`)
  - Mode report (`sources[].mode_report_token` — the "token" suffix is dropped from the label because it was jargon)
  - Queries (`sources[].queries[]`)
  - Query token (`sources[].queries[].token`)
  - CSV (`sources[].queries[].csv`)
  - Prompt (`prompt`)
  Schedule is shown without the "(cron)" suffix it carried during 2.0 — non-technical users were bouncing off the field. The cron syntax stays the internal representation but is no longer surfaced in the label. The visual builder (task 3.0) makes the syntax irrelevant to the user.
- **No per-brief Time Zone field**: every brief schedule is interpreted in the company-wide TZ (hardcoded `Europe/Madrid`, surfaced in the UI as "Catalunya"). Reason: the entire company operates on the same timezone, so the field was noise. The Schedule «i» tooltip mentions the TZ explicitly; the YAML no longer carries a `timezone:` field and the Python `due_runner.py` ignores any leftover value. If multi-TZ ever becomes a real requirement, re-introducing the field is straightforward (`resolve_tz` already accepts a name).
- **Required fields are marked with a red asterisk** next to the label. Validation runs continuously in the background to drive the disabled state of Save / Create, but field-level error messages (and the red `aria-invalid` border) are only shown after the user has touched the field or attempted to submit. The opening state of New-brief is clean: asterisks, a disabled Create button, no red noise.
- **Visual language**: continue with shadcn/ui aesthetic already established in the static dashboard (zinc palette, Inter font, JetBrains Mono for code/tokens, generous padding, subtle borders, rounded-lg). Reuse the design tokens.
- **Sidebar width**: ~280px on desktop. On screens narrower than `lg` (1024px), the sidebar collapses to a hamburger menu.
- ~~**Form fields with inline help**: each field renders as `<Label> + <Input> + <description below in small muted text>`. No expandable tooltips at first — just always-visible muted text. PLG philosophy: zero friction, zero hidden info.~~ Superseded by the "Help-text affordance" bullet above (Info-icon Tooltip) after 2.0 user review.
- **Cron visual builder** (`web/components/CronBuilder.tsx`, task 3.0): a vertical widget inside the Schedule field with two sections:
  - **Frequency**: a Select with `Cada dia` / `Cada hora` / `Dies de la setmana` / `Dia del mes`. Weekly mode reveals seven day-toggle buttons (Dl / Dt / Dc / Dj / Dv / Ds / Dg). Monthly mode reveals a 1–31 day picker. Hourly mode is a degenerate case of the Time section (see next bullet).
  - **Time**: hour Select (00–23) + minute Select (00 / 15 / 30 / 45). Minutes are locked to the grid; an off-grid cron drops the user into a Custom raw-input mode with a Reset-to-builder escape hatch. When **Cada hora** is selected, the hour Select is hidden and the section is relabeled "Minute" since the cron uses `*` for the hour position.
  Live preview below the controls shows the humanised sentence ("Cada dia a les 10:00", "Cada hora a les :30") and the generated cron expression in muted monospace. There is **no timezone section** — the company-wide TZ is hardcoded; see the "No per-brief Time Zone field" bullet above.
- **Slack channel selector**: shadcn/ui `Combobox` pattern — a button that opens a popover with a searchable list. Public channels show with a `#` icon; private channels show with a `🔒` icon. Channel names rendered in `font-mono` to match Slack's own visual convention. Empty state when the bot is in zero channels: a friendly message + the `/invite @<bot-name>` snippet.
- **"Bot not in channel" warning**: renders below the channel field as a shadcn/ui `Alert` (warning variant — yellow/amber, not red, because the situation is recoverable). Inside: one line of explanation + a code block with the `/invite` snippet + a small "Copy" button that triggers a transient "Copiat!" toast. A subtle "Refresh channels" link to re-query the list after the user invites the bot.
- **Calendar event color**: derive deterministically from the brief name (so each brief has a consistent color across the calendar regardless of who sees it).
- **Footer**: 12px text, `text-zinc-400`, fixed bottom-right corner with `padding 8px 12px`. Format: `Built from <sha7> · <commit subject truncated to 50 chars> · <DD/MM/YYYY HH:MM Madrid>`.
- **Right-side Sheets — shared resizable width** (added 2026-05-18 with task 20.0): the four right-side Sheets (Mode preview from 17.0, Dry-run Preview from 18.0, Prompt Assistant from 19.0, History drawer from 12.0) all expose a draggable resize handle on their left edge and share a single persisted width in `localStorage:right-sheet:width`. Defaults: `min 480 px`, `default 672 px`, `max 1400 px`. Resizing one Sheet re-calibrates all the others on the next open so the user has a coherent visual rhythm when alternating between them within a session.

## 7. Technical Considerations

### Frontend
- **Framework**: Next.js 14+ with App Router. Allows mixing SSR (for initial page loads with GitHub API data) and serverless API routes in one codebase.
- **Styling**: Tailwind CSS + shadcn/ui components (installed via `npx shadcn-ui@latest add`).
- **State management**: React Server Components + React Query for client-side mutations. No Redux/Zustand needed.
- **Form library**: react-hook-form + zod for schema validation (matches the YAML schema).

### Backend (serverless)
- **Hosting**: Vercel free tier (Hobby plan). Reasons: best Next.js DX, generous free limits (100GB bandwidth, 100GB-hr compute, free serverless functions), best React/shadcn ecosystem support.
  - *Alternative*: Cloudflare Pages + Workers (no cold starts, 100k requests/day free) if Vercel's limits become a concern.
- **API routes** in `app/api/`:
  - `GET /api/briefs`: lists all briefs (proxies to GitHub Contents API).
  - `GET /api/briefs/[name]`: returns one brief's content + sha.
  - `POST /api/briefs`: creates a new brief (commits a new YAML to the repo).
  - `PUT /api/briefs/[name]`: updates a brief (commits over the existing YAML, checking sha for conflicts).
  - `DELETE /api/briefs/[name]`: deletes a brief.
  - `GET /api/runs/[brief]`: returns the latest execution metadata from GitHub Actions artifacts.
  - `GET /api/version`: returns the latest commit sha, subject, and timestamp.
- **GitHub authentication**: a service GitHub App or PAT stored in Vercel environment variables. The PAT scopes: `contents:write` on this repository (plus `actions:write` once task 6.0 lands for the Test-run button).
  - *Note*: never expose this PAT client-side. All GitHub API calls go through the server.

### Next.js caching (server tree consistency)
- The root `app/layout.tsx` is marked `export const dynamic = "force-dynamic"`. The sidebar is a Server Component that fetches the brief list directly via `lib/briefs.ts:getBriefList()`; without `force-dynamic`, Next 16's auto-detection was leaving the layout statically rendered and the sidebar's RSC payload survived across mutations, so renaming or deleting a brief wouldn't reflect in the list until a full reload.
- Every mutation endpoint (`POST /api/briefs`, `PUT /api/briefs/[name]`, `DELETE /api/briefs/[name]`) MUST call `revalidatePath("/", "layout")` right after the GitHub commit lands, so the next `router.refresh()` from the client renders a fresh sidebar. Any future endpoint that mutates a brief MUST follow the same pattern (e.g., task 6.0's Test dispatch does NOT need this — it doesn't change YAML — but a future "duplicate brief" or "rename brief" endpoint would).
- `lib/github.ts:ghFetch` sets `cache: "no-store"` on every GitHub API call so the Data Cache layer is opted out too. This is belt-and-suspenders alongside `revalidatePath`.

### Slack channel discovery
- New API endpoint `GET /api/channels`: server-side calls Slack `conversations.list` with `types=public_channel,private_channel`, filters where `is_member: true`, and returns `[{name, is_private}]`. Strips out everything else.
- **Additional bot OAuth scopes required**: `channels:read` (public channels) and `groups:read` (private channels). Adding these requires reinstalling the Slack app and likely re-approval from the workspace admin. Document this clearly in the migration runbook for this version.
- **Caching**: in-memory cache with 5-minute TTL, keyed globally (no auth yet → no per-user cache). The "Refresh channels" UI affordance hits `GET /api/channels?force=true` to bust the cache.
- **Rate limit awareness**: `conversations.list` is Slack Tier 2 (~20 req/min). With 5-minute caching, even sustained UI usage stays well within limits.
- **Pagination**: Slack returns up to 200 channels per call with cursor pagination. The endpoint must follow the cursor until exhausted. Cooltra's workspace is unlikely to exceed 200 channels the bot is in, but the implementation should be correct from day 1.

### Cron visual builder → cron string
- Output canonical 5-field cron strings (`m h dom mon dow`).
- Use a small open-source library if helpful (e.g., `cron-builder`) or build a minimal custom function. The output must round-trip: reading a cron from YAML should be displayable back in the builder.
- Time validation: only allow `:00`, `:15`, `:30`, `:45` minutes to keep the UI simple. If a brief has a cron from outside this grid (e.g., `7 8 * * *`), the builder shows it as "Custom" and allows raw editing.

### Scheduling reliability (~~known limitation~~ — **SUPERSEDED 2026-05-17 by Vercel Cron migration; see next subsection**)

- ~~The master scheduler workflow (`.github/workflows/run-due-briefs.yml`) runs on cron `*/15 * * * *` (UTC) and `due_runner.py` uses a matching 15-minute window so each scheduled brief fires exactly once per period.~~
- ~~**Limitation**: GitHub Actions free-tier `schedule` triggers are best-effort and frequently delayed by 5–30 minutes (worst case longer). If the delay for a given tick exceeds the 15-minute window, that scheduled execution is **lost** — the next scanner tick will see the brief as out-of-window and won't fire it.~~
- ~~**Why we don't fix it in this version**: making the window wider re-introduces duplicate runs; making the cron more frequent reduces the safe window proportionally.~~
- ~~**Mitigation**: task 6.0's `Run Now` button doubles as the user-facing recovery path.~~

**Status 2026-05-17**: the "5–30 min delay" observed in production turned out to be much worse (~1 fire/hour vs the expected 4x with `*/15`). Task 14.0 moves the ticking layer off GH Actions onto Vercel Cron — see «Scheduler reliability via Vercel Cron» below for the new architecture. The Run Now button (task 6.0) survives as a manual recovery path but is no longer the primary mitigation for scheduler drift.

### Scheduler reliability via Vercel Cron

- **New endpoint**: `web/app/api/scheduler/tick/route.ts`, runtime `nodejs` (NOT `edge` — the existing GitHub library imports break under edge), `export const dynamic = "force-dynamic"` (every invocation re-reads `briefs/` from GitHub via the existing pipeline, no caching). Method: **`GET`** — Vercel Cron always issues GET requests; this is documented behaviour and not configurable per cron entry. (Was POST in the initial 14.4 implementation; corrected in 14.9 after the cutover surfaced a 405 streak. The auth header is injected on both methods, so the authorize() flow is identical.)
- **Vercel Cron configuration**: `vercel.json` at the **`web/`** directory root (since Vercel's Root Directory for this project is `web` per task 1.5), containing `{ "crons": [{ "path": "/api/scheduler/tick", "schedule": "*/5 * * * *" }] }`. The schedule field is **UTC** (Vercel does not accept a TZ argument); the cron evaluation INSIDE the endpoint converts to `Europe/Madrid` via `cron-parser`. **Requires Vercel Pro plan**: Hobby tier limits cron resolution to daily, which would not solve the problem. Confirmed with operator 2026-05-17 (decision 1.A).
- **`isDue` reimplementation in TypeScript**: new helper `web/lib/scheduler.ts:isDue(schedule, now, windowMs)`. Implementation: `CronExpressionParser.parse(cron, { currentDate: now, tz: "Europe/Madrid" })`, call `.prev()` to obtain the previous fire instant, compute `(now.getTime() - prev.getTime()) < windowMs`. The TS port is 5 lines; sharing with the Python `due_runner.py` predicate via subprocess or FFI would dwarf the duplication. Semantic equivalence to Python is documented in S2 (strict bound for Vercel vs inclusive bound for GH Actions) and S4 (same TZ).
- **`WINDOW_MS` constant**: 300_000 (5 min). Matches the Vercel Cron interval `*/5`. The Python `WINDOW_SECONDS = 15 * 60` constant disappears together with `due_runner.py`.
- **Why no shared library between Python `due_runner.py` and the TS endpoint**: the Python executor still runs inside `run-brief.yml` to do the actual brief work (Mode → GROQ → Slack); the TS endpoint replaces only the *scanner* layer. Cross-language sharing of a 5-line `isDue` predicate is not worth a build step.
- **Auth secret rollout**: `CRON_SECRET` is a 32+ byte random string added to Vercel env vars (Production + Preview, encrypted). Operator generates with `openssl rand -hex 32`. Vercel Cron uses the production value at runtime; preview smoke tests pass the preview value via `curl -H`. The secret is documented in the project's env-var inventory alongside `GITHUB_TOKEN` etc.
- **No retries on dispatch failure**: a failure to dispatch one brief (GitHub API down, rate-limited, …) is logged via `console.error` and surfaced in the response `failures[]`. The next 5-min tick will re-scan; if the failed brief's window is still open, it gets a second chance. An explicit retry inside the same tick would risk blowing Vercel's function timeout (60s sync max on Pro) when GitHub is slow, and would not improve resilience meaningfully given the natural retry cadence.
- **Observability**: the structured `console.log` line (S6) appears in Vercel Function Logs immediately. No external monitoring / alerting is wired in this iteration — operator-driven sidebar-capture verification (S8) is the chosen sufficiency criterion. The success metric in §8 ("99% of writes succeed") implicitly covers scheduler health: a failing tick means due briefs don't dispatch, which surfaces as missing executions in `/history` and missing Slack messages.
- **Cold start mitigation**: a 5-min cron on a small Node function reliably stays warm. No `runtime: edge` necessary; `nodejs` keeps parity with the rest of `web/app/api/*`.
- **Files retired in this task**: `.github/workflows/run-due-briefs.yml`, `scripts/due_runner.py`. README's Repository Layout section drops the corresponding lines. The `run-brief.yml` workflow (called by `dispatchBriefRun`) is untouched.
- **Rollback path**: revert the PR. The old `run-due-briefs.yml` + `due_runner.py` return; GH Actions resumes ticking on the next available slot. Worst-case latency is back to pre-fix (the problem this task fixes) but no data loss. Rollback is a single `git revert <merge-sha>` — atomic with the original cutover.

### Sidebar brief actions menu

- **Shared hook `useRunNow(filename)`**: extracted from the 6.0 `RunNowButton` so two consumers (the existing header button and the new kebab menu item) can share state. Returns `{ running, onCooldown, remainingSeconds, dispatch }`. Persists the cooldown deadline in `localStorage:runnow:<filename>` (unchanged key from 6.0 — old deadlines persist across the refactor), syncs same-tab consumers via the new `runnow:dispatched` window CustomEvent (cross-tab sync was already implicit via `storage` events when the user came back to the tab). Toasts and dispatch endpoint behaviour are unchanged.
- **`BriefRowMenu` (new component)**: client component, rendered once per sidebar row inside an absolutely-positioned wrapper. Uses the existing shadcn `Popover` primitive (no new shadcn install — `dropdown-menu` would have been ideal but `Popover` already covers the 3-action vertical list we need with the styles we already use elsewhere). Three menu items: `<Link>` to `/briefs/<filename>?edit=1`, `<button>` calling `useRunNow().dispatch`, `<Link>` to `/briefs/<filename>?history=1`. The kebab `<button>` calls `e.preventDefault(); e.stopPropagation()` on click so a hit on the kebab doesn't bubble up to the row's `<Link>` and navigate away.
- **Sidebar row restructure**: the previous row was a single `<Link>` wrapping the entire fila. New row is a `<div className="group relative">` containing (1) the `<Link>` with `pr-9` to reserve horizontal room for the kebab and (2) the `BriefRowMenu` absolutely positioned at top-right. `group-hover` on the wrapper drives the kebab's opacity transition. Tooltip-on-truncated-name behaviour is preserved by wrapping only the `<Link>`, not the kebab.
- **Detail page `searchParams` plumbing**: `app/briefs/[name]/page.tsx` switches from `{ params }` to `{ params, searchParams }`. The page reads `searchParams.edit` and `searchParams.history` server-side and passes `initialMode` to `<BriefForm>` and `initialOpen` to `<HistoryDrawerButton>`. Both props are nullable — the page is unchanged for direct navigation without query params.
- **`HistoryDrawerButton.initialOpen`**: new optional prop. When `true`, the `open` state initialises to true AND a `useEffect` fires the data load once on mount. Without the useEffect, the drawer would open empty for a beat before the click handler kicked in — the load was previously gated on the open transition.
- **`BriefForm.initialMode`**: new optional prop. `useState<FormMode>(isCreate ? "edit" : (props.initialMode ?? "view"))`. Default behaviour preserved for existing call-sites.
- **Why Popover instead of shadcn DropdownMenu**: the project hasn't installed `dropdown-menu` (per `web/components/ui/` inventory). Popover + manually-styled menu items keeps the diff contained to the feature instead of adding a new shadcn primitive whose only consumer is this menu. If a second kebab consumer appears (e.g. a `/schedule` row menu), the right refactor would be to install `dropdown-menu` and migrate both call-sites; a yagni for the current single consumer.
- **Why don't strip the query params after activation**: refreshing a `/briefs/<slug>?edit=1` page re-lands in edit mode, which matches user intent (the user explicitly entered edit mode and a refresh shouldn't kick them back to view). Same logic for `?history=1`. The cost is URL clutter — acceptable since the action vectors are internal (kebab clicks) rather than shareable links.

### Publish / Unpublish brief

- **Schema** (`web/lib/schemas.ts`): `briefSchema` grows a `published: z.boolean()` field. **No `.default(true)` on the zod schema** because RHF input/output types diverge when a `default` is set and the existing form code reads `published` directly. Instead, `parseBrief` (`web/lib/yaml.ts`) normalises a missing or non-boolean YAML value to `true` so legacy briefs round-trip cleanly even before the PT2 migration commit. `serializeBrief` emits the field explicitly in every YAML it writes; the canonical key order in `EMITTED_KEYS` gains `published` immediately after `name` so the field is the first thing the human reader sees.
- **Migration commit** (PT2): a single commit on the same PR that ships task 16.0, touching every `briefs/*.yml` to add `published: true`. Executed via a one-shot script (`scripts/add_published_field.py`, then deleted in the same PR — the file is single-use migration code, not operational). Verification: `git diff` on the migration commit shows N lines added (`published: true`), zero lines removed.
- **Scheduler change** (`web/app/api/scheduler/tick/route.ts`): one-line filter added after `parseBrief` and before the `isDue()` loop:
  ```ts
  const candidates = briefs.filter((b) => b.published !== false);
  ```
  Default-true semantics live in `parseBrief`, so the predicate here is `!== false` not `=== true` — defensive against any edge case where a brief somehow lands without the field after the migration. `skipped_draft = briefs.length - candidates.length` flows into both the JSON response and the structured `console.log` payload.
- **Form changes** (`web/components/BriefForm.tsx`):
  - New shadcn primitive: `npx shadcn@latest add switch`. The Switch is the only new shadcn install in this task.
  - The form's title-row toolbar (currently `[Run Now] [History]` in view mode, `[Save] [Cancel]` in edit) gains a `<PublishedToggle>` to the left of Run Now. View mode: read-only Switch + a small inline status label. Edit mode: interactive Switch bound via `Controller` to `published`. The Switch's `onCheckedChange` updates RHF state; Save commits.
  - Page header badge: new `<PublishedBadge published={...}>` mounted next to the brief name (in `app/briefs/[name]/page.tsx`'s title rendering). Server-rendered from the parsed brief so the badge is visible immediately on landing, no client hydration flash. The detail page receives `published` for free since it's already parsing the brief.
- **Sidebar changes** (`web/components/BriefSidebarList.tsx`):
  - The row builder receives `published` per item (added to `getBriefListWithRuns`'s shape with no perf cost — the YAML is already parsed for the rest of the row data).
  - Conditional class: `cn("group ...", !published && "opacity-60")`. Existing `tooltip-on-truncated-name` behaviour preserved.
  - A small `<DraftChip>` (font-mono `text-[10px]`, zinc background, rounded) rendered inline after the brief name when `!published`. Truncation behaviour: the chip is `shrink-0` and the name span retains `truncate`, so the chip never gets clipped; long names truncate as before.
- **`/schedule` changes** (`web/app/schedule/page.tsx` / `ScheduleTable`): same `published`-aware row styling. The `Proper enviament` cell gains a conditional Tooltip wrapper when `!published`, body «Aquest brief està despublicat — el cron no s'aplicarà fins que es publiqui». No sort changes.
- **Run Now dialog**: the existing `RunNowButton` (`web/components/RunNowButton.tsx`) and the kebab menu item (`web/components/BriefRowMenu.tsx`) currently call `dispatch()` directly. Both paths gain a check: if `brief.published === false`, open a shadcn `Dialog` first. The dialog body is a thin component (`<DraftRunConfirmDialog>`) reused by both call-sites. Confirming the dialog calls the same `dispatch()` — same code path, same cooldown semantics, same toast. The dialog is **not** centralised in a hook because each call-site already manages its own popover/menu state; adding a shared hook would double the surface area for a single shared dialog.
- **API endpoints**: no new endpoint. `POST /api/briefs` and `PUT /api/briefs/[name]` already serialise the full payload; the schema change above is enough. The `getBriefListWithRuns` helper (used by sidebar + `/schedule`) needs `published` propagated through the row shape — one-line addition.
- **No client-side bust of the scheduler cache**: the scheduler endpoint reads briefs fresh on every tick (`no-store` via `lib/github.ts:ghFetch`), so toggling publish on a brief takes effect on the very next tick (≤ 5 min). No additional invalidation needed.
- **Why drafts-by-default for new briefs**: confirmed with user 2026-05-17. Removes the risk of an accidental Slack post landing while the prompt is still half-written. The cost — one extra click on the Switch when the user is ready to ship — is trivial compared to the cost of accidentally publishing a malformed brief into a live channel. (Existing briefs migrate to `published: true` precisely to preserve the live behaviour they already had; only NEW briefs are affected by the default.)

### Mode data preview

- **New `web/lib/mode.ts` helpers** (in the same file that already hosts `listSpaceReports` + `listReportQueries`, sharing `getConfig()` + `authHeader()`):
  - `listReportRuns(reportToken)` — `GET /reports/{token}/runs`. Returns the embedded `runs[]` array sorted descending by `completed_at`. Mode's API already returns recent-first, but we sort defensively because the field is documented as "approximately ordered".
  - `findLatestSucceededRun(reportToken)` — wraps the above, returns the first run whose `state === "succeeded"` or `null` when none exists. The endpoint distinguishes `null` (→ `kind: "no-previous-run"`) from "runs exist but newest is failed" (→ `kind: "run-failed"`, surfacing the latest run's state) by also peeking at `runs[0]` when the filter is empty.
  - `listQueryRunsForRun(reportToken, runToken)` — `GET /reports/{token}/runs/{runToken}/query_runs`. Returns the `query_runs[]` array (each with `token`, `query_name`, `state`).
  - `getQueryRunResults(reportToken, runToken, queryRunToken)` — `GET /reports/{token}/runs/{runToken}/query_runs/{queryRunToken}/results/content.json`. Returns an array of row objects matching exactly what the Python `executor.py:get_query_results` returns. Mode caps the JSON response at ~1k rows; if a query happens to be larger, we slice to `limit` after fetch (the API doesn't expose a server-side limit param).
- **New endpoint** `web/app/api/mode/preview/[report]/[query]/route.ts`: runtime `nodejs`, `export const dynamic = "force-dynamic"`. Orchestrates the four helpers above. The discriminated-union response (`kind: "ready" | "no-previous-run" | "run-failed" | "query-not-found"`) is HTTP 200 in every "expected" state; only Mode 5xx / auth / network errors return 502. Rationale: every non-`ready` state is informational and the client renders it with a specific message — wrapping them in 4xx would force the client into an error-handling code path for normal user states.
- **Shared cache pattern**: a module-level `Map<string, { fetchedAt: number; data: PreviewResult }>` with `TTL_MS = 5 * 60 * 1000`. Cache key is `<reportToken>:<queryToken>:<limit>` so two simultaneous previews on different queries don't collide. `?force=true` deletes the entry before re-fetching. Identical structure to `lib/channels.ts` and the cache inside `/api/runs/[brief]`.
- **`PreviewSheet` client component** (new, `web/components/PreviewSheet.tsx`): a shadcn `Sheet` (side="right") that the BriefForm controls via a `preview` state slice `{ open, reportToken, queryToken } | null`. The Sheet is mounted once at the BriefForm root; opening / closing / switching queries flows through that single state, so we never paint two Sheets at once. Inside, a `useEffect` keyed on `[reportToken, queryToken]` fires the `/api/mode/preview/...` fetch on every change; the in-flight request is aborted via `AbortController` when the user re-opens for a different query.
- **`PreviewTable` sub-component**: a thin presentational `<table>` with `min-w-full` + `overflow-x-auto` on the wrapper, JetBrains Mono for cell content. The cell renderer is a `function renderCell(value: unknown): ReactNode` that handles `null` / `number` / `string` / `boolean` / nested object distinctly, and clamps long content with `truncate` + Tooltip showing the raw value. Pure function — easy to unit-test if we ever add a test layer.
- **`PreviewButton` (new) lives inside `BriefForm`'s query row** between `<QueryCombobox>` and the trash icon. Uses lucide `Eye` + the "Preview data" English label, ghost variant, size sm. Disabled state is computed from `watch("sources.<i>.mode_report_token")` + `watch("sources.<i>.queries.<j>.token")` via RHF; an `aria-disabled` + Tooltip carry the help copy. Click handler calls a `setPreview({ open: true, reportToken, queryToken })` provided by the form's preview state hook.
- **Why we don't trigger a fresh run from the preview**: confirmed with user 2026-05-17. (1) latency: a fresh run is 30–120 s, the user would abandon the panel before it loaded; (2) Mode cost: each run consumes execution capacity on the Mode account, and an iterating user could trivially fire 20–50 previews per session; (3) the *thing the user is validating* is the wiring (right report, right query, recognisable columns) — fresh data is irrelevant to that question. The Run Now button (task 6.0) remains the path to "I want fresh data delivered to Slack".
- **Mode API rate limits**: undocumented but observed to be generous (~hundreds of req/min). Our 5-min cache + the natural cadence of user interaction (open Sheet → read 10 rows → close → maybe re-open in 30 s) keeps us comfortably below any plausible ceiling. If rate-limit 429s start surfacing in production we'll add a small `Retry-After`-aware backoff layer.
- **Why no `force-dynamic` cache invalidation across mutations**: previews are read-only with respect to the brief lifecycle — they don't depend on `briefs/*.yml` state. The 5-min TTL is the only invalidation knob the user needs; the in-form Refresh button delivers it.

### Dry-run output

- **TypeScript port of the executor pipeline**, NOT a re-implementation: the dry-run endpoint reuses `web/lib/mode.ts` (already in place since 8.0 / 17.0 — Basic auth + report runs + query runs + results) and adds a small new `web/lib/groq.ts` (~80 lines: HTTP wrapper over the GROQ chat completions endpoint with streaming SSE support via the `groq-sdk` npm package — same package the Python executor uses transitively, so the model contract is identical). The orchestration lives in a new `web/lib/dryRun.ts` that fetches Mode data via the same code path the production executor walks (trigger report + wait + fetch — NOT the «last succeeded run» shortcut from 17.0; dry-runs validate the GROQ output against fresh data the same way Run Now does), builds the `user_message` with the same JSON shape as `executor.py:build_user_message`, and calls `groq.chat.completions.create({ stream: true })`. Token counts come from the SDK's usage field, mirrored 1:1 to ExecutionMetadata's `{ input, output, total }` shape.
- **New endpoint** `web/app/api/briefs/dry-run/route.ts`: runtime `nodejs`, `export const dynamic = "force-dynamic"`. Method `POST`. Body is the full Brief payload validated via `briefSchema`; rejects 400 with zod errors on validation failure. Response is `text/event-stream` (SSE) with the event types from D8. The handler awaits Mode (~5-10 s for trigger + poll + fetch) then forwards GROQ chunks one-by-one as `groq-chunk` events; finishes with a `complete` event carrying token usage.
- **Aborting**: the handler reads `request.signal` and passes it to the GROQ SDK call. When the client closes the EventSource (Cancel button or Sheet dismiss), the signal aborts; the SDK closes the GROQ HTTP connection; the server-side function exits cleanly without writing anything else. The Vercel serverless timeout (60 s on Pro) is well above the expected 5-15 s end-to-end, so an abort never races with a function-level timeout in normal operation.
- **`DryRunSheet` client component** (new, `web/components/DryRunSheet.tsx`): a shadcn `Sheet` (side="right") that consumes a `dryRun` state slice `{ open: boolean; payload: Brief | null } | null`. Opens with a payload, fires the POST, parses the SSE stream via `EventSource` + manual line splitting (Vercel's edge proxy doesn't reliably support EventSource yet; we use `fetch` + `ReadableStream` reader instead — same pattern Vercel's own docs recommend for streamed Node-runtime endpoints). State machine: `loading-mode` → `streaming-groq` → `ready` | `cancelled` | `error`. Re-renders on every chunk; `<BriefMarkdown>` (the 12.0 component) wraps the accumulated text so headers / lists / code blocks render incrementally.
- **`DryRunButton` (new)**: ghost variant + lucide `Sparkles` icon + English label «Preview output». Two prop shapes:
  - `{ mode: "persisted"; brief: Brief; }` — used by the detail-page header + sidebar kebab. Sends `brief` (the parsed YAML) as the payload.
  - `{ mode: "form"; getBrief: () => Brief; }` — used by the form footer. The form passes a closure that reads the current RHF form values at click time (NOT at render time) so the payload reflects the latest edits even when the user has been typing for the last few minutes.
- **Trigger surfaces**: three consumers share the same `DryRunSheet` instance via React Context (new `web/hooks/useDryRun.tsx` exports a provider mounted at the BriefForm root + a hook). Calling `useDryRun().run(payload)` opens the sheet with the given payload; closing or cancelling clears the state. Three consumers because the same iteration cycle has three natural entry points (the form during edit, the detail header for «what does this brief say today», the sidebar for one-click without navigating).
- **No persistence**: D11 means the endpoint NEVER writes to `out/`, never appends to `/api/briefs/[name]/outputs` (which is the artifact-backed read path), never touches the GitHub API. The endpoint is pure compute + stream — same way a chatbot reply is rendered but never archived unless the user explicitly saves it.
- **Why we can NOT just call `executor.py` via a subprocess**: Vercel functions can't shell out to Python. Even if they could, the executor is designed around full side-effects (Slack post, artifact write, GitHub commit on `--update-brief`); pulling it apart into a side-effect-free path means re-implementing the Mode + GROQ legs anyway. The TypeScript port is honest about that and keeps the two execution paths (production executor.py vs Vercel dry-run) in clear separation — neither one impacts the other if it breaks.
- **GROQ SDK choice**: the official `groq-sdk` npm package mirrors the OpenAI SDK API (`chat.completions.create` with `stream: true` returning an async iterator). Already battle-tested by the Python executor against `llama-3.3-70b-versatile`; the JS SDK uses the same model identifiers, so the output fidelity should be identical.
- **Model identifier source of truth**: `LLM_MODEL = "llama-3.3-70b-versatile"` lives at the top of `lib/groq.ts` and is the only place the model is referenced in the web app. Future model upgrades touch `executor.py:LLM_MODEL` AND `lib/groq.ts:LLM_MODEL` — a small annoyance acceptable for v1; a future task can extract this to a shared config if model swaps become routine.
- **Why GROQ_API_KEY needs Vercel placement**: the executor's `GROQ_API_KEY` env var lives only on GitHub Secrets (consumed by `run-brief.yml`). The dry-run endpoint runs in Vercel functions, so the same key must exist there. Operator copies the value from the GitHub Secret into Vercel's env-var UI (Production + Preview, encrypted). Same one-time setup as other task rollouts (CRON_SECRET in 14.0, MODE_TOKEN/SECRET in 8.0). Documented in the README env-vars list at ship time.

### Prompt Assistant

- **Reuse of `lib/groq.ts`**: the assistant calls the SAME `streamChatCompletion` wrapper introduced in task 18.0, with a different `systemPrompt` + `userMessage` shape. No new SDK install, no new env var beyond what 18.0 already requires. If 18.0 isn't merged yet (the two branches are independent), this task's branch carries its own copy of `lib/groq.ts`; the second-to-merge PR deduplicates trivially — same convention as the `lib/mode.ts` helpers shared between 17.0 and 18.0.
- **System-prompt builder** (`web/lib/promptAssistant.ts`): a server-only function `buildSystemPrompt({ briefName, currentPrompt, sources, fewShot })` that composes the system message. The structure is fixed (no per-user variation) and lands as a single string ready to feed `streamChatCompletion`. Key sections:
  1. **Role description** — «Ets un assistent que ajuda usuaris de Cooltra a escriure prompts per a briefs LLM. Els briefs llegeixen dades de Mode i les transformen en missatges de Slack.» (in Catalan because the user's chat will be in Catalan; the assistant matches the user's language by training).
  2. **Output contract** — instructs the model to wrap any complete suggested prompt in `<suggested_prompt>...</suggested_prompt>` tags. The client component (A6) scans for these tags to surface the «Apply this prompt» button only on messages that contain one. Chitchat-style replies («Què vols que faci?», «Quina mida prefereixes?») don't carry the tag and don't show the button.
  3. **Current brief metadata** — name, prompt (or «(buit, encara no escrit)» when empty), sources list.
  4. **Few-shot block** — 3 best-crafted briefs from the repo (selected via the «longest prompt» heuristic). Each shown as `Brief: <name>\nSources: <report> / <queries>\nPrompt:\n<prompt>` blocks.
- **Few-shot selection** (`buildFewShot()`): calls `getBriefList()` (already in `lib/briefs.ts`), filters to briefs with `prompt.length > 200`, sorts by length desc, takes 3. If fewer than 3 qualify, falls back to all available briefs (small-repo case). Each selected brief gets parsed once via `readBrief()` to read its full content. The cost is 3 GitHub API reads per chat-session-startup — acceptable since the result is cached per-request via a small in-memory `Map` (5-min TTL, keyed by the empty string since the few-shot doesn't vary per brief).
- **New endpoint** `web/app/api/briefs/prompt-assist/route.ts`: runtime `nodejs`, `dynamic = "force-dynamic"`. POST handler reads `{ messages: ChatMessage[], context: { briefName, currentPrompt, sources } }`, calls `buildSystemPrompt`, prepends it as a system role to the GROQ chat. Streams the response as SSE (same wire shape as the dry-run endpoint: `data: { kind: "delta", delta }` chunks, `data: { kind: "complete" }` terminator, `data: { kind: "error", message }` on failure). `request.signal` propagated to the SDK so Stop works.
- **`PromptAssistantSheet` client component** (new): owns the chat state machine and the SSE consumer. State shape: `{ messages: ChatMessage[]; status: "idle" | "streaming" | "error"; pending: string }` where `pending` is the in-flight assistant message being built up chunk-by-chunk. On send: appends user message, fires fetch, accumulates deltas into `pending`, on complete moves pending → messages. localStorage persistence via a `useEffect` keyed on `messages` (debounced if needed — 50-message cap so reads stay sub-ms).
- **`PromptAssistantContext`** (new, `web/hooks/usePromptAssistant.tsx`): provider mounted at the BriefForm root exposing `{ applyPrompt(text: string): void }`. The BriefForm wires it to `setValue("prompt", text, { shouldDirty: true })` + flipping `mode` to `edit` if currently in view. The Sheet consumes the context via `usePromptAssistant()`.
- **«Apply this prompt» tag parsing**: a regex `/<suggested_prompt>([\s\S]*?)<\/suggested_prompt>/` scans every assistant message at render time. When matched, the captured text becomes the payload for the «Apply this prompt» button. The tags themselves are stripped from the displayed message (the user sees clean prose, the assistant gets the structured tag for the button to fire). If the assistant emits multiple suggested prompts in one message (unusual but possible), only the FIRST is applied — keep the UX simple in v1.
- **localStorage key + schema**: `prompt-assistant:<filename>` stores `{ version: 1; messages: ChatMessage[]; updatedAt: ISO8601 }`. The `version` field future-proofs the format — if a future revision changes the message shape, the client can detect and migrate or wipe. 50-message cap enforced on every save (shift the front when over).
- **Why no PRD edit by the assistant**: A12 makes this explicit. The assistant is a *writing aid*, not an *editor*. It proposes text; the user applies it explicitly via the button; the form's standard Save flow does the GitHub commit. No magic side-effects.
- **Why the chat is per-brief, not global**: a user iterating Brief A and then Brief B has totally different contexts (different sources, different goals). Sharing a single chat history would muddle the LLM's understanding. Per-brief keying isolates the conversations cleanly at the cost of «I had a clever trick on Brief A and want to repeat it on Brief B» — acceptable; the user copy-pastes manually.

### Prompt-design tooling polish & raw-mode handling

- **`/api/briefs/dry-run` raw-mode branch** (`web/app/api/briefs/dry-run/route.ts`): after the zod parse, before calling `runDryRun`, check `brief.prompt.trim() === ""`. When empty, switch to an alternative generator `runRawModeDryRun(brief, signal)` that reuses `fetchAllSources()` from `dryRun.ts` (extracted as a public export) and emits `raw-mode-data` events instead of GROQ chunks. The existing SSE handler already consumes arbitrarily-typed events; only a new entry on the client state machine is needed.
- **`dryRun.ts` minimal refactor**: `fetchAllSources()` moves from private to exported so it can be reused from the new raw-mode branch. Signature unchanged. `runDryRun` keeps its current shape (GROQ path).
- **`useResizableSheetWidth()` hook** (`web/hooks/useResizableSheetWidth.tsx`, new): returns `{ width: number; handleProps: { onPointerDown, onPointerMove, onPointerUp } }`. Encapsulates the `MIN/MAX/DEFAULT_WIDTH` constants, the `right-sheet:width` localStorage key, and the pointer-capture drag logic that currently lives inline in `PreviewSheet.tsx`. The four right-side Sheets consume it identically. The visual handle (the GripVertical-bearing div) and the `<SheetContent style={{ width }}>` plumbing stay with the consumer — each Sheet may want subtle styling differences without touching the hook.
- **Resize hit-area fix** (PD8): on the handle div, apply `[&_svg]:pointer-events-none` so the inner `GripVertical` SVG doesn't intercept `pointerdown` before the wrapper listener fires. Widen the visual handle from `w-3` (12 px) to `w-1.5` (6 px) but extend the hit-test 4 px beyond each edge via `before:absolute before:-left-1.5 before:-right-1.5 before:inset-y-0 before:content-['']` so the user has ~16 px of cursor area without the handle dominating the Sheet edge visually.
- **DryRunSheet state machine** (PD6): add a `"raw-mode"` status with sub-payload `{ queries: Array<{ queryName, reportTitle, columns, rows, total_rows }> }`. Transition: first `raw-mode-data` event → status → `"raw-mode"`; subsequent `raw-mode-data` events append to `queries[]`; `complete` event (with `usage: null`) finalises but stays in `"raw-mode"` status (no `ready` transition because no streamed text exists to display).
- **Slack message mock helper** (`web/lib/dryRunPreview.ts`, new — tiny ~30-line file): pure function `buildSlackRawModePreview(brief): { headerText: string; attachments: Array<{ filename: string }> }`. Mirrors the production logic at `executor.py:post_brief_to_slack` raw-mode branch. Filename generation reuses the slug logic from `executor.py:355-356` (`slugify_for_filename`) ported to TS — a 5-line regex-based helper.
- **PreviewTable reuse**: the component shipped in 17.0 already accepts `{ columns, rows, total_rows }` in exactly the shape the `raw-mode-data` events emit. Zero change to PreviewTable.
- **zod cross-field validation** (PD4): `briefSchema.superRefine((brief, ctx) => { ... })` added at the schema's top level in `web/lib/schemas.ts`. The error attaches as a root issue with a specific code (`empty-prompt-needs-csv`) so the `validityHint` rendering in BriefForm can branch on it and surface the Catalan copy. Existing per-field errors (Brief Name required, etc.) keep their current shape.
- **«Preview» rename — chrome surfaces to touch** (PD1): `BriefRowMenu.tsx` (kebab item label + reorder per PD2), `DryRunButton.tsx` (English label), `BriefForm.tsx` (form-footer button), `app/briefs/[name]/page.tsx` (header button). No change to the endpoint, `useDryRun` hook, or DryRunSheet internals — pure chrome refactor.
- **Single-row action layout** (PD3): the wrapping `flex flex-wrap items-center justify-between gap-3` is kept as-is (flex-wrap stays as a safety net). The fix is solely a consequence of PD1's shorter chrome — at `lg` (1024 px) and up, the new label list fits in one line.

### Execution tracking
- Modify `scripts/executor.py` to write a JSON file `out/<brief-slug>.run.json` per execution, containing:
  ```json
  {
    "brief": "...",
    "started_at": "ISO-8601",
    "finished_at": "ISO-8601",
    "status": "success|failed",
    "tokens": {"input": 1234, "output": 567, "total": 1801},
    "error": null
  }
  ```
- Add an `actions/upload-artifact@v4` step to the workflows to upload `out/` as an artifact named `run-<brief-slug>-<timestamp>`.
- The frontend reads via `GET /repos/{owner}/{repo}/actions/artifacts` and the latest artifact for each brief.

### CSV per query (schema migration)
- New schema:
  ```yaml
  sources:
    - mode_report_token: 7b89f8a2f8d8
      queries:
        - token: 4c71991707f0
          csv: true
  ```
- The executor MUST be updated to read CSV per-query rather than per-brief. The existing brief-level `csv` field SHOULD be removed (no backward compatibility — only two briefs to migrate, both done in this rollout).

### Future-readiness for auth
- Every brief YAML MUST contain an optional `owner_email: null` field starting from this version. Today the platform never sets it; in a future auth phase, new briefs will be tagged with the logged-in user.
- All API endpoints MUST be structured to accept an `Authorization` header in the future without restructuring. For now, the header is ignored.

### Brief output history (future capability)
- **Capture**: the Python executor writes `out/<slug>.brief.md` immediately after `generate_brief()` returns successfully, **before** the Slack post — captures more in failed-Slack scenarios. Best-effort: a write failure logs a warning and lets the executor continue.
- **Format**: raw GROQ markdown, UTF-8 with trailing newline. No Slack-mrkdwn transformations applied. Web rendering uses a markdown library (e.g. `react-markdown`) when the UI ships.
- **Workflows**: both artifact upload steps extend their `path:` glob from `out/*.run.json` to also include `out/*.brief.md`. A single scheduler tick may package multiple `.brief.md` files in the same `runs-due-*` zip — one per brief that produced text in that tick.
- **Web access layer**: new server-only `web/lib/outputs.ts` with `fetchLatestBriefOutputs(slug, limit = 3)` that iterates over recent artifacts, extracts matching `<slug>.brief.md` entries, cross-references the colocated `<slug>.run.json` for status, and returns sorted DESC by artifact `created_at`. Justification for a new module instead of extending `lib/runs.ts`: clear single responsibility — `runs.ts` answers "what's the latest run metadata?", `outputs.ts` answers "what are the last N output bodies?".
- **API endpoint**: `GET /api/briefs/[name]/outputs` mirrors the patterns of `/api/runs/[brief]` (5-min in-memory cache, `?force=true` busts, 404 on missing brief, 502 on upstream failure).
- **Retention**: 90 days via GitHub Actions artifacts. Read-time cap of 3 entries per brief in the API response. The combination intentionally gives "exactly 3 runs" for monthly briefs and "the 3 most recent" for higher-frequency briefs.
- **Order of operations** is an explicit choice: writing `.brief.md` BEFORE the Slack post means a Slack-delivery failure still leaves the captured text behind. Flipping this to AFTER would couple capture to a successful end-to-end run; today's design favours the diagnostic value.

### Mode catalog landing
- **Replaces the empty landing**: `/` is a server component that fetches catalog data + the brief cross-reference in one round trip (calling the libs directly to skip a self-HTTP). The previous welcome card is gone; the sidebar layout is untouched.
- **Cross-reference indexing**: `web/lib/catalogIndex.ts:buildCatalogUsageIndex()` builds `Map<queryToken, BriefListItem[]>` by reading every brief YAML once via the existing `listBriefs` + `parseBrief` pipeline. Trivially fast at Cooltra scale (≤ 30 reports, ≤ 200 queries, ≤ 30 briefs). Consumers within each token are sorted by `brief.name` for deterministic rendering.
- **API extension**: `/api/mode/space-catalog` was extended (vs. introducing a second endpoint) so reports[].queries[].used_by lands inside the same payload as the catalog itself, sharing the existing 5-minute cache window. `mode-types.ts:ModeQuery.used_by` is OPTIONAL so the existing BriefForm comboboxes (task 8.0) ignore it gracefully.
- **CTA «Create brief →»**: implemented as a `?prefill_report=<token>` query string read by `app/briefs/new/page.tsx` and passed to `<BriefForm prefillReportToken={...}>` so the first source's `mode_report_token` is pre-populated. Other fields stay at defaults.
- **Search behaviour**: text input filters reports + queries by name AND token (case-insensitive). Matching reports auto-expand to surface the hit via a controlled `value` prop on the Accordion; non-matching reports are hidden. Empty search restores the default (all collapsed, all visible).
- **Performance budget**: catalog + cross-reference resolves under 2s P95 cold, <50ms warm-cached. The 5-min cache absorbs subsequent loads.
- **Popover for badge expansion (over inline-expand)**: clicking the «usat per N briefs» badge opens a shadcn Popover anchored to the badge instead of inline-expanding a list inside the accordion. The motivation: shadcn's AccordionContent locks its inner height to `--radix-accordion-content-height` measured at open time, and dynamic content added afterwards either clips (growing) or leaves residual whitespace (shrinking). The Popover renders via portal, escaping the accordion's height invariant entirely. A side effect: clicking the badge no longer alters the catalog's vertical layout, which makes the page calmer to scan.
- **Brief view-mode humanisation**: the brief detail page in view mode now renders Mode tokens with their human name primary + token muted, using two small client renderers (`ReportReadonly`, `QueryReadonly` inside `BriefForm.tsx`). Both subscribe to the same `useSpaceCatalog()` cache that the BriefForm comboboxes already populate, so no extra network round-trip is introduced. Falls back to the raw token in font-mono when the catalog is still loading or the token is no longer in the current space — the brief still functions, the cosmetic enhancement is best-effort.
- **Sidebar Catalog entry**: `SidebarNav.tsx` grows a "Catalog" link with the Database lucide icon, immediately above the existing "Schedule" entry. Active state highlights when `pathname === "/"`. The `SidebarSkeleton` fallback reserves a matching row so the loading state doesn't visually shift when the nav lands.
- **Empty catalog / Mode down**: fallback copy + recovery hint (page reload triggers a fresh fetch). Mirrors the BriefForm combobox fallback so users have a consistent recovery mental model.
- **Output-token colour signal — tunable in one place**: `web/lib/tokenWarnings.ts` exports the warn/danger thresholds (`OUTPUT_TOKEN_WARN_THRESHOLD`, `OUTPUT_TOKEN_DANGER_THRESHOLD`) and the corresponding Tailwind class names (`OUTPUT_TOKEN_WARN_CLASS`, `OUTPUT_TOKEN_DANGER_CLASS`) plus a helper `outputTokenColorClass(n)` that picks one. Both consumer sites (`BriefSidebarList.tsx`, `ExecutionMetadata.tsx`) import the helper; changing the thresholds re-calibrates the whole app from this single file. Defaults at 250 / 1000 are a Cooltra-scale calibration based on observed brief output sizes; tune as the catalog evolves.

### Brief output history — UI surfacing (future capability)
- **Bulk fetch — new function on `lib/outputs.ts`**: alongside `fetchLatestBriefOutputs(slug, limit)` (10.0), add `fetchAllRecentBriefOutputs(slugs[], limit = 3)` that lists artifacts ONCE and resolves multiple slugs from the same downloaded zip(s). The per-slug variant from 10.0 is fine when the brief detail drawer asks for a single brief, but the global `/history` page would otherwise do N × `listArtifacts` calls + redundant zip downloads. The bulk variant lifts the artifact listing out of the loop and groups zip downloads by artifact id so each zip is fetched at most once even if it contains multiple briefs' .brief.md files.
- **Bulk API endpoint**: new `GET /api/briefs/outputs/all` returning `{ outputs: Record<slug, BriefOutput[]> }`. Same 5-minute in-memory cache pattern as the per-brief endpoint, keyed by the sorted list of slugs requested (so different brief lists don't collide). `?force=true` busts. 502 on upstream failure. Slugs absent from the result map mean "no captured outputs yet" — the UI surfaces these at the bottom of the list.
- **Page**: `/history` is a server component that calls `getBriefList()` to enumerate the current brief set, then the bulk endpoint to resolve their outputs. Briefs are sorted by their latest-output `created_at` descending; briefs without any captured output land at the bottom alphabetically. Hands the result to a client `<HistoryFeed>` component that renders the grouped expansion (latest visible, older runs revealed when the row is expanded).
- **Per-brief drawer (vs separate page)**: the brief detail's "History" button opens a shadcn `Sheet` (`side="right"`) rather than navigating to a separate `/briefs/<name>/history` page. The drawer keeps the brief detail mounted behind it, so closing returns the user to exactly where they were (scroll position + any in-flight form edits). Reuses the same `<HistoryEntry>` component as the global page but pre-expanded — all available outputs visible at once without a click. The drawer is the user's chosen option (Q2.C, 2026-05-16); a per-brief URL is a future option if deep-linking becomes useful.
- **Markdown rendering**: shared `<BriefMarkdown>` component on top of `react-markdown` + `remark-gfm`. Sanitisation defaults stay on (no `rehype-raw`). Component constrains line length to match the rest of the app's reading width and styles headers / lists / code blocks consistently with the existing typography (Inter body, JetBrains Mono code). Used identically by the global page and the per-brief drawer so there's a single place to tune rendering.
- **Why grouping-by-brief instead of a global chronological feed**: explicit user decision — "els històrics de cada brief tenen context dins del brief, no tenen context barrejats amb els altres briefs". A strict chronological feed would scatter the same brief's older versions among other briefs' newer outputs, breaking the side-by-side comparison value that motivates the feature in the first place.
- **Briefs that no longer exist**: filtered out at the page level via `listBriefs()` as the authoritative set. Orphan `.brief.md` artifacts (deleted or renamed briefs) are not surfaced even within their 90-day retention window. Trade-off: a renamed brief's older artifacts are lost from the UI, which is consistent with the slug-stability decision (filename = slug, brief.name is editable).
- **Empty / loading / error states**: skeleton (~5 placeholder rows) during the Suspense fetch; empty state at the bottom (briefs without outputs); error state when the bulk endpoint 502s, with a Refresh button busting the cache.

### Authentication & Access Control

- **Library: Auth.js v5** (formerly NextAuth.js v5), the de-facto pick for Next.js 16 App Router. Configured with the **Email** provider (magic-link flow) + **JWT session strategy** so no database adapter is required. Free.
- **Mail delivery: Resend** (free tier: 3 000 emails/month, 1 verified sender domain). Cooltra scale (≤30 internal users, 1–2 logins each per month given the 30-day sliding session) stays well under quota. Sender domain (`reporting@cooltra.com` or equivalent) requires DNS verification (SPF + DKIM records) — manual rollout step, mirrors how task 6.1 added `actions:write` to the PAT.
- **Domain gate**: a single `assertEmailAllowed(email)` server util reads `AUTH_ALLOWED_DOMAINS` (CSV `cooltra.com,felyx.com`) and is invoked twice — at the `signIn` callback (rejects the magic-link request) AND at the `jwt`/`session` callback (defence in depth: rejects a link arriving for an allowlisted email whose domain was removed in between). Centralised so removing / adding a tenant is one env-var edit.
- **Middleware-based gating**: Next.js 16 renames `middleware` → `proxy`. Auth.js v5's pattern works inside `proxy.ts`: `export { auth as default } from "@/lib/auth"` with a matcher that protects every route EXCEPT `/sign-in`, `/api/auth/*` (NextAuth's callbacks) and Next's static assets. Server components additionally call `auth()` for belt-and-braces server-side gating; API routes call `auth()` at the top and return 401 if null.
- **`owner_email` population**: today nullable-but-never-written. After AUTH lands, `POST /api/briefs` reads `session.user.email` and sets `owner_email` before serialising; `PUT /api/briefs/[name]` preserves the existing value (no auto-rewrite); the bulk migration commits `owner_email: oriol@cooltra.com` everywhere.
- **Commit author identity stays as the service identity** (`cooltra-reporting-bot`). No per-user PATs, no GitHub App user-to-server tokens — those would require OAuth app review and per-user GitHub authorisation. The logged-in user appears only in the commit MESSAGE.
- **No new DB, no new external infra**: Auth.js JWT sessions live in cookies; Resend is a SaaS the operator signs up to (Cooltra account, free tier). Env vars grow by `AUTH_SECRET` (random 32+ bytes for JWT signing), `AUTH_RESEND_KEY`, `AUTH_RESEND_FROM`, `AUTH_ALLOWED_DOMAINS`. Vercel Hobby tier covers everything.
- **Caches stay global, not per-session**: the existing 5-min in-memory caches (`/api/channels`, `/api/runs/[brief]`, `/api/briefs/[name]/outputs`, `/api/briefs/outputs/all`, `/api/mode/space-catalog`) MUST stay keyed globally. Under access-wall semantics, every authenticated user sees the same data, so per-user partitioning would only hurt hit rate. Documented explicitly so future contributors don't reflexively partition.
- **Brief output history access (§4 req 44) re-confirmed under AUTH**: accessible to any authenticated user, no per-brief gating. Long-term archival (>90d) and finer-grained ACLs remain future work, now framed as «a future iteration BEYOND access wall».
- **Future-readiness for per-user data isolation**: this iteration intentionally touches no UI surface to filter «My briefs vs others». `owner_email` is captured precisely so a future task can introduce sidebar groupings, a «My briefs» filter, or hidden/private flags without a schema break.

## 8. Success Metrics

- **Adoption**: at least 3 Cooltra non-engineers have created a brief through the UI within the first month of release, without help from the engineering team.
- **Time to first brief**: median time from "opens platform URL" to "first brief saved successfully" is under 5 minutes for new users.
- **Operational visibility**: 100% of brief executions in the last 30 days are visible from the UI (no need to open GitHub Actions to see results).
- **Cost**: monthly infrastructure cost remains 0 € for at least 90 days post-launch, with up to 20 briefs and 100 user sessions per day.
- **Reliability**: at least 99% of writes succeed (commit lands on `main` and is reflected in the UI) when measured over a rolling 30-day window.
- **Support load**: zero "how do I…" questions arrive to the engineering team that are answered by information already visible in the inline help texts.
- **Channel-misconfiguration runtime failures**: at most 1 per month after launch. Users either pick a valid channel from the dropdown or follow the inline `/invite` snippet — they should not be discovering "bot not in channel" through a Slack delivery error.
- **Query-misconfiguration discovered before save** (added with task 17.0): once Mode data preview ships, the expectation is that the «query returns 0 rows / wrong columns / wrong report» mistakes get caught in the form, not after a Run Now. Concretely: at most 1 brief per month is created or edited and then dispatched via Run Now while its primary query returns 0 rows or fails with a missing-token error — measured by inspecting `.run.json` failures for «query not found» / «0 rows» patterns over a rolling 30-day window.
- **Accidental Slack posts from in-progress briefs** (added with task 16.0): once Publish/Unpublish ships and new briefs default to Draft, the rate of «we posted to Slack while still iterating the prompt» events should drop to zero. Measured by inspecting `.run.json` records for briefs whose YAML was edited within ~15 min of the dispatch (a proxy for «still actively iterating»); the count of such events over a rolling 30-day window should land at 0 — every iteration cycle now happens before publish.
- **Prompt iteration cycle length** (added with task 18.0): once dry-run ships, the median time from «edit prompt» to «see new output» drops from ~60 s (Save → Run Now → workflow + Mode + GROQ + Slack) to ~10 s (form-footer Preview output → SSE stream). Measured indirectly via the count of `.run.json` records on a given brief in a 24h window — a healthy iteration session pre-feature creates 5+ artifact records (one per Run Now); post-feature it creates 0-1 (the final Save + Run Now if the user wants Slack delivery). A median of 1 artifact-record-per-edit-session over 30 days is the success threshold.
- **New-user time-to-first-brief** (added with task 19.0): the Prompt Assistant is designed to close the prompt-engineering gap for non-technical users. Pre-feature, a new user takes ~20-40 minutes to write their first prompt (anecdotal). Post-feature target: < 10 minutes from «empty form» to «brief saved». Measured via observation of the 3-5 next new-user onboarding sessions; if the median doesn't fall below 10 minutes, revisit the assistant's quality (model choice, few-shot selection, system prompt).

## 9. Open Questions

1. **GitHub identity for writes**: should commits made through the platform come from a Service GitHub App (cleaner, more granular permissions, slightly more setup) or from a Personal Access Token tied to a service account (simpler, less granular)?
2. **Cron builder library or custom**: is the maintenance + bundle size cost of an existing library (e.g., `cron-builder`) better than ~200 lines of custom code? To be decided during implementation.
3. **Calendar event collisions**: when two briefs are scheduled at the same exact minute, how do we render them? Stacked? Side-by-side? Indicator with count?
4. **Brief deletion confirmation**: do we require a typed confirmation (typing the brief name) for delete, or just a "Are you sure?" modal? Lean toward the modal only — deletion is reversible from git history.
5. **Empty calendar state**: when no briefs are scheduled in the current week, show an illustration + CTA "Create your first brief" or just an empty grid?
6. **Visualisation of token consumption over time**: nice-to-have for a future iteration. Not in this PRD's scope, but the artifact data captured here enables it.
7. **DM-style destinations**: the `slack_channel` field accepts a channel name. Should we also support direct messages (`@username`) or multi-person DMs as destinations? Out of scope today, but the schema (single string) doesn't preclude it. Decide before implementation if such use cases exist.
8. **Migrating "fully-private" channels**: if Cooltra later wants briefs to publish to channels where the bot's `groups:read` is disabled by workspace policy, what's the fallback? Most likely: those channels don't appear in the dropdown and the user must type them manually + trigger the warning flow. Validate this assumption with workspace admin.
9. **Mode preview row cap escape hatch** (added with task 17.0): the 10-row cap is enough for structure validation, but if a power user ever asks «can I see more rows here?», do we add the `limit` query string surface to the UI (e.g. a small «Show 25» toggle in the Sheet footer) or push them to Mode directly via the «Open in Mode» link from the run-failed state? Lean toward the latter — keeping the preview deliberately compact prevents it from becoming a Mode alternative. Re-evaluate after the feature has been in production for ~30 days.
10. **Bulk publish/unpublish** (added with task 16.0): once Draft becomes a real state, will operators want to publish or unpublish multiple briefs at once (e.g. before a holiday — «pause every daily brief until next Monday»)? V1 has no bulk affordance — toggling 10 briefs takes 10 clicks. If pain emerges, candidate surfaces are a sidebar «Select multiple» mode or a `/schedule` checkbox column. Deferred until usage data justifies it.
11. **Dry-run output capture / save** (added with task 18.0): D11 makes dry-runs strictly ephemeral. Once the feature has been live for a while, will users ask «I generated a good output via Preview — can I save it without going through Run Now»? If yes, candidate surfaces are a «Save this output to history» button at the foot of the DryRunSheet (writes a synthetic `.brief.md` artifact via the GitHub API without involving the workflow), or a «Publish to Slack» button that posts the captured output directly. Both have non-trivial trust implications (the saved output didn't come through the audited executor pipeline). Defer until real usage shows whether the need is real.
12. **Prompt Assistant model selector** (added with task 19.0): v1 hardcodes GROQ Llama 3.3 70b. If output quality for prompt-engineering specifically turns out to be unsatisfactory, the candidate path is a per-conversation model selector inside the Sheet header (Llama vs Claude). Cost: new `ANTHROPIC_API_KEY` env var, new SDK install, a tiny model-picker UI. Re-evaluate after the feature has been live for ~30 days with usage data.
13. **Prompt Assistant + real Mode data context** (added with task 19.0): A5 deliberately excludes a Mode data sample from the assistant's context to keep chat latency low (~1 s to first token). If users ask «the assistant doesn't know my data shape» often enough, candidate paths are: (a) fetch a tiny sample (5 rows) lazily AFTER the chat opens — first message has full latency, subsequent messages are instant; (b) require the user to click «Load data context» explicitly. Defer until usage data shows the need.
