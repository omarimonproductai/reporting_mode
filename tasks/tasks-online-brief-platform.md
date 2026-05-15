# Tasks: Online Brief Management Platform

Implementation plan derived from `tasks/prd-online-brief-platform.md`.

**Scope: MVP** (decisions confirmed by the user):
- Calendar view is a **simple sorted list** of upcoming brief executions, not a weekly grid.
- **No conflict detection** for concurrent edits — last-write-wins, with a small "loaded at HH:MM" indicator in the form so the user knows their baseline.
- **Channel-list refresh by polling** (every 5 min via stale-while-revalidate), no explicit refresh button.
- **Desktop only**. Mobile may render but is not designed for; forms and views assume ≥ 1024px width.

## Relevant Files

### Created (web app)
- `web/package.json` — Next.js, React, shadcn/ui, zod, react-hook-form, croniter (or similar JS equivalent), js-yaml dependencies.
- `web/tsconfig.json`, `web/next.config.js`, `web/tailwind.config.js`, `web/postcss.config.js`, `web/components.json` — standard config files.
- `web/app/layout.tsx` — root layout with persistent sidebar and footer.
- `web/app/page.tsx` — home page, redirects to first brief or shows empty state.
- `web/app/briefs/[name]/page.tsx` — brief detail / edit view.
- `web/app/briefs/new/page.tsx` — new brief form.
- `web/app/schedule/page.tsx` — list of upcoming brief executions.
- `web/app/api/briefs/route.ts` — `GET` lists briefs; `POST` creates a new one.
- `web/app/api/briefs/[name]/route.ts` — `GET`, `PUT`, `DELETE` for a single brief.
- `web/app/api/channels/route.ts` — proxies Slack `conversations.list` with caching.
- `web/app/api/runs/[brief]/route.ts` — returns latest execution metadata from GitHub Actions artifacts.
- `web/app/api/version/route.ts` — returns latest commit info from GitHub API.
- `web/components/BriefSidebar.tsx` — left sidebar with brief list and `+ New brief` button.
- `web/components/BriefForm.tsx` — main form for view/edit/create.
- `web/components/CronBuilder.tsx` — visual schedule builder.
- `web/components/ChannelCombobox.tsx` — Slack channel selector with bot-not-in-channel warning.
- `web/components/ExecutionMetadata.tsx` — last-run card on brief detail.
- `web/components/Footer.tsx` — version footer with commit info in Madrid time.
- `web/components/ui/*` — shadcn primitives, scaffolded by `npx shadcn-ui add`.
- `web/lib/github.ts` — typed wrapper around GitHub REST API (Contents, Actions Artifacts, Repository).
- `web/lib/slack.ts` — typed wrapper around Slack `conversations.list`.
- `web/lib/yaml.ts` — parse/serialize brief YAML preserving comments where possible.
- `web/lib/cron.ts` — cron ↔ builder state conversion; humanizer for preview.
- `web/lib/schemas.ts` — zod schemas mirroring the YAML brief schema.

### Modified
- `scripts/executor.py` — capture Groq token counts; write `out/<brief-slug>.run.json`; read `csv` from query level (was brief level).
- `.github/workflows/run-brief.yml` — upload `out/` as an artifact at end of run.
- `.github/workflows/run-due-briefs.yml` — same artifact upload step.
- `briefs/fraude-bikes-unit-economics.yml` — migrate `csv: true` to per-query.
- `briefs/app-version-adoption.yml` — migrate `csv: true` to per-query.
- `README.md` — document the new monorepo structure (Python + `web/`) and retire references to the static dashboard.
- `.gitignore` — add `web/node_modules/`, `web/.next/`, `web/.vercel/`; remove the now-orphan `docs/` entry.

### Deleted
- `scripts/build_dashboard.py`
- `templates/dashboard.html.j2`
- `templates/` (empty after the file above is removed)
- `.github/workflows/build-dashboard.yml`

### Notes

- The web app lives under `web/` so the repo becomes a small monorepo: Python executor + YAML configs on top, Next.js app inside `web/`.
- No automated tests in the MVP. Manual verification per sub-task via the Vercel preview deployment (every push to the feature branch creates a preview URL).
- Each parent task below maps roughly to one of the 10 working sessions estimated earlier. The implementer should commit each sub-task (or small batch) individually so PR reviews stay manageable.
- As each sub-task is completed, change its `- [ ]` to `- [x]` so progress is trackable.

## Tasks

- [ ] **0.0 Create feature branch**
  - [ ] 0.1 Create and check out a feature branch: `git checkout -b feature/online-brief-platform`. All work below lands as commits on this branch.

- [ ] **1.0 Project foundation: Next.js + Vercel + layout shell**
  - [ ] 1.1 Initialise a Next.js 14 project under `web/` using the App Router: `cd web && npx create-next-app@latest . --typescript --tailwind --app --no-src-dir`.
  - [ ] 1.2 Update `web/tailwind.config.js` with the zinc-based palette and Inter / JetBrains Mono fonts from the existing static dashboard template.
  - [ ] 1.3 Install and initialise shadcn/ui: `npx shadcn-ui@latest init` choosing zinc as base color.
  - [ ] 1.4 Add the shadcn components the app needs: `button`, `input`, `textarea`, `label`, `card`, `dialog`, `alert`, `toast`, `combobox` (or `command` + `popover`), `dropdown-menu`.
  - [ ] 1.5 Create the Vercel project; connect it to the GitHub repo; configure Production branch = `main`; preview deploys auto-enabled for any branch.
  - [ ] 1.6 Add the following environment variables in Vercel (Production + Preview): `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `SLACK_BOT_TOKEN`. Mark them as encrypted secrets.
  - [ ] 1.7 Implement `web/app/layout.tsx`: persistent left sidebar (~280px width), main content area, and footer slot at the bottom right.
  - [ ] 1.8 Implement `web/components/Footer.tsx` with placeholder content (real data wired in 1.10).
  - [ ] 1.9 Implement `web/app/api/version/route.ts`: calls GitHub Repository API to get the latest commit on `main`; returns `{sha, message, authoredAt}`.
  - [ ] 1.10 Wire the Footer to `/api/version`; convert the UTC timestamp to `Europe/Madrid` for display: `Built from <sha7> · <message truncated to 50 chars> · <DD/MM/YYYY HH:MM Madrid>`.
  - [ ] 1.11 Verify on the Vercel preview URL: the shell renders, the footer shows real commit info, the sidebar is empty (no briefs yet endpoint).

- [ ] **2.0 Brief CRUD: read, edit, create, delete**
  - [ ] 2.1 Implement `web/lib/github.ts` with helpers: `listBriefs()`, `readBrief(name)`, `writeBrief(name, content, sha?)`, `deleteBrief(name, sha)`. All use the GitHub Contents API and run server-side only.
  - [ ] 2.2 Implement `web/lib/yaml.ts`: parse a brief YAML string to a typed object; serialise back to YAML keeping a stable key order so diffs in git remain readable.
  - [ ] 2.3 Implement `web/lib/schemas.ts`: a zod schema mirroring the brief structure (name, schedule, timezone, slack_channel, sources[], prompt, optional owner_email).
  - [ ] 2.4 Implement `web/app/api/briefs/route.ts` `GET`: returns `[{name, schedule, slack_channel, source_count, query_count, sha}]` for every brief in the repo.
  - [ ] 2.5 Implement `web/app/api/briefs/[name]/route.ts` `GET`: returns the full parsed brief plus its SHA.
  - [ ] 2.6 Implement `web/components/BriefSidebar.tsx`: client component that fetches `/api/briefs` and renders each brief as a clickable item (just the name for now; execution data added in 4.7).
  - [ ] 2.7 Above the sidebar list, render the `+ New brief` button (shadcn Button, primary variant) linking to `/briefs/new`.
  - [ ] 2.8 Implement `web/app/briefs/[name]/page.tsx`: server component that fetches the brief by name and passes it to `BriefForm` in read-only mode.
  - [ ] 2.9 Implement `web/components/BriefForm.tsx`: renders all brief fields with always-visible inline help text below each field; supports `mode="view" | "edit" | "create"`.
  - [ ] 2.10 In view mode, each field is a read-only display; in edit mode, fields become inputs/textareas. The `prompt` field is a `<Textarea>` sized to ~20 visible rows with monospace font.
  - [ ] 2.11 Wire react-hook-form + zod to the form. Validation errors render below each field in red, replacing the inline help text temporarily.
  - [ ] 2.12 Add an "Edit" button that toggles `mode` from view to edit; "Cancel" reverts; "Save" calls `PUT /api/briefs/[name]`.
  - [ ] 2.13 Above the form, render a small muted "Carregat a HH:MM" indicator (the timestamp when the page loaded). Helps users notice if they came back to an old tab.
  - [ ] 2.14 Implement `web/app/api/briefs/[name]/route.ts` `PUT`: receives parsed brief JSON, serialises to YAML, commits via GitHub API with author = service identity, message = `Update brief: <name>`.
  - [ ] 2.15 On successful save, show a shadcn `Toast` with "Brief desat" and revert the form to view mode.
  - [ ] 2.16 Implement `web/app/briefs/new/page.tsx`: renders `BriefForm` in `mode="create"` with empty defaults (name="", schedule="0 8 * * *", timezone="Europe/Madrid", one empty source, prompt="").
  - [ ] 2.17 Implement `web/app/api/briefs/route.ts` `POST`: receives parsed brief JSON, infers filename from the `name` field (slugified), commits a new YAML file. Rejects if a file with that name already exists.
  - [ ] 2.18 Add "Delete brief" button on the brief detail view (in view mode, secondary destructive variant, bottom of the form). Clicking opens a shadcn `Dialog` asking to confirm.
  - [ ] 2.19 Implement `web/app/api/briefs/[name]/route.ts` `DELETE`: removes the file via GitHub API; after success, navigate to home and refresh the sidebar.
  - [ ] 2.20 In the form, allow adding and removing `sources` dynamically: each source is a card; "+ Add source" appends; trash icon on the card removes.
  - [ ] 2.21 Within each source card, allow adding and removing `queries` dynamically: each query is a row with the query token field and a per-query CSV checkbox (per the new schema).
  - [ ] 2.22 Write inline help text for every field (name, schedule, timezone, slack_channel, mode_report_token, query token, csv, prompt). PLG style: what the field is, expected format, and a concrete example.

- [ ] **3.0 Specialised form widgets: cron visual builder + Slack channel combobox**
  - [ ] 3.1 Implement `web/lib/cron.ts`: a `buildCron(state)` function that takes `{frequency, days, hour, minute}` and returns a canonical 5-field cron string; an inverse `parseCron(cron)` that returns the state or `null` when the cron doesn't fit the grid.
  - [ ] 3.2 Add a `humanize(cron, locale)` helper that returns "Cada dimarts a les 10:00" style strings in Catalan.
  - [ ] 3.3 Implement `web/components/CronBuilder.tsx`: three vertical sections.
    - Section 1: Frequency — radio group: every day / specific days of week (multi-checkbox) / day of month.
    - Section 2: Time — hour dropdown (00-23) + minute dropdown (00, 15, 30, 45).
    - Section 3: Timezone — dropdown defaulting to `Europe/Madrid`, options include UTC and major Cooltra-relevant TZs.
  - [ ] 3.4 Below the builder, render a live preview: the human-readable string in normal text, and the generated cron + timezone in muted monospace.
  - [ ] 3.5 In `BriefForm`, replace the raw `schedule` and `timezone` inputs with `<CronBuilder>`. The builder's value is bound to those two fields in the form state.
  - [ ] 3.6 When loading an existing brief, call `parseCron(cron)` to initialise the builder state. If the cron is "off-grid" (e.g., minute=7), display "Custom: 7 8 * * *" with a raw input and skip the builder until the user resets.
  - [ ] 3.7 Implement `web/lib/slack.ts`: a `listChannels()` helper that calls `conversations.list` with `types=public_channel,private_channel`, filters `is_member=true`, follows pagination via cursor, returns `[{id, name, is_private}]`.
  - [ ] 3.8 Implement `web/app/api/channels/route.ts`: caches the result of `listChannels()` in a module-level Map with 5-minute TTL. Returns the cached value when fresh; refetches otherwise.
  - [ ] 3.9 **User action (cannot be coded)**: in Slack app config (`api.slack.com/apps`), add bot scopes `channels:read` and `groups:read`; reinstall the app to the workspace (likely requires admin approval); copy the new Bot Token; update `SLACK_BOT_TOKEN` in Vercel env vars.
  - [ ] 3.10 Implement `web/components/ChannelCombobox.tsx` using shadcn's Command + Popover pattern: a button shows the current value; clicking opens a popover with a search input and the filtered channel list.
  - [ ] 3.11 Each channel option renders the icon (`#` public, `🔒` private) + name in `font-mono`.
  - [ ] 3.12 Allow free-text entry: typed input that doesn't match any channel is accepted as a custom value when the user presses Enter or selects "Use «typed-name»".
  - [ ] 3.13 If the current value is NOT in the channel list (bot not a member), render below the combobox a shadcn `Alert` with warning variant: "El bot no és al canal #X. Afegeix-lo amb `/invite @<bot-name>` a Slack abans del proper run." + a small Copy button next to the snippet.
  - [ ] 3.14 Copy button copies `/invite @<bot-name>` to clipboard and triggers a transient "Copiat!" toast (~2 seconds).
  - [ ] 3.15 In `BriefForm`, replace the raw `slack_channel` text input with `<ChannelCombobox>`.
  - [ ] 3.16 Implement stale-while-revalidate polling: the combobox refetches the channel list every 5 minutes in the background. If the list arrives and the previous "bot not in channel" warning becomes invalid, dismiss the warning automatically.

- [ ] **4.0 Execution tracking + per-brief metadata**
  - [ ] 4.1 Modify `scripts/executor.py`: capture `response.usage.prompt_tokens` and `response.usage.completion_tokens` from the Groq response object in `generate_brief()`. Store them on the brief execution record.
  - [ ] 4.2 At the end of `main()` in `executor.py`, write `out/<brief-slug>.run.json` with `{brief, started_at, finished_at, status: "success", tokens: {input, output, total}, error: null}`.
  - [ ] 4.3 In the script's `sys.exit` error paths, before exiting, write the same `run.json` with `status: "failed"` and the error message. Wrap `main()` in a `try/except` to catch unexpected exceptions and still record them.
  - [ ] 4.4 Modify `.github/workflows/run-brief.yml`: after the run step, add `- uses: actions/upload-artifact@v4` with `name: run-${{ inputs.brief }}-${{ github.run_id }}` and `path: out/*.run.json`. Set `retention-days: 90`.
  - [ ] 4.5 Modify `.github/workflows/run-due-briefs.yml`: same artifact upload step at the end of the job. Name includes timestamp to disambiguate multi-brief runs.
  - [ ] 4.6 Implement `web/app/api/runs/[brief]/route.ts` `GET`: calls GitHub Actions API `/repos/{owner}/{repo}/actions/artifacts`, filters by name prefix `run-<brief>-`, returns the most recent artifact's parsed JSON.
  - [ ] 4.7 Add a 5-minute in-memory cache to `/api/runs/[brief]` (same pattern as `/api/channels`).
  - [ ] 4.8 In `BriefSidebar`, for each brief fetch `/api/runs/[name]` in parallel (using `Promise.all`); render status icon (✓ green / ✗ red / — gray for "never run"), relative timestamp ("fa 3h"), and token badge "1.2k + 0.4k" (input + output rounded to one decimal in thousands).
  - [ ] 4.9 Implement `web/components/ExecutionMetadata.tsx`: a prominent card on the brief detail page (above the form) showing: large status indicator, absolute timestamp in Madrid time with tooltip showing UTC, separate "Input tokens" / "Output tokens" stats, and the error message in muted red if status=failed.
  - [ ] 4.10 Handle three edge cases gracefully:
    - **Never run** — show "Mai executat" instead of an empty card.
    - **No recent artifact** (older than 90 days) — show "Cap execució recent registrada".
    - **API failure** — show "No s'ha pogut carregar la informació d'execució" with a retry button.

- [ ] **5.0 List-calendar + schema migration + polish + retire static dashboard**
  - [ ] 5.1 Update `scripts/executor.py` to read `csv` from each query (`source["queries"][i]["csv"]`) instead of from the brief root. Keep backward-compat by treating missing `csv` field as `false`.
  - [ ] 5.2 Migrate `briefs/fraude-bikes-unit-economics.yml`: convert each query from `{token, csv}` shorthand to the new structure (both queries get `csv: true`).
  - [ ] 5.3 Migrate `briefs/app-version-adoption.yml`: convert the single query to the new structure with `csv: true`.
  - [ ] 5.4 Manually trigger both briefs via the `Run brief` workflow on the feature branch's Vercel preview deployment URL; verify the Slack message + CSV thread reply still arrive correctly.
  - [ ] 5.5 Implement `web/app/schedule/page.tsx`: server component that fetches `/api/briefs`, computes each brief's next fire time (using a JS cron library like `cron-parser`), and renders a sorted table.
  - [ ] 5.6 Table columns: brief name (clickable, navigates to detail), next fire (relative: "en 3h" + absolute: "16:00 dl 16/05"), schedule humanized, last run status icon.
  - [ ] 5.7 Add a "Schedule" / "Calendari" entry in the sidebar (or in the top nav) that opens `/schedule`.
  - [ ] 5.8 Implement loading states: shadcn `Skeleton` placeholders for sidebar (3 rows), brief form (each field), `ExecutionMetadata`, and the `/schedule` table.
  - [ ] 5.9 Implement empty states: "Cap brief encara — crea el primer" on the home page; "Cap execució programada properament" on `/schedule` if all briefs are without a valid schedule.
  - [ ] 5.10 Implement error states: a generic `<ErrorBoundary>` showing "Alguna cosa ha fallat" + the error message + a retry button.
  - [ ] 5.11 Review all inline help texts in `BriefForm` for clarity and consistency. Each should answer: what is this field, what format does it accept, what's a good example. Final review pass.
  - [ ] 5.12 Delete `scripts/build_dashboard.py`, `templates/dashboard.html.j2`, the (now empty) `templates/` directory, and `.github/workflows/build-dashboard.yml`.
  - [ ] 5.13 Update `.gitignore`: remove the `docs/` entry; add `web/node_modules/`, `web/.next/`, `web/.vercel/`.
  - [ ] 5.14 Update `README.md`: document the new monorepo structure (Python executor + `web/` Next.js app), the new platform URL (Vercel), the env vars required for the web app, and replace any mention of the retired static dashboard.
  - [ ] 5.15 Final end-to-end manual test on the Vercel preview URL:
    1. Open the platform → see the two existing briefs in the sidebar.
    2. Create a new brief through the UI (e.g., a duplicate of `app-version-adoption` with a different schedule).
    3. Verify it appears in the sidebar and on `/schedule`.
    4. Edit the prompt, save → toast appears, sidebar reflects the change.
    5. Manually trigger via GitHub Actions `Run brief` workflow → verify execution metadata appears in the UI within 5 minutes.
    6. Delete the test brief → confirm it disappears from the sidebar and `/schedule`.
  - [ ] 5.16 Open the final PR (`feature/online-brief-platform` → `main`); after merge, switch Vercel's Production branch to `main`; verify the production URL serves the platform.
