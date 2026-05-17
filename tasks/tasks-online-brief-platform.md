# Tasks: Online Brief Management Platform

Implementation plan derived from `tasks/prd-online-brief-platform.md`.

**Scope: MVP** (decisions confirmed by the user):
- Calendar view is a **simple sorted list** of upcoming brief executions, not a weekly grid.
- **No conflict detection** for concurrent edits — last-write-wins, with a small "loaded at HH:MM" indicator in the form so the user knows their baseline.
- **Channel-list refresh by polling** (every 5 min via stale-while-revalidate), no explicit refresh button.
- **Desktop only**. Mobile may render but is not designed for; forms and views assume ≥ 1024px width.
- **Language policy** (added 2026-05-16): UI chrome (field labels, buttons, navigation entries, page headings, status badges) is in **English** and is shared vocabulary across teams. Narrative copy (help text, validation errors, toasts, dialog bodies, loading/empty/error states) is **localised to Catalan** by default; when narrative copy references chrome, the chrome term stays English in line (e.g. «El _Slack channel_ és obligatori»). Multi-language is not implemented; the placement of localised strings must allow swapping to a second language without component-by-component edits.
- **Help-text affordance** (added 2026-05-16): each form field exposes its description behind an Info-icon Popover next to the label, not as always-visible muted text (a deviation from the original PRD design line, kept for history in the PRD).
- **Manual runs** (added 2026-05-16, future task 6.0): every brief detail view gets a prominent **Run Now** button at the top of the form that fires `workflow_dispatch` on `run-brief.yml`, with a 2-minute cooldown enforced both client- and server-side. On the new-brief page the button is rendered but disabled with an explanatory hint until the brief has been saved.

## Relevant Files

### Created (web app)
- `web/package.json` — Next.js 16, React 19, Tailwind v4, shadcn/ui (added in 2.0), zod, react-hook-form, croniter (or similar JS equivalent), js-yaml dependencies.
- `web/tsconfig.json`, `web/next.config.ts`, `web/postcss.config.mjs`, `web/components.json` (added in 2.0) — standard config files. **No `tailwind.config.js`**: Tailwind v4 moves theme config inside `globals.css` under `@theme`.
- `web/app/globals.css` — Tailwind v4 entry; defines the zinc palette and Inter / JetBrains Mono font-family tokens under `@theme`.
- `web/app/layout.tsx` — root layout with persistent sidebar (placeholder + Footer pinned bottom) and main content area.
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
- `web/components/Footer.tsx` — two-line version footer (`Built <sha7>` / `DD/MM/YYYY HH:MM Catalunya`) pinned to the bottom of the sidebar.
- `web/components/ui/*` — shadcn primitives, scaffolded by `npx shadcn@latest add` (added during 2.0).
- `web/lib/github.ts` — typed wrapper around GitHub REST API (Contents, Actions Artifacts, Repository).
- `web/lib/version.ts` — helper that fetches the latest commit on `main` (used by both `/api/version` and `Footer.tsx` to avoid an HTTP self-call).
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

- [x] **0.0 Create feature branch**
  - [x] 0.1 Working on `claude/claude-continue-command-oBXAf` (the session's pre-assigned branch) instead of `feature/online-brief-platform`. All work below lands as commits on this branch.

- [x] **1.0 Project foundation: Next.js + Vercel + layout shell** ✅
  - [x] 1.1 Initialised under `web/` via `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --yes`. **Note:** scaffolded **Next.js 16.2.6 + React 19.2 + Tailwind v4** (not Next 14 as the PRD assumed). v16 brings async `params`/`searchParams` and renames `middleware` → `proxy` — relevant later, not for 1.0.
  - [x] 1.2 Tailwind v4 deprecates `tailwind.config.js`; theme tokens go inside `web/app/globals.css` under `@theme`. Done there: zinc-based palette + Inter / JetBrains Mono fonts wired via `next/font/google` in `app/layout.tsx`.
  - [x] 1.3 Done at the start of 2.0: `npx shadcn@latest init -t next -b radix -p nova`. The preset rewrote `globals.css` with the oklch palette and tried to inject Geist as `--font-sans`; reverted the font swap so Inter stays as `--font-sans` (the literal `--color-background: #fafafa` survived the rewrite, so the zinc backdrop is intact). `tw-animate-css` and Lucide icons came in as transitive deps.
  - [x] 1.4 Done at the start of 2.0: `npx shadcn@latest add button input textarea label dialog sonner`. The 2.0 polish pass added `popover` (initial Info-icon affordance) and then `tooltip` (the hover-based replacement that now hosts the help text); `popover` stays installed for task 3.10's ChannelCombobox.
  - [x] 1.5 Vercel project `reporting-mode` created under "Oriol's projects"; connected to GitHub repo; Root Directory = `web`; Framework Preset = Next.js; Production branch = `main`; previews enabled for every branch.
  - [x] 1.6 Env vars added in Vercel (Production + Preview, encrypted): `GITHUB_TOKEN` (fine-grained PAT `vercel-reporting-mode`, expires 2027-05-16, scoped to `reporting_mode` with `Contents: Read & write` + `Metadata: Read-only`), `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `SLACK_BOT_TOKEN` (placeholder until 3.0).
  - [x] 1.7 `web/app/layout.tsx`: persistent left sidebar (~280px width) and main content area. Sidebar is a flex column with placeholder content on top and the Footer pinned to the bottom (deviated from the original "footer bottom-right of main" spec — see 1.10).
  - [x] 1.8 `web/components/Footer.tsx` written as a Server Component (no placeholder phase — wired straight to real data via 1.9/1.10).
  - [x] 1.9 `web/app/api/version/route.ts` returns `{sha, authoredAt}` from GitHub Repository API. Shared helper `web/lib/version.ts` so the Footer doesn't HTTP-self-call.
  - [x] 1.10 **Format deviated from the PRD after design review.** Final footer renders on two lines inside the sidebar bottom, in `font-mono text-[11px] text-zinc-400`:
    ```
    Built <sha7>
    DD/MM/YYYY HH:MM Catalunya
    ```
    Changes vs the PRD's `Built from <sha7> · <message truncated to 50 chars> · <DD/MM/YYYY HH:MM Madrid>`:
    - Dropped "from" before the SHA (just `Built <sha7>`).
    - Dropped the commit message entirely (merge subjects were noisy).
    - Two lines (build / time) inside the sidebar instead of one line bottom-right of main, to keep the main area uncluttered.
    - Display label says `Catalunya` (timezone DB key stays `Europe/Madrid`).
    Uses ISR with `revalidate: 60` so the footer updates roughly once a minute.
  - [x] 1.11 Verified on production URL `https://reporting-mode.vercel.app/`: shell + sidebar placeholder + footer with real SHA and Catalunya time all render.

- [x] **2.0 Brief CRUD: read, edit, create, delete** ✅
  - [x] 2.1 `web/lib/github.ts` — `listBriefs / readBrief / writeBrief / deleteBrief` over the GitHub Contents API, commits authored as the Cooltra Reporting Bot service identity. Typed `BriefNotFoundError` / `BriefAlreadyExistsError` for distinguished 404/409.
  - [x] 2.2 `web/lib/yaml.ts` — `parseBrief` accepts both the legacy shape (queries as bare strings + brief-level `csv`) and the canonical shape, normalising to the new `{token, csv}` layout (Option A from the schema-migration discussion). `serializeBrief` emits the canonical shape with a fixed key order. `slugifyBriefName` derives the filename from the name.
  - [x] 2.3 `web/lib/schemas.ts` — zod schemas for query / source / brief plus a small `BriefListItem` row type for the list endpoint. `csv` and `timezone` are required (no `.default()`) so the RHF input/output types match.
  - [x] 2.4 `GET /api/briefs` returns `{briefs: BriefListItem[]}`, sorted by name (`ca` collation); briefs that fail to parse are skipped and logged server-side.
  - [x] 2.5 `GET /api/briefs/[name]` returns `{brief, sha}`; 404 when the file doesn't exist.
  - [x] 2.6 `BriefSidebar` (client component) fetches `/api/briefs` and renders each brief as a `Link`, highlighting the active one via `useParams`. (No execution badge yet — lands in 4.8.)
  - [x] 2.7 `+ New brief` button (shadcn primary, `size="sm"`, full-width) sits above the list and links to `/briefs/new`.
  - [x] 2.8 `web/app/briefs/[name]/page.tsx` is a server component that reads + parses the brief, renders the title/filename header, and mounts `BriefForm` with `loadedAt = new Date().toISOString()` so the client can render the indicator.
  - [x] 2.9 `BriefForm` (client) handles every field with always-visible muted help text below; the new-brief flow shares the same component via `intent="create"`.
  - [x] 2.10 View mode renders each field as a read-only zinc-50 box; edit swaps in `<Input>` / `<Textarea>`. Prompt is 20 rows monospace in edit mode and a wrapped `<pre>` (max-h 40rem, scrollable) in view mode.
  - [x] 2.11 react-hook-form + zod via `zodResolver(briefSchema)`. Validation errors render in `text-red-600` below each field; help text stays underneath rather than being replaced.
  - [x] 2.12 Edit button toggles to edit; Cancel calls `reset(brief)` + back to view; Save fires `PUT /api/briefs/[name]`.
  - [x] 2.13 "Carregat a HH:MM" (Catalunya tz) is rendered above the form; in create mode that line becomes "Nou brief".
  - [x] 2.14 `PUT /api/briefs/[name]` validates with zod, serialises via `serializeBrief`, commits with the prior sha (optimistic concurrency surfaced from GitHub's 409 path if the sha is stale).
  - [x] 2.15 Successful save toasts "Brief desat" via sonner, resets the form to the new values, swaps back to view mode, and calls `router.refresh()` so the sidebar picks up renamed briefs.
  - [x] 2.16 `web/app/briefs/new/page.tsx` mounts `BriefForm intent="create"` with the spec'd empty defaults (schedule `"0 8 * * *"`, timezone `Europe/Madrid`, one empty source with one empty query).
  - [x] 2.17 `POST /api/briefs` slugifies the brief name and rejects with 409 when a brief with that filename already exists (via `BriefAlreadyExistsError` from GitHub's 422). Rejects with 400 when the slug is empty.
  - [x] 2.18 "Delete brief" button (destructive variant, with `Trash2` icon) sits at the bottom of the form in view mode and opens a shadcn Dialog confirmation.
  - [x] 2.19 `DELETE /api/briefs/[name]` removes the file via the Contents API using the current sha; on success the client toasts, pushes `/`, and refreshes.
  - [x] 2.20 Sources live in `useFieldArray({name: "sources"})`. Edit mode shows a `+ Add source` button + a trash icon per card (hidden when only one source remains).
  - [x] 2.21 Queries live in a nested `useFieldArray` inside `<SourceCard>`. `+ Add query` appends `{token: "", csv: false}`; trash removes (hidden when only one query remains). The CSV checkbox is wired via `Controller`.
  - [x] 2.22 Help text rewritten in the PLG template (what / format / example) across every field. Removed internal references to future tasks from the visible copy.
  - [x] **2.23 (post-2.0 fix-ups, applied 2026-05-16 after user review)**
    - **Sidebar refresh (round 1)**: `BriefSidebar` was a Client Component that fetched `/api/briefs` in a one-shot `useEffect`, so renaming a brief and saving didn't update the sidebar entry. Refactored to a Server Component reading `getBriefList()` directly (new `web/lib/briefs.ts`), with the active-item highlighting delegated to a tiny `BriefSidebarList` client component using `usePathname()`.
    - **Sidebar refresh (round 2)**: round 1 wasn't enough — the layout was still being statically rendered (`/` and `/briefs/new` showed up as `○` in the build output), so the RSC payload for the sidebar survived across mutations. Two-part fix that now lands the canonical pattern for any future brief-mutation endpoint:
      1. `export const dynamic = "force-dynamic"` on `app/layout.tsx`. All routes are `ƒ` (dynamic) now; the cost is negligible because the home page and `/briefs/new` are trivial.
      2. `revalidatePath("/", "layout")` called inside `POST /api/briefs`, `PUT /api/briefs/[name]`, and `DELETE /api/briefs/[name]` right after the GitHub commit lands. Any future endpoint that writes a brief MUST follow the same pattern.
    - **Info-icon help — Popover then Tooltip**: replaced the always-visible muted help text with an Info-icon affordance next to each Label (added the `popover` shadcn primitive). First implementation used Popover (click-to-open); after user feedback that the icon felt empty on hover, swapped to Tooltip (added the `tooltip` shadcn primitive) with the same content. `TooltipProvider` wraps the body in `layout.tsx`. The `popover` primitive stays in the repo because task 3.10 (ChannelCombobox) is documented to use Command + Popover.
    - **Field renames + Inputs/Outputs grouping** (UI vocabulary; YAML keys unchanged for executor compatibility):
      - `Name` → `Brief Name`
      - `Mode report token` → `Mode report` (drops jargon suffix)
      - `Schedule (cron)` → `Schedule` (the "(cron)" suffix scared non-technical users away)
      - `Timezone` → `Time Zone`
      - `Slack channel` → `Slack Channel`
      - Form body restructured: `Brief Name` at the top, then an **Inputs** card (Sources + Prompt), then an **Outputs** card (Schedule + Time Zone + Slack Channel). Each card has a small uppercase title in muted zinc. See the new "Form layout" + "Canonical UI labels" bullets in PRD §6.
      - zod validation messages updated to reflect the new chrome names: «El **Brief Name** és obligatori», «El **Mode report** és obligatori», «La **Time Zone** és obligatòria», «El **Slack Channel** és obligatori».
    - **Language policy**: enforced the criterion documented in the "Scope" block above:
      - zod validation messages in Catalan with chrome terms in English.
      - Button-state labels Anglicised: «Desant…» → "Saving…", «Creant…» → "Creating…", «Esborrant…» → "Deleting…", dialog «Esborrar brief?» → "Delete brief?".
      - Narrative kept Catalan: dialog description, toasts ("Brief desat" / "Brief creat" / "Brief esborrat" / error toasts), `Carregat a HH:MM`, `Nou brief`, sidebar empty state, footer fallback `Versió no disponible`, layout suspense fallbacks (`Carregant briefs…`, `Carregant versió…`).
    - **Submit gate on invalid form** (Option B from the UX discussion): `useForm` runs with `mode: "onChange"` plus a `trigger()` on mount so `isValid` is correct from the first render. The Save/Create button is disabled when `!isValid`, and a small muted hint appears below the action row in edit mode explaining what to fix: «Omple els camps obligatoris per crear el brief.» (create) / «Hi ha camps obligatoris buits o invàlids; revisa els avisos en vermell.» (edit). Fixes the case where an empty New-brief form had Create looking actionable.
    - **Delete dialog references Brief Name, not filename**: the confirmation prose now reads «Vols esborrar el brief «<Brief Name>»?» using the human-readable name. The YAML slug is no longer surfaced to the user at confirmation time.

  - [x] **2.24 (extra post-2.0 polish landing 2026-05-16)**
    - **Asterisks for required + lazy error display**: form fields marked obligatory show a red `*` next to the label. Validation still runs continuously (RHF mode `onChange` + `trigger()` on mount) so `isValid` drives the disabled Save/Create button, but `aria-invalid` and the inline FieldError are gated on `(touchedFields[name] || isSubmitted)` via a new `shouldShowError(name)` predicate (powered by a `touchedAtPath` walker that handles nested arrays like `sources.0.queries.1.token`). Effect: opening New-brief is clean — asterisks, disabled Create, no red noise — and red feedback only appears once the user has interacted with a field.
    - **Time Zone removed**: company runs in a single TZ, so the per-brief field was noise.
      - Web: `Time Zone` input removed from the Outputs section; Schedule's «i» tooltip now states the schedule is interpreted in Catalunya local time.
      - Schema: `timezone` removed from `briefSchema`; `parseBrief` no longer sets it; `serializeBrief` no longer emits it; `EMPTY_BRIEF` updated.
      - Python: `due_runner.py` introduces a `SCHEDULE_TZ = "Europe/Madrid"` constant; `resolve_tz` falls back to it; `cfg.get("timezone")` is no longer read.
      - YAMLs: both fixtures lost their `timezone:` field (the briefs are dummy fixtures so the resulting time shift for `fraude-bikes` has no production impact).
    - **Tasks 5.1–5.3 closed as part of this commit** (CSV-per-query in executor + YAML migrations). The user confirmed the existing briefs are dummy fixtures, so doing the migration alongside the TZ change was safer than keeping two schemas in flight.

- [x] **3.0 Specialised form widgets: cron visual builder + Slack channel combobox** ✅
  - [x] 3.1 `web/lib/cron.ts` ships `buildCron(state)` and `parseCron(cron)` for the daily / weekly-by-days / monthly-by-day-of-month grid. Hours 0–23, minutes locked to 0 / 15 / 30 / 45. `parseCron` returns null for any off-grid cron so the UI can fall back to a raw input.
  - [x] 3.2 `humanize(cron)` in the same file returns Catalan sentences using day names diumenge → dissabte ("Cada dia a les 10:00", "Cada dilluns i dimecres a les 09:15", "El dia 15 de cada mes a les 08:00").
  - [x] 3.3 `web/components/CronBuilder.tsx` — **two sections, not three**: Frequency (Select with daily / hourly / dies de la setmana / dia del mes; conditional UI per kind) + Time (hour Select 00–23 and minute Select 00/15/30/45). The Time Zone section from the original spec was dropped after task 2.24 removed the per-brief timezone field (company-wide hardcoded TZ). The "Cada hora" option was added later (during 4.0): it emits `MM * * * *` and the Time section hides the hour Select to reflect that the hour position is `*`.
  - [x] 3.4 Live preview renders below the controls: humanise() output in normal text, generated cron in `font-mono text-xs text-zinc-500`.
  - [x] 3.5 `BriefForm` swaps the raw `schedule` Input for `<CronBuilder>` via `Controller`. View mode uses a small `SchedulePreview` helper (humanise() + cron in muted mono) instead of the plain `ReadonlyValue`. (No `timezone` to replace; that field was removed in 2.24.)
  - [x] 3.6 Off-grid cron handling: `parseCron` returns null → CronBuilder renders a raw `font-mono` Input plus an amber "Custom" badge, an explanation, and a "Reset to builder" button that drops back to the daily 08:00 default. The `lastEmittedRef` guard prevents reset(brief) loops when RHF re-syncs values.
  - [x] 3.7 `web/lib/slack.ts:listChannels()` calls `conversations.list` with `types=public_channel,private_channel`, follows cursor pagination, filters to `is_member=true`, and returns sorted `[{id, name, is_private}]`.
  - [x] 3.8 `web/app/api/channels/route.ts` caches the result in a module-level entry with a 5-minute TTL. `?force=true` busts the cache.
  - [ ] 3.9 **User action (cannot be coded; STILL PENDING)**: in Slack app config (`api.slack.com/apps`), add bot scopes `channels:read` and `groups:read`; reinstall the app to the workspace (likely requires admin approval); copy the new Bot Token; update `SLACK_BOT_TOKEN` in Vercel env vars. Until this is done, `/api/channels` returns 502 with the Slack error and the combobox shows the error state but the rest of the form is unaffected.
  - [x] 3.10 `web/components/ChannelCombobox.tsx` uses shadcn Command inside a Popover. Trigger button shows the current value with a `#` or 🔒 icon and the channel name in `font-mono`; chevron-up-down icon on the right.
  - [x] 3.11 Each option renders the icon + name in `font-mono`, with a Check icon on the currently-selected one.
  - [x] 3.12 Free-text entry: when the typed query doesn't exact-match any channel, a "Use «typed-name»" item appears below the list. Enter on the input or click commits the typed value.
  - [x] 3.13 When the saved value isn't in the latest channel list, an amber shadcn `Alert` renders below the combobox: «El bot no és al canal #<name>» plus the invite snippet and a Copy button.
  - [x] 3.14 Copy button writes `/invite @cooltra-reporting-bot` to clipboard via `navigator.clipboard.writeText` and toasts "Copiat!" (2s) via sonner. Falls back to an error toast if the clipboard API fails.
  - [x] 3.15 `BriefForm`'s Slack Channel input swaps in `<ChannelCombobox>` via `Controller`. View mode keeps the existing `ReadonlyValue`. `aria-invalid` propagation is replaced by a conditional className on the combobox trigger button (the underlying `<button>` doesn't accept `aria-invalid` per ARIA, so we apply the red border / ring directly).
  - [x] 3.16 Stale-while-revalidate: the combobox kicks off a 5-minute `setInterval` on mount that re-hits `/api/channels` in the background. When the bot gets invited to a new channel between renders, the next poll picks it up and the bot-not-in-channel warning disappears automatically because the match check re-runs against the fresh list.

- [x] **4.0 Execution tracking + per-brief metadata** ✅
  - [x] 4.1 `executor.py:generate_brief()` now returns `(text, usage)` where `usage = {input, output, total}` is read defensively from `response.usage` (getattr with `or 0` so a missing field doesn't crash; total falls back to input+output).
  - [x] 4.2 `write_run_record()` writes `out/<filename-slug>.run.json` with `{brief, started_at, finished_at, status, tokens, error}`. **Slug deviation from spec**: the file is named after the YAML filename, not after `brief.name`. Reason: filenames are stable across rename-from-web, brief.name is editable; aligning everything on the filename keeps `save_artifacts`, `write_run_record`, the artifact name, and the web app's lookup all using the same key.
  - [x] 4.3 `main()` refactored around `try / except BaseException / finally`. `BaseException` covers both `sys.exit()` (SystemExit propagates with its original code/message) and unexpected errors. State dict starts as a failed placeholder so the early-exit paths still produce a meaningful record. `finally` always writes the record; if the write itself fails it logs a warning rather than shadowing the original exception.
  - [x] 4.4 `run-brief.yml` has a new "Compute brief slug" step (`basename "$inputs.brief" .yml`) plus an `actions/upload-artifact@v4` step with `name: run-<slug>-<run_id>`, `path: out/*.run.json`, `retention-days: 90`, `if: always()` so failed runs also upload their failed-state JSON.
  - [x] 4.5 `run-due-briefs.yml` has a "Compute timestamp" step (UTC `YYYYMMDDTHHMMSSZ`) plus the same upload step with `name: runs-due-<timestamp>-<run_id>`. Different prefix from single-brief runs so the web app's filter distinguishes scanner runs (which may contain multiple briefs) from single-dispatch runs. `if-no-files-found: ignore` because most scanner ticks have no due brief.
  - [x] 4.6 `GET /api/runs/[brief]/route.ts` calls `fetchLatestRun(slug)` from `lib/runs.ts`. The implementation lists all artifacts (first page, 100 max), filters by name prefix (`run-<slug>-` ∪ `runs-due-`), sorts by `created_at` descending, downloads zips on demand and looks inside for `<slug>.run.json`. Stops at the first match. Returns `{kind: "ready", record, artifact_name, artifact_created_at}` or `{kind: "never-run"}`.
  - [x] 4.7 5-min in-memory cache (`Map<slug, {fetchedAt, data}>`) shared with the endpoint, bustable via `?force=true`. Same pattern as `/api/channels`.
  - [x] 4.8 Sidebar uses a new `getBriefListWithRuns()` that shares **one** artifact listing across all briefs and dedup-downloads zips that contain multiple slugs (e.g., a single `runs-due-*` artifact can resolve every brief that fired in that scanner tick). Each row in `BriefSidebarList` renders a dot-status (emerald success, red failed, zinc never-run) next to the name, plus a secondary line with relative time («fa 3h» helper) and the token badge `«1.2k + 0.4k»` in font-mono.
  - [x] 4.9 `ExecutionMetadata.tsx` (client) sits between the page title and the BriefForm. Ready state shows the success/failed status with a CheckCircle2/XCircle icon, the timestamp formatted as "DD/MM/YYYY HH:MM Catalunya" (Tooltip on hover reveals the raw UTC ISO), Input/Output/Total token stats in a small grid, and the error message in a red-tinted muted box when failed. A bottom strip in `text-[11px] font-mono` shows the artifact `created_at` + `artifact_name` so the user can correlate with the Actions run.
  - [x] 4.10 Edge cases: **Loading** state shows "Carregant execució…". **Never-run** state shows "Mai executat" with a Refresh button. **Error** state shows the explanatory line + underlying message + Retry button that hits `?force=true`. The "no recent artifact (>90 days)" case folds into never-run since the artifact retention removes the file (no observable difference from a brand-new brief).
  - [x] **4.11 (post-4.0 polish, landed 2026-05-16 after user feedback)**
    - **Cancel-create confirmation**: in create mode, clicking Cancel now opens a shadcn Dialog «Cancel create? Si cancel·les ara, es perdran tots els canvis...» with "Keep editing" (outline) and "Discard changes" (destructive) buttons. Edit mode keeps the silent revert behaviour (the original data was already on disk at page load). Reason: long forms with 20-row prompt textareas + dynamic sources made an accidental click on Cancel painful; the dialog adds a single intentional click between the user and data loss.
    - **Duplicate action row at the bottom**: Edit / Cancel / Save / Create plus the validity hint are now rendered both at the top of the form AND in a `border-t pt-6` block after the Outputs section, so users editing the prompt at the bottom of the form don't have to scroll up to act. Extracted as `actionButtons` and `validityHint` JSX consts inside `BriefForm` (rather than as inner React components) to satisfy `react-hooks/static-components`.
    - **Hourly frequency in CronBuilder**: new "Cada hora" option in the Frequency Select emits `MM * * * *`. The Time section hides the hour Select and switches its label to "Minute" when this kind is active. parseCron accepts `*` in the hour position when DOM and DOW are also `*`. humanize returns «Cada hora a les :MM».
    - **Sidebar name truncation**: long brief names truncate with an ellipsis (`min-w-0 flex-1 truncate`) instead of overflowing the 280px sidebar. Each row is wrapped in a shadcn Tooltip anchored `side="right"` that reveals the full name on hover.
    - **Early-data freshness warning** ~~(`EarlyDataWarning.tsx`)~~ **REMOVED 2026-05-16** at user request — the amber alert on every brief detail before 10:00 Catalunya time was more noise than signal in practice. Most briefs either run scheduled after 10:00 or are manually dispatched by users who already know the data freshness situation. Component file deleted, mount in `app/briefs/[name]/page.tsx` removed. Original behaviour: client component checked `Intl.DateTimeFormat({timeZone: "Europe/Madrid"})` for the current hour after mount and rendered an amber `Alert` when hour < 10, warning that the daily Mode data dump might not yet be complete.
    - **Reference link**: new optional `reference_link` field on briefs. UI: an optional URL input inside the **Content** section, below Prompt (lives with the rest of what gets posted with the message); validation is empty OR `http(s)://...`. Schema (`lib/schemas.ts`): always-present string field allowed to be empty. YAML (`lib/yaml.ts`): `serializeBrief` only emits the key when the value is a non-empty trimmed string. Executor (`scripts/executor.py:post_brief_to_slack`): when present, appends `\n\n🔗 <URL|Reference link>` to the message body so Slack mrkdwn renders it as a clickable labelled link. Empty / missing values produce no extra line.
    - **Section renames (Inputs → Content, Outputs → Distribution)**: the two bordered cards in `BriefForm` were renamed for clarity:
      - **Content** = everything that travels with the message (Sources + Prompt + Reference link).
      - **Distribution** = when and where it's published (Schedule + Slack Channel).
      Pure copy change in `BriefForm.tsx`; YAML keys, schemas and Python executor are unaffected.

- [x] **5.0 List-calendar + schema migration + polish + retire static dashboard** ✅ (closed 2026-05-16, all sub-tasks merged via PR #32 main bundle and PR #33 scheduler fix)
  - [x] 5.1 Done as part of the timezone removal (commit 714219b). `scripts/executor.py` now reads `csv` from each query: `fetch_source` returns a `csv_by_name` mapping; `post_brief_to_slack` filters per-query before uploading. Bare-string queries still accepted and treated as `csv: false`.
  - [x] 5.2 Done in the same commit. `briefs/fraude-bikes-unit-economics.yml` migrated: brief-level `csv: true` removed; both queries converted to `{token, csv: true}`.
  - [x] 5.3 Done in the same commit. `briefs/app-version-adoption.yml` migrated: brief-level `csv: true` removed; the single query converted to `{token, csv: true}`. `timezone:` also dropped (see 2.24 for the company-wide TZ change).
  - [x] 5.4 Verified manually on 2026-05-16: dispatched `Run brief` workflow on `main` for both `fraude-bikes-unit-economics.yml` (2 CSVs in thread expected) and `app-version-adoption.yml` (1 CSV expected). Slack message landed in `#test-github-oriol` for both runs; thread CSV count matched expectations. Closes the verification gap left open by 5.1-5.3.
  - [x] 5.5 Implemented `web/app/schedule/page.tsx` as a server component. Suspense-wraps a `ScheduleTable` that awaits `getBriefListWithRuns()` (reusing the same lib as the sidebar — one fetch, two surfaces). Each brief is mapped to `nextFireAt(cron)` from the new `lib/cron.ts` helper backed by `cron-parser` with `tz: "Europe/Madrid"` (DST-correct). Rows are sorted ascending by next fire; rows with an invalid cron sink to the bottom and tie-break alphabetically.
  - [x] 5.6 Columns: Brief (link to `/briefs/<filename>`), Proper fire (stacked relative «en 3h» + absolute «HH:MM dl DD/MM» Catalunya time, formatted with `Intl.DateTimeFormat("ca-ES", { timeZone })`), Schedule (humanize() or raw cron in font-mono fallback), Última run (status icon + "Èxit" / "Error" / "Mai executat").
  - [x] 5.7 New `SidebarNav.tsx` client component holding the `New brief` button + a `Schedule` link with active-route highlight derived from `usePathname`. Extracted out of the server `BriefSidebar` so the route check can be client-side without forcing the entire sidebar to be a client component.
  - [x] 5.8 Skeleton placeholders (new `components/ui/skeleton.tsx` primitive — `animate-pulse rounded-md bg-zinc-200/70`): `SidebarSkeleton` (4 row placeholders mirroring BriefRow) wired as the Suspense fallback in `layout.tsx`; `ExecutionMetadata` loading state replaced inline (icon dot + label line + refresh button); `BriefFormSkeleton` (long-form: action row + Brief Name + Content card + Distribution card); new `app/briefs/[name]/loading.tsx` and `app/briefs/new/loading.tsx` rendering the full page placeholder while the server component resolves. `/schedule` ships its own `ScheduleSkeleton` (4 row table placeholder).
  - [x] 5.9 Empty states: `app/page.tsx` is now a server component that calls `getBriefList()` and renders a dashed-border empty card with «Cap brief encara — crea'n el primer» + a `New brief` CTA when the list is empty (welcome card stays when there are briefs). `/schedule` renders «Cap execució programada properament» when the list is empty OR every brief's cron resolves to null, with a body text that adapts.
  - [x] 5.10 Error boundary: `app/error.tsx` is the per-segment client boundary catching errors from any page below `app/` — renders «Alguna cosa ha fallat» + error.message + the React digest + a "Torna a provar" button calling `reset()`. `app/global-error.tsx` is the root-level fallback used when the root layout or `app/error.tsx` itself throws — uses inline CSS-in-JS (no shadcn / tailwind) so it works even when the layout's providers are missing.
  - [x] 5.11 Help text review: kept the entries that already followed the `what + format + example` pattern (name, schedule, slack_channel, reference_link). Polished four:
    - `prompt`: added the "in JSON" data-attachment note + a concrete starter example («Resumeix les dades en 3 bullets...»).
    - `mode_report`: added the multi-source-per-brief clarification.
    - `query_token`: added the exact URL path pattern so users know where to copy the token from in Mode's UI.
    - `csv`: added the default behaviour + the per-query independence note.
  - [x] 5.12 Deleted `scripts/build_dashboard.py`, `templates/dashboard.html.j2`, `templates/` (empty), and `.github/workflows/build-dashboard.yml`. The static Jinja-rendered dashboard is fully replaced by the Vercel Next.js app.
  - [x] 5.13 Updated `.gitignore`: removed the `docs/` entry; added `web/node_modules/`, `web/.next/`, `web/.vercel/`.
  - [x] 5.14 Rewrote root `README.md` (was a single-line `pending` placeholder). Now describes what a brief is, the monorepo layout, the env vars the Python executor and the web app each require, how to trigger a brief manually from the GitHub Actions tab, basic dev commands, and the active iteration roadmap with status markers pointing at this file.
  - [x] 5.15 End-to-end smoke test passed on the Vercel preview of `feature/5.0-schedule-calendar-polish` on 2026-05-16. Created/edited/deleted a test brief; verified sidebar, `/schedule`, ExecutionMetadata, Skeletons and the Content/Distribution rename. The pass surfaced four UX papercuts (CronBuilder Select ordering, "Proper enviament" wording, sidebar refresh after a run, Delete-dialog copy) that were fixed in commit `cf98490` before merging, plus the scheduler off-by-one bug captured below as 5.15.a.
  - [x] **5.15.a (bugfix found during smoke test, landed 2026-05-16)** Scheduler off-by-one. A brief with `schedule: 45 * * * *` was reportedly never executing — no Slack message, no run record, no error. Root cause traced to `scripts/due_runner.py:is_due()`: the window bound was `delta < window_seconds` (strict), so when a GH Actions `*/15` tick was missed or drifted past its 15-min window (documented common at hour boundaries per GH Actions docs), the next tick saw `delta == 900s` exactly and the strict `<` rejected it. Fix: changed to `delta <= window_seconds` so the inclusive boundary catches cron-perfect adjacent ticks. Verified by simulation: every `MM * * * *` brief now has continuous 15-min detection coverage and the :00 tick catches a missed :45 fire. Theoretical duplicate-dispatch risk doesn't materialise in practice because GH Actions' ~30s setup-time floor pushes `now_utc` well past delta == window_seconds before due_runner.py executes. The deeper resilience answer remains task 6.0 (Run Now manual recovery).
  - [x] 5.16 Closed 2026-05-16 across two PRs against `main`: PR #32 (`feature/5.0-schedule-calendar-polish` → `main`) merged the full 5.0 bundle (Schedule page, UX polish, retire static dashboard, 5.15 fixes), and PR #33 merged the scheduler off-by-one fix described in 5.15.a. Vercel Production already tracked `main` from the original cutover (see PRD note + README), so no Production-branch flip was needed — production deployed automatically on each merge.

- [x] **6.0 Manual brief runs ("Run Now" button)** ✅ (closed 2026-05-16, merged via PR #35)
  - **Dual purpose**: Run Now is both (a) the primary on-demand-test affordance during prompt iteration, and (b) the documented **recovery path** for missed scheduled runs (see PRD §7 "Scheduling reliability"). When GitHub Actions delays the master scanner cron beyond the 15-min window, the scheduled execution is lost; the user opens the affected brief and clicks Run Now to dispatch manually. The 2-minute cooldown still applies.
  - [x] 6.1 PAT update done by user 2026-05-16: `vercel-reporting-mode` token granted `Actions: Read & write` (already had `Contents: Read & write` + `Metadata: Read-only`). The token value did not regenerate when the permission was added, so Vercel env vars needed no change — the same `GITHUB_TOKEN` now has authorisation for `workflow_dispatch`.
  - [x] 6.2 Implemented `web/lib/dispatch.ts:dispatchBriefRun(filename)`. Wraps the URL slug into `briefs/<slug>.yml` (the workflow input expects the full path), `POST /repos/{owner}/{repo}/actions/workflows/run-brief.yml/dispatches` with `{ ref: "main", inputs: { brief: ... } }`. GH returns 204 with no body — there's no specific run id to surface, so the function returns the workflow's HTML URL so the caller can deep-link the user to the Actions tab where the freshly-dispatched run appears within seconds.
  - [x] 6.3 Implemented `POST /api/briefs/[name]/run`. Verifies the brief exists (`readBrief`, 404 if not), enforces a 2-minute server-side cooldown via a module-level `Map<filename, lastDispatchedAtMs>` (429 + `retry_after_seconds` when violated so the client can align), then calls `dispatchBriefRun`. Cooldown is only recorded on a successful dispatch — a failing POST doesn't block a retry. Module-level Map is per-Vercel-instance; resets on cold start, which is acceptable because the client persists its own deadline to localStorage.
  - [x] 6.4 Implemented `web/components/RunNowButton.tsx`. Four explicit states: **disabled-create** (on `/briefs/new`, wrapped in a `<span>` so the Radix Tooltip listener still fires hover on the disabled `<button>`; tooltip body «Crea el brief abans de poder executar-lo.»), **disabled-cooldown** (label morphs to `Run Now — torna a provar en M:SS` with a live mm:ss countdown via `setInterval(1s)`; deadline persisted to `localStorage["runnow:<filename>"]` and hydrated on mount so F5 doesn't reset it), **disabled-running** (label `Running…` between POST and response), and **enabled** (default). Toast surface: success → `toast.success("Run dispatched a GitHub Actions", { action: { label: "Veure", onClick: () => window.open(workflow_url) } })`; 429 → `toast.warning` aligning local cooldown with `retry_after_seconds`; other failures → `toast.error`.
  - [x] 6.5 Mounted RunNowButton in the **title row** of both `/briefs/[name]` and `/briefs/new` (revised from the original spec "above Brief Name field" after the 6.6 review). New layout: `<div className="flex items-center justify-between gap-4">` with the title block on the left (`h1.brief.name` + `p.filename.yml`, `truncate`) and the button on the right (`shrink-0`). On the new-brief page the button renders in the disabled-create state — visible, never hidden.
  - [x] 6.6 Smoke test on Vercel preview by user 2026-05-16. Two papercuts surfaced and were fixed before merge (second commit on the branch):
    - **Run Now placement**: originally placed in its own row between `ExecutionMetadata` and `BriefForm`. User wanted it in the title row, vertically centered with the brief title. Moved.
    - **ExecutionMetadata stale on initial mount**: the card was calling `load(false)` which served from the `/api/runs/[brief]` 5-min cache; the sidebar fetched fresh via `fetchLatestRuns` so the two surfaces showed different runs for the same brief. Switched the mount effect to `load(true)`. The cache code stays in place for any future opt-in caller; today it's effectively unused, which is the right trade-off for an internal tool of this scale.

- [ ] **7.0 Multi-language support** (new, added 2026-05-16, confirmed future requirement — implementation deferred)
  - [ ] 7.1 Inventory every Catalan string in `web/`: zod messages in `lib/schemas.ts`, `FIELD_HELP` map in `BriefForm.tsx`, toast strings (`Brief desat` / `Brief creat` / `Brief esborrat` / error toasts), dialog body and title strings, button-state labels that happen to be Catalan ("Saving…", etc. should stay English per the language policy, but verify), Suspense fallback strings, sidebar loading/empty/error strings, Footer fallback. Produce a single audit document listing key + location + literal.
  - [ ] 7.2 Decision: in-house dictionary (`web/lib/i18n/<locale>.ts` + a small `t(key)` helper) vs. `next-intl`. Default recommendation: in-house dictionary for the first two locales; reconsider `next-intl` if locale-aware routing or ICU message formatting is needed. Document the choice in the PRD before implementing.
  - [ ] 7.3 Implement the chosen mechanism: create the dictionary files (start with `ca.ts` carrying everything from 7.1; leave `<second-locale>.ts` empty or stub-translated). Replace every literal occurrence with `t(key)`. The chrome strings (English labels / buttons / headings) stay literal and are NOT routed through `t()` — they're the policy's invariant.
  - [ ] 7.4 Add the second-locale catalog (likely `es.ts` for Castilian Spanish or `en.ts`; confirm with the user before translating).
  - [ ] 7.5 Add a locale switcher: a small dropdown in the sidebar footer or settings. Persist the choice in a cookie so the server can pick the right catalog on first paint.
  - [ ] 7.6 Verify on the Vercel preview: every localised string switches when the locale changes; chrome stays English in all locales; the «El _Slack channel_ és obligatori» / «El _Slack channel_ es obligatorio» / "_Slack channel_ is required" pattern works in all three.

- [ ] **8.0 Mode space catalog (Report + Query pickers in BriefForm)** (new, added 2026-05-16 after user feedback — implementation deferred)

  **Goal**: replace the free-text inputs for `mode_report_token` and `queries[].token` with comboboxes populated from the Cooltra Mode space at `https://app.mode.com/ecooltra706/spaces/9d367a761ba1`. Users pick reports / queries **by name**; the YAML still stores the underlying **tokens**. Cuts down on token-copy mistakes and surfaces the available reports without the user leaving the form.

  **Approach** (option 1 from the user discussion): fetch the catalog from Mode on each page load, cached server-side for 5 minutes. No state committed to the repo. Option 2 (manual refresh + JSON in repo) was considered and rejected — see the discussion below.

  - [ ] 8.1 **User action (cannot be coded)**: copy `MODE_TOKEN`, `MODE_SECRET`, `DEFAULT_MODE_ACCOUNT` from GitHub Secrets to Vercel env vars (Production + Preview). The Python executor has them; the web app doesn't yet.
  - [ ] 8.2 Implement `web/lib/mode.ts` (server-only): typed HTTP wrappers that mirror the flow `scripts/executor.py:resolve_query_tokens` already uses. Two exported functions:
    - `listSpaceReports(spaceId): Promise<{token: string, name: string}[]>` — `GET /api/{account}/spaces/{space}/reports` (paginate if needed).
    - `listReportQueries(reportToken): Promise<{token: string, name: string}[]>` — `GET /api/{account}/reports/{report}/queries`.
    Account resolution follows the same fallback as the executor (source-level → `DEFAULT_MODE_ACCOUNT` env var).
  - [ ] 8.3 Implement `web/app/api/mode/space-catalog/route.ts`: `GET` returns `{reports: [{token, name, queries: [{token, name}]}]}` for the Cooltra space (id hardcoded to `9d367a761ba1` for now; can be promoted to an env var later). Module-level Map with 5-minute TTL; `?force=true` busts the cache. 502 on Mode API errors.
  - [ ] 8.4 Implement `web/components/ReportCombobox.tsx`: shadcn Command + Popover. Trigger button shows the current report's NAME (and the token in a secondary muted line). Search filters by name. Free-text fallback when the catalog is unavailable.
  - [ ] 8.5 Implement `web/components/QueryCombobox.tsx`: same pattern as ReportCombobox. **The query list is scoped to the currently-selected report** for that source — watched from RHF (`useWatch({name: \`sources.${sIdx}.mode_report_token\`})`). If the report value changes, the queries combobox resets / re-filters.
  - [ ] 8.6 Wire into `BriefForm` / `SourceCard`:
    - `mode_report_token` input → ReportCombobox (Controller-wrapped on the `sources.${idx}.mode_report_token` field).
    - Each `queries[].token` input → QueryCombobox (Controller-wrapped on the `sources.${idx}.queries.${qIdx}.token` field; reads the parent source's `mode_report_token` to determine the available list).
    - YAML output unchanged: still stores tokens.
  - [ ] 8.7 Edge cases:
    - **Saved token not in current catalog** (renamed / deleted at Mode): show the value with an amber badge "no és al catàleg actual"; allow keep + edit but warn the user.
    - **Mode API down / 502**: fall back to a free-text input with a muted hint "Mode no disponible — escriu el token manualment".
    - **Empty space (no reports)**: combobox shows an empty state with a link to the Mode space.
    - **Report selected but its query list empty**: similar empty state for queries.
  - [ ] 8.8 Manual verification on Vercel preview: open `/briefs/new` → Report combobox lists reports from the configured space; pick one → Queries combobox restricted to that report's queries; save → resulting YAML stores tokens only.

  **Option 2 discussion (deferred / rejected for now)**: an alternative would be to expose a "Refresh Mode catalog" button that fetches the catalog and commits a `mode-catalog.json` to the repo, so subsequent reads avoid the Mode API entirely. ~25-35% more code (GitHub write path + refresh UI), zero runtime Mode calls, but adds a manual maintenance step (someone has to refresh when Mode changes) and creates bot-driven commits in git history. For Cooltra's scale (a few reports, internal team) option 1's 5-minute cache is sufficient and simpler.

- [x] **10.0 Brief output history — backend-only capture + API** ✅ (closed 2026-05-16, merged via PR #41; docs at PR #40 / #42)

  The brief content GROQ produces previously lived ONLY in Slack — scattered across N channels, inaccessible to anyone without channel membership, impossible to compare across runs. This task captured every successful GROQ output alongside the existing `<slug>.run.json` artifact and exposed the last up to 3 entries per brief via a dedicated API endpoint. UI surfacing (landing feed, per-brief history view) is **explicitly out of scope** of 10.0 — a separate follow-up will decide the UX shape once the capture layer is in place. Independent from 11.0; both can ship in either order.

  - [x] 10.1 Discovery: `scripts/executor.py:save_artifacts()` already wrote `out/<slug>.brief.md` from an older path that never got plumbed through — the file was being written to the runner's disk and discarded with it. Implementation made it a first-class output: wrapped the `save_artifacts` call in `main()` with a `try/except` so a write failure (disk full, permissions) logs a warning and lets the Slack post continue instead of killing the run. `save_artifacts` docstring rewritten to document both side-effects (`<slug>.raw.json` Mode snapshot, `<slug>.brief.md` raw GROQ markdown) and the best-effort contract.
  - [x] 10.2 `.github/workflows/run-brief.yml`: extended the `actions/upload-artifact` `path:` from `out/*.run.json` to a multi-line glob including `out/*.brief.md`. Artifact name stays `run-<slug>-<run_id>`, retention stays 90 days. Step renamed to "Upload run record + brief output" for self-describing artifact lists.
  - [x] 10.3 `.github/workflows/run-due-briefs.yml`: same extension, step renamed to "Upload run records + brief outputs". A single scheduler tick now packages multiple `.brief.md` files in the same `runs-due-*` zip — one per brief that produced text in that tick.
  - [x] 10.4 Implemented `web/lib/outputs.ts` (server-only). `fetchLatestBriefOutputs(slug, limit = 3)` reuses `lib/runs.ts`'s `listArtifacts` + `downloadZip` primitives (made `export` to avoid duplicating ~50 LOC of GitHub artifact plumbing). For each candidate artifact: downloads the zip, reads `<slug>.brief.md`, cross-references the colocated `<slug>.run.json` for `run_status`. Failed-before-GROQ artifacts (no `.brief.md`) are silently skipped. Returns sorted DESC by artifact `created_at`. New exported `BriefOutput` type `{ markdown, created_at, artifact_name, run_status }`.
  - [x] 10.5 Implemented `GET /api/briefs/[name]/outputs` at `web/app/api/briefs/[name]/outputs/route.ts`. Mirrors the conventions of `/api/runs/[brief]`: `readBrief(slug)` → 404 with `{ error: "Brief no trobat" }` if missing; 5-min in-memory cache via module-level `Map<slug, ...>` (`?force=true` busts); 502 with the upstream message on Mode / GitHub failure. Response capped at 3 entries via `MAX_ENTRIES` constant.
  - [x] 10.6 Smoke test on Vercel preview by user 2026-05-16: dispatched `fraude-bikes-unit-economics` on `feature/10.0-brief-output-history` branch via GitHub Actions UI (workflow_dispatch with manually-chosen `ref`, since `RunNowButton` hardcodes `ref: "main"`). Confirmed the resulting artifact contains BOTH `fraude-bikes-unit-economics.run` (JSON) and `fraude-bikes-unit-economics.brief` (Markdown). Hit `/api/briefs/fraude-bikes-unit-economics/outputs` directly on the preview URL → returned `{ outputs: [{ markdown: "## Summary\n...", run_status: "success", artifact_name: "run-...", created_at: "..." }], cached: false }`. Markdown was the **raw GROQ output** (`## Summary` / `## Insights` / `## Recommendations` headers, no Slack `*bold*` mrkdwn) — confirming the Q1.A decision from the PRD. Cross-reference with `.run.json` set `run_status` correctly. Encoding UTF-8 OK.

- [x] **11.0 Mode catalog landing** ✅ (closed 2026-05-16, merged via PR #44)

  Replaces the previously-empty `/` page with a Mode space browse view, cross-referenced with which briefs use each query. Each report is a card-styled accordion (collapsed by default); each query shows the names of the briefs using it via a popover anchored to the «usat per N briefs» badge. Queries with zero briefs surface a discreet «Create brief →» PLG nudge that navigates to `/briefs/new?prefill_report=<token>`. The sidebar layout grew a Catalog entry so the landing is reachable from anywhere. Independent from 10.0; shipped right after.

  - [x] 11.1 Implemented `web/lib/catalogIndex.ts` (server-only). `buildCatalogUsageIndex()` walks every brief YAML via `listBriefs` + `parseBrief` and inverts `sources[].queries[].token` into `Map<queryToken, BriefListItem[]>`. Consumers within each token are sorted alphabetically by `brief.name` for deterministic rendering. Trivially fast at Cooltra scale.
  - [x] 11.2 Extended `web/app/api/mode/space-catalog/route.ts`. The endpoint now fetches the Mode catalog AND the brief usage index in parallel (`Promise.all`), then merges `used_by: BriefListItem[]` per query. Same 5-min cache window covers both. `lib/mode-types.ts:ModeQuery.used_by` is OPTIONAL so the existing BriefForm comboboxes (task 8.0) ignore it without breaking.
  - [x] 11.3 Replaced `web/app/page.tsx`. Now a server component that calls `listSpaceReports`, `listReportQueries` and `buildCatalogUsageIndex` directly (skipping a self-HTTP round-trip), merges the data and renders `<CatalogBrowser>` inside a Suspense boundary. Sidebar layout untouched. Mode-down failure path renders an amber `CatalogError` card with the upstream message — sidebar continues to function.
  - [x] 11.4 Implemented `web/components/CatalogBrowser.tsx` (client). Top of the page: a small stats strip («N reports · M queries · X en ús per algun brief») followed by the search input. Reports render as card-styled `AccordionItem`s (shadcn `card`, `badge` primitives added via `npx shadcn add`), all collapsed by default. Each header shows a Database icon tile + report name (semibold) + token (font-mono muted) + TWO badges on the right: «N queries» and «M briefs» (count of unique briefs across all queries of the report). Each query row shows name + token + the usage badge. Search filters by name AND token; matching reports auto-expand via a controlled `value` prop on the Accordion.
  - [x] 11.5 Updated `web/app/briefs/new/page.tsx` to read `?prefill_report` from the async `searchParams` and pass it to `<BriefForm intent="create" prefillReportToken={...}>`. `CreateProps` in `BriefForm.tsx` gains the optional `prefillReportToken`; when present in create mode the first source's `mode_report_token` is initialised to that value. The ReportCombobox picks it up via its existing controlled `value`.
  - [x] 11.6 Mode-down fallback: any failure resolving `listSpaceReports` / `listReportQueries` / `buildCatalogUsageIndex` is caught in the page's `CatalogData` server component and renders the amber `<CatalogError>` card with the upstream message + recovery hint. Sidebar and the rest of the platform continue to function regardless.
  - [x] 11.7 Smoke test on Vercel preview by user 2026-05-16. Initial spec passed end-to-end (catalog loads, accordions toggle, badge expands, Create brief CTA prefills the form, search auto-expands matches). Three papercuts surfaced during review and were fixed before merge (see 11.8 polish bundle below).
  - [x] **11.8 (post-smoke polish bundle, landed 2026-05-16 same PR)** Three deviations from the original spec applied after the smoke test:
    - **Card UI redesign** — original render was a flat list of accordion items on a plain background; the user requested a card-based, more usable presentation. Each report now renders as a `rounded-xl border bg-white shadow-sm` card with a Database-icon tile, a stats strip above the search, and a secondary `Badge` for query count. shadcn `card` + `badge` primitives added via `npx shadcn add`. Internally queries render as mini inner cards (rounded-lg, zinc-50/50, hover lift).
    - **Popover replaces inline-expand** for the «usat per N briefs» badge. Original PRD req 48 called for an inline-expand; the implementation hit a shadcn AccordionContent height-lock bug — the accordion's `--radix-accordion-content-height` is measured once on open and any later content add/remove either clipped (growing) or left a stuck whitespace gap (shrinking). Switched to a shadcn `Popover` anchored to the badge: the consumer list renders via Radix portal, completely outside the accordion's DOM tree, so the height invariant is irrelevant. PRD req 48 was revised in the same PR to document this. Bonus side effect: the catalog layout no longer jumps when clicking badges, which makes the page calmer to scan.
    - **Dual badge on report header**: the report card header originally surfaced only «N queries». Added a second badge «M briefs» counting UNIQUE briefs across all queries of the report (a brief that uses two queries from the same report counts once). Emerald when > 0, outline muted when 0. Captured as PRD req 46 revision.
    - **Brief view-mode humanisation**: extended the deviation captured at PRD §7 — view mode now uses `ReportReadonly` + `QueryReadonly` that subscribe to the same `useSpaceCatalog()` client cache as the comboboxes and surface report/query names with the token muted underneath, falling back to the raw token in font-mono when the catalog is loading or the token is no longer in the space. Captured as PRD req 54.
    - **Catalog link in sidebar**: `SidebarNav` grew a "Catalog" entry (Database icon) immediately above "Schedule" so users can return to `/` from anywhere without typing the URL. `SidebarSkeleton` reserved a matching placeholder row to avoid layout shift on load. Captured as PRD req 55.
    - **Output-token colour signal**: the output-token count rendered in the sidebar `RunMeta` and the `ExecutionMetadata` card is now colour-coded — orange (> 250) / red (> 1000) — so users can spot expensive briefs at a glance. Thresholds + colour classes live in a single tunable file `web/lib/tokenWarnings.ts` so the whole app can be re-calibrated from one place. Both consumer sites import the `outputTokenColorClass` helper. Captured as PRD req 56.
- [x] **9.0 Schedule page: sortable columns + "Última run" timestamp** ✅ (new requirement, added 2026-05-16 from 8.x smoke-test feedback; landed same day)

  The `/schedule` page started its life as a fixed-order list (proper enviament ASC). Users now want to ask different questions of the same data: «quins han fallat recentment?», «quins tenen un nom estrany?», «què s'envia primer?». This task makes every meaningful column sortable, surfaces the timestamp of the last run alongside the status, and removes the now-misleading subtitle that claimed a single ordering.

  - [x] 9.1 User decisions resolved 2026-05-16:
    - **Sort key for "Última run"** = the moment of the last run (DESC default → most recent first). `Mai executat` rows always at the end regardless of direction.
    - **Last-run cell format** = two-line, mirroring "Proper enviament": status + icon on top, then «fa Xh · HH:MM ds DD/MM» Catalunya time below.
    - **Persistence** = none. Each visit starts at the default (proper enviament ASC).
  - [x] 9.2 New helper `relativeFromPast(date, now?)` in `lib/cron.ts` (past-tense mirror of `relativeFromNow`). Returns «ara mateix», «fa Xm», «fa Xh», «fa Xd» depending on magnitude.
  - [x] 9.3 New client component `app/schedule/ScheduleTable.tsx`. The server `page.tsx` still owns the data fetch (one `getBriefListWithRuns()` call, same lib the sidebar uses) and passes the rows down to the client table for rendering + sort.
  - [x] 9.4 Three sortable columns via `<SortableHeader>` buttons in the table head:
    - **Brief** — alphabetical, locale `ca`. Default direction ASC.
    - **Proper enviament** — by next-fire timestamp. Default ASC.
    - **Última run** — by last-run timestamp. Default DESC.
    - Schedule (the humanised cron) is not sortable.
    Active column shows a chevron (`ChevronUp` / `ChevronDown` from lucide) inline with the label. Inactive columns reserve the same chevron slot at `opacity-0` so widths don't shift when sort changes.
  - [x] 9.5 Sort algorithm partitions rows into "has sort value" + "doesn't" and always sinks the latter to the bottom regardless of direction. Tiebreak inside each partition is alphabetical by name. This keeps `Mai executat` (no last-run timestamp) and briefs with invalid crons (no next-fire) at the bottom, where the user expects them.
  - [x] 9.6 Last-run cell expanded to two-line shape: top line is `✓ Èxit` / `✗ Error` (or `Mai executat`); bottom line is «fa Xh · HH:MM ds DD/MM» in `text-[11px] font-mono text-zinc-500`. Never-run rows show only the top line.
  - [x] 9.7 Subtitle «Briefs ordenats pel proper enviament (en horari de Catalunya).» removed — no longer accurate once the user can resort. TZ context stays implicit via the timestamps' format helper.


- [x] **12.0 Brief output history — UI surfacing** ✅ (closed 2026-05-16, merged via PR #48)

  Task 10.0 captured every successful GROQ output and exposed up to 3 entries per brief via `/api/briefs/[name]/outputs`. This task is the UI half: a global `/history` page that groups outputs by brief with expand-to-see-older-runs, a per-brief drawer at the brief detail level, and a shared markdown renderer. Closes the loop on the original motivation — a single pane of glass for past brief outputs without channel-hopping in Slack. Independent from any other deferred task; depends only on the already-shipped 10.0 backend.

  User decisions captured up front (2026-05-16): chrome label «History» (Q1.A); per-brief surface is a right-sliding drawer not a separate page (Q2.C); briefs without captured outputs land at the bottom with a placeholder (Q3.C); ordering is grouped-by-brief, not chronological (R3 confirmed); deleted / renamed briefs are filtered out (R4 confirmed); `react-markdown` is accepted as a new dependency (R2 confirmed); bulk endpoint is required for the global page (R1 confirmed).

  - [x] 12.1 Added `react-markdown ^10.1.0` + `remark-gfm ^4.0.1` (GFM covers tables / task lists / strikethrough that GROQ occasionally emits). No `rehype-raw` — sanitisation defaults stay on so raw HTML inside captured markdown is escaped.
  - [x] 12.2 Implemented `fetchAllRecentBriefOutputs(slugs, limit = 3)` in `web/lib/outputs.ts`. ONE `listArtifacts()` call, then walks candidate artifacts DESC by `created_at` and extracts every `<slug>.brief.md` matching the requested slug set from each downloaded zip. Stops only when every requested slug has hit `limit` OR candidates are exhausted. A `runs-due-*` zip bundling N briefs' runs is now downloaded ONCE and split across the relevant slugs.
  - [x] 12.3 Implemented `GET /api/briefs/outputs/all` at `web/app/api/briefs/outputs/all/route.ts`. Accepts `?slugs=a,b,c`. Returns `{ outputs: Record<slug, BriefOutput[]> }`; slugs without any captured output are omitted from the map. 5-min in-memory cache keyed by the SORTED slug list (so different brief sets don't collide). `?force=true` busts. 502 with the upstream message on Mode / GitHub failure. Empty slug list short-circuits with an empty response.
  - [x] 12.4 Implemented `app/history/page.tsx` as a server component. Calls `getBriefList()` + `fetchAllRecentBriefOutputs()` directly (no self-HTTP). Partitions briefs into WITH outputs (sorted DESC by latest output's `created_at`) and WITHOUT (sorted alphabetically). Suspense fallback is a custom Skeleton card grid; error state is a friendly amber card with the upstream message.
  - [x] 12.5 Implemented `web/components/HistoryFeed.tsx` (client) with `<HistoryCard>`, `<HistoryEntry>`, `<EmptyHistoryRow>`. Latest output always visible inside the card; the inline "Veure N runs anteriors" / "Amaga N runs anteriors" button at the bottom of the card toggles the older entries (UX deviation from "click header to expand": the bottom button is more discoverable on a content-heavy card and keeps the latest output's header purely informational). Older entries render with a lighter background and extra left padding so the temporal hierarchy is obvious. Briefs without outputs render under a small uppercase divider «Sense output capturat encara».
  - [x] 12.6 Updated `SidebarNav.tsx` with a new "History" entry below "Schedule" using the lucide `History` icon, active highlight when `pathname === "/history"`. `SidebarSkeleton.tsx` grew to four placeholder rows so the loading state stays stable.
  - [x] 12.7 Implemented shared `web/components/BriefMarkdown.tsx` wrapping `react-markdown` with `remark-gfm` and a hand-rolled `[&_h1]: / [&_p]: / ...` style configuration tuned for both the global page and the drawer. One module to evolve typography for both surfaces. Default sanitisation; no `rehype-raw`.
  - [x] 12.8 Implemented `web/components/HistoryDrawerButton.tsx` and mounted it in the brief detail's title-row toolbar to the LEFT of `<RunNowButton>`. Uses the shadcn `Sheet` primitive (added via `npx shadcn add sheet`) with `side="right"` and `sm:max-w-xl`. Fetches `/api/briefs/[name]/outputs` on first open (single-brief endpoint — bulk not needed here). Loading skeleton during fetch; error state with a Retry button that force-refetches. The brief detail page stays mounted behind the drawer so closing returns the user to the exact scroll position + any in-flight form state.
  - [x] 12.9 Smoke test on Vercel preview by user 2026-05-16. All 7 checklist points passed: sidebar shows 4 entries with active highlight; `/history` lists briefs in the expected order with latest output visible per card; expander reveals older runs cleanly; markdown renders cleanly; briefs without outputs at the bottom under the placeholder divider; per-brief drawer slides in from the right with outputs expanded; closing the drawer preserves underlying state.

- [ ] **13.0 Authentication & access wall** (new, added 2026-05-16, future capability — implementation deferred)

  Retire the «openly accessible» stance (Non-Goal §5 #1, now superseded) with the thinnest possible AUTH layer: magic-link login via Resend, domain-restricted to `@cooltra.com` / `@felyx.com`, JWT-only sessions (no DB) with a 30-day sliding lifetime. Once inside, every authenticated user still sees and edits every brief — `owner_email` is populated server-side from the session but does NOT gate any UI action; the field is captured so a future per-user iteration can introduce «My briefs» filters without a schema break. Audit trail lives in `git log` only (commit message format `Create/Update/Delete brief: <slug> (by <user-email>)`). Cost: 0 € (Auth.js v5 free, Resend free tier 3 000 mails/month is ~3 orders of magnitude over the actual Cooltra usage, no DB, no Redis).

  User decisions resolved 2026-05-16 via `create-prd` Q&A:
  - **Identity provider** = magic link via email (Resend) — no IdP lock-in.
  - **Auth model** = access wall ONLY. Ownership is decorative.
  - **Migration** = bulk-assign every existing brief to `oriol@cooltra.com`.
  - **Audience** = `@cooltra.com` OR `@felyx.com` only.
  - **Audit trail** = commit messages only, NO `last_edited_by` on the YAML.
  - **Session** = 30-day sliding JWT cookie.

  - [ ] 13.1 **User action (cannot be coded)**: sign up to Resend with a Cooltra-owned email (free tier, 3 000 mails/month). Verify a sender domain (e.g. `reporting@cooltra.com`) by adding the SPF and DKIM DNS records Resend prescribes to Cooltra's DNS console. Wait for green/verified state (usually <10 min after DNS propagates). Copy the API key — needed for 13.2. Estimated effort: 30 min including the round-trip to whoever owns the cooltra.com DNS panel.

  - [ ] 13.2 **User action (cannot be coded)**: add 4 env vars to Vercel (Production + Preview, encrypted):
    - `AUTH_SECRET` — random 32+ bytes, generate with `openssl rand -base64 32`. Used by Auth.js to sign JWTs.
    - `AUTH_RESEND_KEY` — the Resend API key from 13.1.
    - `AUTH_RESEND_FROM` — the verified sender address from 13.1 (e.g. `Cooltra Reporting <reporting@cooltra.com>`).
    - `AUTH_ALLOWED_DOMAINS` — CSV `cooltra.com,felyx.com`. Read by `assertEmailAllowed()` at the auth callbacks.
    Until these exist, `/api/auth/*` will surface a 500 with "missing AUTH_SECRET" on first hit.

  - [ ] 13.3 Add the AUTH dependencies inside `web/`: `npm install next-auth@beta resend`. Auth.js v5 is in beta at time of writing — pin the resolved minor version into `package.json` so future `npm install`s don't drift. `resend` ships the SDK used by Auth.js's Email provider transport (no need for a separate nodemailer setup).

  - [ ] 13.4 Implement `web/lib/auth.ts` exporting `{ auth, handlers, signIn, signOut }` from `NextAuth({...})`. Components:
    - `providers: [Resend({ from: process.env.AUTH_RESEND_FROM!, apiKey: process.env.AUTH_RESEND_KEY! })]`
    - `session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 }` (30-day max, refreshes once a day so 30 days is sliding-from-last-activity)
    - `pages: { signIn: "/sign-in", verifyRequest: "/sign-in?check-email=1", error: "/sign-in?error=1" }`
    - `callbacks.signIn({ user })` → calls `assertEmailAllowed(user.email)` and returns `false` if the domain is not allowed (rejects the magic-link request before Resend sends anything).
    - `callbacks.jwt({ token, user })` and `callbacks.session({ session, token })` → re-run `assertEmailAllowed` (defence in depth: rejects a link that was issued before the domain list tightened).
    - **Shared util `assertEmailAllowed(email)`**: lives in the same file (small enough; no need for a separate module). Reads `process.env.AUTH_ALLOWED_DOMAINS` (CSV), splits, trims, lowercases, returns `true` only when `email.split("@")[1]?.toLowerCase()` is in the set. Throws when the env var is missing (so we never silently accept everyone).

  - [ ] 13.5 Implement `web/app/api/auth/[...nextauth]/route.ts` re-exporting the handlers:
    ```ts
    export { GET, POST } from "@/lib/auth";
    ```
    (Auth.js v5 exposes `handlers.GET` and `handlers.POST` directly; the named re-export is the App Router convention.)

  - [ ] 13.6 Implement `web/proxy.ts` (the Next.js 16 rename of `middleware.ts` — see task 1.1 note). Re-exports the `auth` middleware from `lib/auth.ts`:
    ```ts
    export { auth as default } from "@/lib/auth";
    export const config = {
      matcher: ["/((?!api/auth|sign-in|_next/static|_next/image|favicon.ico).*)"],
    };
    ```
    Auth.js v5's `auth` export doubles as a Next.js middleware: it redirects unauthenticated requests to the configured `pages.signIn` and adds the session to subsequent handlers via `req.auth`. The matcher exempts the auth callbacks, the sign-in page itself, and Next's static asset routes.

  - [ ] 13.7 Implement `web/app/sign-in/page.tsx`. Server component reading `searchParams` to decide which state to render:
    - **Default**: centered card with an `<Input type="email">` + Submit button. Chrome English («Sign in», «Email», «Send sign-in link»). Narrative Catalan below the input («T'enviarem un link al teu correu per iniciar sessió. Cal un compte @cooltra.com o @felyx.com.»). The form action is a server action calling `signIn("resend", { email, redirectTo: searchParams.callbackUrl ?? "/" })`.
    - `?check-email=1` → renders a success state: «Revisa el teu correu — t'hem enviat un link per iniciar sessió. Caduca en 10 minuts.» + a small «Send again» link that triggers a fresh request.
    - `?error=1` (or `?error=Verification` / `?error=AccessDenied`) → renders an amber Alert mapping the Auth.js error code to a friendly Catalan message: AccessDenied → «Aquest email no està autoritzat — utilitza un compte @cooltra.com o @felyx.com.»; Verification → «El link ha caducat o ja s'ha utilitzat. Demana'n un de nou.»; default → «Hi ha hagut un error inesperat. Torna a provar.»
    - The page does NOT show the existing sidebar/footer (no session yet). Uses a minimal layout — either its own `app/sign-in/layout.tsx` OR an early return path inside the root layout.

  - [ ] 13.8 Implement `web/components/SessionFooter.tsx` (client) and mount it in `web/app/layout.tsx` immediately above the existing `<Footer>` in the sidebar's bottom pinned area. Receives `email` as a prop (the root layout reads it server-side via `await auth()` and passes it down). Renders two lines in `text-[11px] text-zinc-400`:
    ```
    <truncated email>
    Sign out
    ```
    Where «Sign out» is a `<button>` calling `signOut({ callbackUrl: "/sign-in" })`. The email truncates with `truncate` + a `title` attribute for the full value on hover. When `email` is undefined (e.g. the layout decided to render the sign-in shell despite the proxy normally preventing this), the component renders nothing.

  - [ ] 13.9 Add `await auth()` + 401 gating to every `/api/*` route handler EXCEPT the auth callbacks. A small helper `web/lib/auth-guard.ts:requireSession()` returns the session or `throw new Response("Unauthorized", { status: 401 })` so the call site is one line: `const session = await requireSession();`. Files to update: `app/api/briefs/route.ts`, `app/api/briefs/[name]/route.ts`, `app/api/briefs/[name]/run/route.ts`, `app/api/briefs/[name]/outputs/route.ts`, `app/api/briefs/outputs/all/route.ts`, `app/api/channels/route.ts`, `app/api/runs/[brief]/route.ts`, `app/api/mode/space-catalog/route.ts`, `app/api/version/route.ts`. The proxy already redirects browser routes to `/sign-in`; this layer covers programmatic API access (curl, scripts, fetch from outside the app shell).

  - [ ] 13.10 Schema + serializer update for `owner_email`:
    - `web/lib/schemas.ts`: extend `briefSchema` with `owner_email: z.string().email().nullable().optional()`. Keep it OPTIONAL (not required) so unmigrated YAMLs round-trip without schema errors during the migration window.
    - `web/lib/yaml.ts:parseBrief`: read `owner_email` if present, default to `null`. `serializeBrief`: emit the key only when the value is a non-empty string (mirrors the pattern from `reference_link` — null/empty values are dropped from the YAML output to keep the file clean).
    - `EMPTY_BRIEF` default: `owner_email: null` (will be overridden server-side by the POST handler from the session — see 13.11).

  - [ ] 13.11 Mutation endpoints capture `session.user.email`:
    - **`POST /api/briefs`**: after `requireSession()`, set `brief.owner_email = session.user.email` BEFORE the zod parse + `serializeBrief` call. The commit message becomes `Create brief: <slug> (by <user-email>)`.
    - **`PUT /api/briefs/[name]`**: PRESERVE the existing `owner_email` from the on-disk brief (read via `readBrief`) — do NOT overwrite from the session even though the editor is authenticated. The owner does not change just because someone else edited the YAML. Commit message: `Update brief: <slug> (by <user-email>)`.
    - **`DELETE /api/briefs/[name]`**: no payload to mutate; just append the user to the commit message: `Delete brief: <slug> (by <user-email>)`.
    - Extract the commit-message builder to a small helper `web/lib/github.ts:commitMessage(action, slug, userEmail)` so the format stays consistent across the three sites. Today's `writeBrief` / `deleteBrief` already accept a message string — pass through.

  - [ ] 13.12 **Bulk migration commit**: a one-time script-or-PR that adds `owner_email: oriol@cooltra.com` to every YAML in `briefs/`. Two options for the implementer:
    - **(a) Manual edit + single commit** (simpler given the current brief count — ≤5 YAMLs). Edit each file directly, commit as «chore: bulk-assign owner_email to oriol@cooltra.com for existing briefs (auth rollout)».
    - **(b) Throwaway script `scripts/migrate_owner_email.py`** that walks `briefs/*.yml`, parses with `pyyaml`, sets the key idempotently, writes back. Useful only if the brief count grows before 13.0 lands.
    Whichever path: the commit MUST land BEFORE the AUTH switch is flipped in production (so no brief is post-rollout-orphan). Verify by running `grep -L "owner_email:" briefs/*.yml` after the migration — expect zero output.

  - [ ] 13.13 Smoke test on Vercel preview (deploys automatically when the feature branch pushes). Checklist:
    1. Un-logged hit on `/` redirects to `/sign-in` (browser network tab should show 307).
    2. Un-logged `curl /api/briefs` returns 401 with no body leak.
    3. Submitting a `@gmail.com` address on `/sign-in` shows the AccessDenied message and the Resend dashboard records ZERO mail send (defence in depth verified: the rejection happens before the provider is even contacted).
    4. Submitting a `@cooltra.com` address lands the magic-link in the inbox within ~10 seconds; clicking it redirects to `/` and the sidebar SessionFooter shows the logged-in email + Sign out.
    5. Repeat (4) with `@felyx.com` — same outcome (verifies the second allowed domain works).
    6. Forwarding the `@cooltra.com` magic-link to a `@gmail.com` inbox and clicking from there is REJECTED (verifies the second-pass domain check at the jwt callback).
    7. Editing a brief on the preview branch lands a commit on the branch with «(by <my-email>)» in the message — verify via the GitHub Actions / commits UI on the PR.
    8. Creating a new brief on the preview branch results in a YAML with `owner_email: <my-email>` and the create-commit «(by <my-email>)».
    9. Editing an existing brief PRESERVES the original `owner_email` (it is NOT rewritten to the editor's email).
    10. Run Now still dispatches the workflow successfully and the resulting GitHub Actions run is visible.
    11. Sign out lands the browser back at `/sign-in` and the session cookie is cleared (verify via DevTools → Application → Cookies).
    12. Wait ~1 day, return to the app — session still valid (verifies sliding-30d works through the daily updateAge tick).

- [x] **14.0 Scheduler reliability via Vercel Cron** ✅ — PRD §4 «Scheduler reliability via Vercel Cron» + §7 «Scheduler reliability via Vercel Cron». Branch `feature/14.0-vercel-cron-scheduler`. Single-PR atomic cutover: ship the new endpoint AND retire the old GH Actions scheduler in the same commit set, since running both in parallel would publish briefs twice. **Decision summary (2026-05-17)**: Vercel Pro confirmed → `*/5 * * * *` cron with strict 5-min window (`<`, not `<=`); JSON response + structured `console.log` for observability; rollback via PR revert. **Shipped 2026-05-17**: 14.1-14.7 (code) + 14.9 (POST→GET hotfix) + 14.8 (post-merge sidebar capture) all complete; CRON_SECRET rotated post-verification.

  - [x] 14.1 Add `vercel.json` at the **`web/`** directory root (NOT the repo root — task 1.5 set the Vercel Root Directory to `web`). Content:
    ```json
    {
      "crons": [
        { "path": "/api/scheduler/tick", "schedule": "*/5 * * * *" }
      ]
    }
    ```
    Vercel ignores `vercel.json` at locations other than the Root Directory, so the path matters. Schedule is UTC (Vercel does not accept a TZ flag); the endpoint converts to `Europe/Madrid` internally.

  - [x] 14.2 Generate `CRON_SECRET` and register it in Vercel env vars (Production + Preview, encrypted). Operator: `openssl rand -hex 32`. The secret never enters the repo. Document in the README's env-var section alongside `GITHUB_TOKEN`, `SLACK_BOT_TOKEN`.

  - [x] 14.3 Implement `web/lib/scheduler.ts`:
    - Export `WINDOW_MS = 5 * 60 * 1000` (300 000).
    - Export `isDue(schedule: string, now: Date, windowMs: number = WINDOW_MS): boolean`. Implementation: `CronExpressionParser.parse(schedule, { currentDate: now, tz: "Europe/Madrid" })`, call `.prev()`, compute `now.getTime() - prev.toDate().getTime() < windowMs`. Strict `<` bound (decision B, 2026-05-17). Catch parse errors and return `false` after logging — invalid cron strings should not crash the whole scan.
    - Re-export `TIMEZONE` from `web/lib/cron.ts` so consumers don't import both files (single source of truth for the TZ constant).

  - [x] 14.4 Implement `web/app/api/scheduler/tick/route.ts`:
    ```ts
    import "server-only";
    import { NextRequest, NextResponse } from "next/server";
    import { listBriefs, readBrief } from "@/lib/github";
    import { parseBrief } from "@/lib/yaml";
    import { isDue } from "@/lib/scheduler";
    import { dispatchBriefRun } from "@/lib/dispatch";

    export const runtime = "nodejs";
    export const dynamic = "force-dynamic";
    ```
    - `POST` handler: read `Authorization` header, compare against `process.env.CRON_SECRET` constant-time (`crypto.timingSafeEqual`). 401 with empty body on mismatch.
    - Enumerate briefs via `listBriefs()` → for each, `readBrief()` + `parseBrief()`. Skip briefs that fail to parse (log + continue — same pattern as `GET /api/briefs` today).
    - For each parsed brief, evaluate `isDue(brief.schedule, now)`. Collect the `due` set.
    - For each `due` brief, await `dispatchBriefRun(brief.slug)`. Collect `dispatched` (status === "ok") and `failures` (status === "error", capture `{ brief: slug, message }`).
    - Emit `console.log(JSON.stringify({ event: "scheduler.tick", scanned, due, dispatched, failures, took_ms }))` before returning.
    - Respond 200 with `{ scanned, due, dispatched, failures }` (JSON). Even when `failures.length > 0` — the tick itself succeeded, individual dispatch failures are surfaced in the body. Decision D, 2026-05-17.

  - [x] 14.5 Delete `.github/workflows/run-due-briefs.yml`. Delete `scripts/due_runner.py`. Keep `run-brief.yml` and `scripts/executor.py` exactly as they are — those remain the per-brief dispatch path that the new endpoint calls via `dispatchBriefRun`. Decision C, 2026-05-17 (same-PR atomic cutover).

  - [x] 14.6 Update `README.md`:
    - Repository Layout section: remove the `due_runner.py` and `run-due-briefs.yml` lines.
    - Replace the «A scheduled GitHub Actions workflow scans the briefs every 15 minutes» sentence with «A Vercel Cron tick every 5 minutes calls the web app's `/api/scheduler/tick` endpoint, which dispatches the due briefs via `run-brief.yml`.»
    - Roadmap section: append `14.0 ✅ Scheduler reliability via Vercel Cron — replaces the GH Actions scanner.` (mark ✅ at completion).
    - Env-vars list: document `CRON_SECRET` alongside the existing entries.

  - [x] 14.7 Smoke test on Vercel preview deployment (decision 2.A, 2026-05-17). Vercel Cron does NOT fire on previews, so this validates the endpoint logic only — the cron→endpoint wiring is validated post-merge against production. **Verified 2026-05-17 against preview `reporting-mode-pkf7dhdkt`**: Test 1 (Authorization: Bearer $CRON_SECRET) → HTTP 200 + `{"scanned":7,"due":[],"dispatched":[],"failures":[]}`; Test 2 (no header) → HTTP 401 empty body; Test 3 (wrong secret) → HTTP 401 empty body; Vercel Function Logs surface a single `{"event":"scheduler.tick","scanned":7,"due":0,"dispatched":0,"failures":0,"took_ms":570}` line per invocation. Subtests 3/6 (force-due brief, simulated dispatch failure) were skipped — the response-shape evidence above is sufficient given the implementation reuses the existing `dispatchBriefRun()` already exercised by Run Now (task 6.0).
    - **⚠️ Gap detected post-merge (2026-05-17, ~10h after PR #54 went live)**: this validation used `POST` to match the handler signature shipped in 14.4, but Vercel Cron actually issues every cron invocation as **`GET`**. In production every tick rebounded with HTTP 405 BEFORE reaching the authorize() check, so no brief was dispatched between the merge and the fix landing several hours later. The smoke test methodology should have been `curl -X GET …` (matching Vercel's actual cron behaviour) rather than `-X POST` (matching our handler signature). For task 14.0's purposes the validation gap is closed by 14.9 below; for future cron-related work the lesson is to confirm Vercel's documented HTTP method BEFORE writing the handler signature, not after.

  - [x] 14.8 Post-merge verification on production (decision 1.C, 2026-05-17): over the following 24h, capture the sidebar at each scheduled tick boundary (top of hour + :15 + :30 + :45) and confirm that briefs scheduled at those minutes arrive in Slack within their scheduled hour. Compare against the pre-fix table (PRD §4 «The problem» — `:15` was at "fa 6h", `:30` at "fa 5h"). Acceptance: every minute-precise schedule reports «captured fa < 1h» consistently. If the post-merge sidebar still shows multi-hour delays, follow the rollback path (PR revert) and re-investigate. **Timeline note**: PR #54 merged 2026-05-17 ~02:00 Catalunya but the scheduler was effectively dead until PR #57 landed at 11:55 Catalunya (see 14.9). The 24h window for 14.8 acceptance therefore starts from 11:55, not from the original cutover. First evidence of correct behaviour: log line `{"event":"scheduler.tick","scanned":7,...}` returning HTTP 200 at 11:55:07, after a streak of HTTP 405s every 5 min. **Verified 2026-05-17 mid-afternoon**: `/schedule` table shows every brief at «fa Xm» (minutes, never hours): `0 * * * *` briefs at «fa 47m» from the 12:01 fire, `15 * * * *` at «fa 32m» from 12:15, `30 * * * *` at «fa 17m» from 12:30, `45 * * * *` at «fa 2m» from 12:45. All «Èxit». Acceptance criterion met; the multi-hour latency that triggered task 14.0 is gone.

  - [x] 14.9 **Bug fix — Vercel Cron uses GET, handler exported POST** (PR #57, commit `90f57ac`, merged 2026-05-17 ~11:50 Catalunya):
    - **Symptom**: from the 14.0 cutover (PR #54 merged ~02:00) through ~11:50 the scheduler dispatched zero briefs. Vercel Cron Jobs panel showed the cron as Enabled and firing every 5 min; Vercel Function Logs showed a `GET /api/scheduler/tick → 405` line every 5 min. No `scheduler.tick` structured-log entry was emitted because Next.js short-circuited with 405 before reaching the handler body.
    - **Root cause**: `web/app/api/scheduler/tick/route.ts` exported `POST` only. Vercel Cron documented behaviour is to issue **GET** requests; the method is not configurable per cron entry. Next.js App Router strictly enforces HTTP method on route handlers, so the unmatched method returns 405 from the framework layer, never invoking my code.
    - **Detection**: user (Oriol) noticed in the morning that overnight no brief had hit Slack despite every brief being a `MM * * * *` once-per-hour cron. Sidebar showed multi-hour latencies again, identical to the pre-fix table. Three Vercel screen captures (Logs filtered to `/api/scheduler/tick`, Deployments list, Cron Jobs panel) confirmed: cron registered, cron firing, every fire 405.
    - **Fix**: one-line change — `export async function POST` → `export async function GET`. Auth flow, scanner logic, response shape, and structured logging are all unchanged because Vercel injects `Authorization: Bearer $CRON_SECRET` on both methods. Diff is 1 insertion / 1 deletion in `route.ts`.
    - **Why the preview smoke test missed it**: 14.7's `curl` calls used `-X POST` because that's what the handler exported. A POST-only handler accepting POST is consistent with itself — the test never exercised the GET path Vercel Cron actually uses. Vercel Cron does not fire on preview deployments (limitation called out in 14.7), so the only path to catch this pre-merge would have been a manual `curl -X GET` on the preview. That's the methodology fix for future cron work.
    - **Recovery verification (immediate)**: at 11:55:07 the first post-fix tick logged `{"event":"scheduler.tick","scanned":7,"due":...}` with HTTP 200. The cron entry was unchanged across all deploys since PR #54 because no PR touched `web/vercel.json` — Vercel reuses the cron config from the current production deploy's `vercel.json` automatically.
    - **Documentation impact**: PRD §4 S1 and §7 «Method: `POST`» realigned to GET in the same commit that closed 14.8 — see commit message for the docs touch-up.

- [x] **15.0 Sidebar brief actions menu (kebab)** ✅ — PRD §4 «Sidebar brief actions menu» + §7 «Sidebar brief actions menu». Branch `feature/sidebar-brief-kebab-menu`. UX decisions recorded with user 2026-05-17: 1.A Edit pre-activated via query param, 2.A Run Now shares cooldown with header (localStorage + custom event), 3.A History auto-opens drawer via query param, 4.B kebab hidden until row hover. **Shipped 2026-05-17** via PR #58 (initial feature) + PR #60 (`preventDefault` fix for the Radix `asChild` trigger that was silently swallowing the popover-open click — caught only after merge when the user reported the kebab visible-but-unresponsive). Smoke test on production confirmed Edit / Run Now / History all wired correctly.

  - [x] 15.1 Extract a shared `useRunNow(filename)` hook to `web/hooks/useRunNow.ts` from the existing inline logic in `RunNowButton.tsx`. Persistence key (`runnow:<filename>`) and cooldown duration (2 min) carry over unchanged so existing user state survives the refactor. Add a `runnow:dispatched` window CustomEvent + listener so two consumers in the same tab stay in sync (cross-tab was already implicit via `storage` events).
  - [x] 15.2 Refactor `RunNowButton.tsx` to call the new hook. Public API of the component is unchanged (`<RunNowButton mode="existing" filename={...} />` and `<RunNowButton mode="create" />` still work). Removed local `useState`/`useEffect` blocks moved into the hook; the component is now a thin label-formatter on top of the shared state.
  - [x] 15.3 New `web/components/BriefRowMenu.tsx`: client component, accepts `{ filename }`, renders the kebab trigger + Popover with three actions (Edit `<Link href={`/briefs/<filename>?edit=1`}>`, Run Now via `useRunNow().dispatch`, History `<Link href={`/briefs/<filename>?history=1`}>`). Kebab uses `opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100` for the hover-only visibility (decision 4.B). Click on the kebab calls `e.preventDefault(); e.stopPropagation()` so it doesn't bubble to the parent row's `<Link>`.
  - [x] 15.4 Update `BriefSidebarList.tsx`: switch the row from a single wrapping `<Link>` to a `<div className="group relative">` containing the `<Link>` (with `pr-9` to reserve space for the kebab) and an absolutely-positioned `<BriefRowMenu>`. Tooltip on truncated names continues to wrap only the `<Link>`, not the kebab.
  - [x] 15.5 Plumb the query params through to the detail page. `web/app/briefs/[name]/page.tsx` accepts `searchParams: Promise<{ edit?: string; history?: string }>`, reads `edit === "1"` and `history === "1"`, passes `initialMode="edit"` (or undefined) to `<BriefForm>` and `initialOpen={true}` (or undefined) to `<HistoryDrawerButton>`. The page is backwards-compatible for direct navigation without params.
  - [x] 15.6 `BriefForm` accepts a new optional `initialMode?: FormMode` prop. State init becomes `useState<FormMode>(isCreate ? "edit" : (props.initialMode ?? "view"))`. `HistoryDrawerButton` accepts a new optional `initialOpen?: boolean` prop. State init becomes `useState(initialOpen)` and a `useEffect` (empty-deps) fires the outputs fetch on mount when `initialOpen` is true (otherwise the drawer opens visibly empty for a beat before the click handler kicks in the load).
  - [x] 15.7 Smoke test on Vercel preview (the convention's standard MVP gate, no automated tests). Initial validation on the preview surfaced the `preventDefault()` bug on the kebab's `PopoverTrigger asChild` — the menu was visible-but-unresponsive because Radix's `composeEventHandlers` short-circuits its own open handler when the child's onClick calls `preventDefault()`. Fix shipped in PR #60. Production verification after the fix landed: kebab opens on click, Edit lands on `?edit=1` with the form in edit mode, History opens the drawer on `?history=1`, Run Now from the kebab shares the header button's cooldown. Hover/focus visibility unchanged from the preview-stage observations.

- [x] **16.0 Publish / Unpublish brief** — PRD §4 «Publish / Unpublish brief» + §7 «Publish / Unpublish brief». Branch `feature/16.0-publish-unpublish` (already created). Decisions recorded with user 2026-05-17: 1.A priority before Mode data preview (task 17.0), 2.B new briefs default to Draft, 3.C Run Now asks confirmation when brief is Draft, 4.A+B+D three UI surfaces (sidebar opacity+chip, /schedule draft-styled rows, detail page prominent toggle). **Migration** (sub-task 16.2) MUST land in the same PR as the schema change — landing the schema without the migration would leave existing briefs without an explicit `published` field, and a tolerant `parseBrief` default of `true` is the only safety net during the brief window. **Operator action**: none required in this task — no new env var, no new shadcn primitive beyond `switch` which the implementer installs.

  - [x] 16.1 Schema + serializer changes to introduce the `published` field.
    - `web/lib/schemas.ts`: extend `briefSchema` with `published: z.boolean()`. **No `.default(true)` on the zod schema** — RHF input/output types diverge when zod adds defaults and the existing form code reads `published` directly. The default-true tolerance lives in `parseBrief` (next bullet), not zod.
    - `web/lib/yaml.ts:parseBrief`: when the parsed YAML lacks `published` (or it's not a boolean), normalise to `true`. Legacy briefs without the field round-trip cleanly even before the migration commit (16.2) lands.
    - `web/lib/yaml.ts:serializeBrief`: emit `published: <bool>` explicitly in every YAML, never omit. Insert the key into the canonical `EMITTED_KEYS` order **immediately after `name`** so the field is the first thing the human reader sees.
    - `EMPTY_BRIEF` (the default used by `/briefs/new`): `published: false`. Drafts-by-default for new briefs (decision 2.B).

  - [x] 16.2 Bulk migration commit: assign `published: true` to every existing brief in `briefs/*.yml`.
    - One-shot script `scripts/add_published_field.py` that walks `briefs/*.yml`, parses with `pyyaml`, sets the key idempotently (only adds when missing, never overwrites), writes back preserving key order via `pyyaml`'s `sort_keys=False`. Run locally with `python scripts/add_published_field.py`.
    - **Delete the script in the same PR** — it's single-use migration code, not operational. The migration is in the git history forever, but the file doesn't stay in the repo.
    - Commit message: «chore(briefs): bulk-assign `published: true` to existing briefs (rollout for task 16.0)».
    - Verification: `grep -L "^published:" briefs/*.yml` returns zero lines. The migration commit lands BEFORE the scheduler filter (16.3) so there's no window where existing briefs read as Draft.

  - [x] 16.3 Scheduler filter + observability update at `web/app/api/scheduler/tick/route.ts`.
    - Add `const candidates = briefs.filter((b) => b.published !== false);` immediately after the `parseBrief` loop and BEFORE the `isDue()` evaluation.
    - Compute `const skipped_draft = briefs.length - candidates.length;`.
    - Extend the JSON response shape to include `skipped_draft` (alongside `scanned`, `due`, `dispatched`, `failures`).
    - Extend the structured `console.log` payload (`event: "scheduler.tick"`) with the same `skipped_draft` field so operators can see draft volume in Vercel Function Logs without parsing YAML.
    - Smoke-test via `curl -H "Authorization: Bearer $CRON_SECRET" https://<preview>.vercel.app/api/scheduler/tick`: expect `skipped_draft` to match the count of `published: false` briefs in the repo at the time of the call (manually count via `grep -c "^published: false" briefs/*.yml`).
    - **No `due_runner.py` change** — that file was deleted in task 14.0; the Python codepath no longer participates in scheduling decisions.

  - [x] 16.4 Install the shadcn `switch` primitive: `cd web && npx shadcn@latest add switch`. Only new shadcn primitive in this task. Verify the install added `web/components/ui/switch.tsx` and updated `components.json`.

  - [x] 16.5 New `web/components/PublishedToggle.tsx` (client component) wrapping the shadcn `<Switch>`.
    - Props: `{ control: Control<BriefForm>, mode: FormMode }` (or accept `{ value, onChange, disabled }` if preferred — the existing components use both styles).
    - Wire via `<Controller>` from RHF: `name="published"`, `render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} disabled={mode === "view"} />}`.
    - Label rendered to the right of the Switch: **«Published»** when on (no special style), **«Draft»** when off (`text-zinc-500`). Both labels in English (chrome). No localised narrative on the toggle itself — the badge in 16.6 carries the at-a-glance signal.
    - Size: matches the existing title-row toolbar buttons (`size="sm"` equivalent — `h-9`, vertically centered).

  - [x] 16.6 New `web/components/PublishedBadge.tsx` (server component, accepts `{ published: boolean }`).
    - `Published` variant: `bg-emerald-50 text-emerald-700 border border-emerald-200`, uppercase text-[10px] font-mono, rounded.
    - `Draft` variant: `bg-zinc-100 text-zinc-600 border border-zinc-200`, same shape.
    - Mounted in `web/app/briefs/[name]/page.tsx`'s title rendering (next to the brief name, before the loaded-at indicator). Server-rendered from the parsed brief so the badge is visible immediately on landing — no client hydration flash. The page already parses the brief; just thread the `published` field through to the title block.
    - **NOT mounted on `/briefs/new`** — there's no saved state to display; the toggle alone carries the meaning at the create stage.

  - [x] 16.7 Mount `<PublishedToggle>` in `BriefForm.tsx`'s title-row toolbar.
    - Position: **immediately to the LEFT of the Run Now button** in both view and edit modes. When Run Now is absent (e.g. on `/briefs/new`), the toggle still renders in the same horizontal slot.
    - In view mode the toggle is read-only (the `disabled={mode === "view"}` from 16.5); a click-and-toggle in view mode does NOT enter edit mode — same UX as clicking other read-only form fields. Users explicitly enter edit mode via the Edit button.
    - In edit mode the toggle is interactive; the new value is part of the RHF form state and ships with Save.
    - On `/briefs/new`, the toggle renders interactive from initial render (the create form is always in edit mode). Initial value comes from `EMPTY_BRIEF.published = false` (set in 16.1).

  - [x] 16.8 Propagate `published` through `web/lib/briefs.ts:getBriefListWithRuns()` so it reaches the sidebar and `/schedule` row builders.
    - Extend `BriefListItem` (defined in `web/lib/schemas.ts`) with `published: boolean`.
    - `getBriefList()` and `getBriefListWithRuns()` already parse each brief; just include `published` in the projected row shape.
    - No new fetch — `published` is in the same YAML body that `parseBrief` already produces.

  - [x] 16.9 New `web/components/DraftChip.tsx` (server component, no props or just `{ className? }` for layout adjustments).
    - Renders the inline chip used by sidebar + `/schedule`: «Draft» in `font-mono text-[10px] text-zinc-500 bg-zinc-100 border border-zinc-200 rounded px-1 py-px`.
    - `shrink-0` baked into the default className so consumers don't have to remember; truncation behaviour around it is the consumer's responsibility (sidebar's `truncate` on the parent works as-is).
    - Pure presentational — no client hooks, no state.

  - [x] 16.10 `BriefSidebarList.tsx`: draft styling.
    - Add conditional `opacity-60` to the row wrapper when `!published` (using the existing `cn(...)` call site for the row).
    - Render `<DraftChip />` inline after the brief name and BEFORE the kebab placeholder, inside the same `<Link>` so the chip respects the row's hit area.
    - Existing tooltip on truncated names continues to wrap only the `<Link>`, not the chip or kebab — no change there.
    - The dot-status (success/failed/never-run) and token badge stay at FULL opacity — they describe the last run, which is meaningful even for drafts. Apply `opacity-60` to the name + chip only, not to those secondary elements.

  - [x] 16.11 `web/app/schedule/page.tsx` / `ScheduleTable`: draft styling.
    - The «Brief» column: same `opacity-60` + `<DraftChip />` treatment as the sidebar (16.10). The link to `/briefs/<filename>` remains clickable at full hit area.
    - The «Proper enviament» column for draft rows: wrap the cell in a shadcn `<Tooltip>` whose body is «Aquest brief està despublicat — el cron no s'aplicarà fins que es publiqui». Cell content stays the same (the computed next-fire time + relative «en Xh») but renders at `opacity-60` to match the visual rhythm.
    - The «Schedule» and «Última run» columns: unchanged styling — same data either way; the user might be referring to «when was this draft last run during testing» which is real information.
    - Sort order unchanged: drafts mix with published in the same alphabetical/chronological partition; no separate «Drafts» section.

  - [x] 16.12 New `web/components/DraftRunConfirmDialog.tsx` (client component) — the shared confirmation dialog used by both Run Now call-sites.
    - shadcn `<Dialog>` (already installed; mounted at root via `TooltipProvider` etc.).
    - Props: `{ open: boolean, onOpenChange: (open: boolean) => void, onConfirm: () => void, briefName?: string }`.
    - Title: «Brief despublicat» (Catalan narrative — this is feedback, not chrome).
    - Body: «Aquest brief està en mode Draft — el cron no l'executa automàticament. Vols executar-lo manualment ara?». If `briefName` is provided, render it bolded in the body for context.
    - Buttons: **«Cancel»** (outline variant, default focus) + **«Run anyway»** (primary). Run anyway calls `onConfirm()` and lets the parent close the dialog via `onOpenChange(false)` so the parent stays in control of subsequent state (cooldown start, toast, etc.).
    - Pressing Escape OR clicking outside dismisses (standard Radix behaviour, equivalent to Cancel — no `onConfirm` fires).

  - [x] 16.13 `RunNowButton.tsx` (header) draft-confirmation wiring.
    - Component accepts a new prop `published?: boolean` (default `true` for backwards-safety: if a caller forgets to pass it, the button behaves as published). The detail-page caller passes the brief's actual `published` value.
    - Local state `[confirmOpen, setConfirmOpen] = useState(false)`.
    - When the user clicks the button: if `published === false`, set `confirmOpen=true` and do NOT dispatch yet. Otherwise, dispatch immediately (today's behaviour).
    - Render `<DraftRunConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={() => { setConfirmOpen(false); dispatch(); }} briefName={...} />` at the bottom of the JSX tree.
    - The 2-minute cooldown applies AFTER the user confirms — the dialog itself is not gated by the cooldown predicate. A second click within the cooldown window returns the existing HTTP 429 toast.

  - [x] 16.14 `BriefRowMenu.tsx` (kebab) draft-confirmation wiring.
    - Same prop addition: `published?: boolean` (default `true`).
    - Sidebar list propagation: `BriefSidebarList.tsx` now receives `published` per row (from 16.8) — pass it down to each `<BriefRowMenu published={...} />`.
    - When the user clicks the «Run Now» menu item: identical logic to 16.13 (open dialog when `!published`, otherwise dispatch). Reuses the same `<DraftRunConfirmDialog>` component.
    - The dialog and the popover MUST coexist visually — the popover closes (Radix standard outside-click on dialog open) and the dialog covers the page. Smoke test that opening the dialog from the kebab doesn't leave a stranded popover open.

  - [ ] 16.15 Smoke test on Vercel preview (the project's standard MVP gate; no automated tests). Checklist:
    1. Create new brief via `/briefs/new`: verify the form initial state shows the toggle OFF (Draft) and the YAML committed contains `published: false`. Cancel the create flow → no commit, no draft saved.
    2. Toggle published ON inside the create flow, Create: verify the YAML contains `published: true` and the page header shows the green Published badge.
    3. Edit an existing brief → toggle Published OFF → Save: verify the YAML now has `published: false`, the sidebar row renders at opacity-60 with the Draft chip, `/schedule` shows the row draft-styled with the Tooltip on the next-fire cell.
    4. Toggle back ON: verify visual state reverses; the scheduler should pick the brief up on the next 5-min tick.
    5. Click Run Now (header) on a draft: dialog appears with title «Brief despublicat», Cancel does nothing (no dispatch, no toast), Run anyway dispatches and the existing success toast / GitHub Actions link surfaces normally.
    6. Open the sidebar kebab on a draft → Run Now: same dialog flow as (5).
    7. Click Run Now on a published brief: NO dialog, direct dispatch (today's behaviour preserved).
    8. Hit `/api/scheduler/tick` via curl with the bearer token: response `skipped_draft` matches the manual count of drafts in `briefs/*.yml`. Vercel Function Logs surface the same number in the structured `console.log` line.
    9. After ~5-10 min of the preview branch existing with at least one draft, verify no Slack post for that draft appears in the test channel even though its cron would have matched.

  - [ ] 16.16 README roadmap + final docs sync.
    - Append to the Roadmap section: «16.0 ✅ Publish/Unpublish briefs — Draft state gates the cron auto-dispatch; new briefs default to Draft; Run Now requires confirmation when dispatching a draft.».
    - Mark every 16.x sub-task `[x]` in this file as it completes; on full ship, change the 16.0 parent task header to `- [x] **16.0 Publish / Unpublish brief** ✅`.
    - **No PRD edits at this stage** — the PRD already reflects the shipped state via the bloc landed in commit `035654c`. If implementation surfaces a deviation from PT1-PT11, document it inline alongside the deviating sub-task and add a «deviation» note to the PRD ribbon as the convention requires (see how task 4.0's 4.11 «post-4.0 polish» block did it).

- [x] **17.0 Mode data preview** — PRD §4 «Mode data preview» + §7 «Mode data preview». Branch `feature/17.0-mode-data-preview` (already created, branched from the PRD-only base so it does not carry task 16.0's code; a post-merge rebase of either branch over the other resolves the TASKS-file ordering trivially). Decisions recorded with user 2026-05-17: 1.A reuse the latest succeeded run (~1-3 s latency, no Mode SQL cost), 2.A Sheet side="right" (matches History drawer rhythm from 12.0 / 15.0), 3.A 10-row preview cap, 4.A 5-min TTL + `?force=true`. **No new env var, no new shadcn primitive** — `Sheet` is already installed since 12.0 and reused here.

  - [x] 17.1 Extend `web/lib/mode.ts` with `listReportRuns(reportToken)` and `findLatestSucceededRun(reportToken)`.
    - `listReportRuns` → `GET /api/${account}/reports/${reportToken}/runs` with the same Basic auth + `Accept: application/hal+json` shape already used by `listSpaceReports` and `listReportQueries`. Response payload: `_embedded.runs[]`, each entry has at least `{ token, state, created_at, completed_at }`. Map and return the minimum we need; sort descending by `completed_at ?? created_at` defensively (Mode docs the field as "approximately ordered" — don't rely on the input order).
    - `findLatestSucceededRun` filters `listReportRuns(reportToken)` for `state === "succeeded"` and returns the first match or `null`. The endpoint distinguishes `null` (→ `kind: "no-previous-run"`) from "runs exist but the newest failed" (→ `kind: "run-failed"`) by also peeking at `runs[0]` when the filter is empty; return shape: `{ latest: ModeRun | null, anyRun: ModeRun | null }` so the caller has both signals.
    - New type `ModeRun` exported alongside `ModeReport` / `ModeQuery` — keep it in `lib/mode-types.ts` next to its siblings.

  - [x] 17.2 Extend `web/lib/mode.ts` with `listQueryRunsForRun(reportToken, runToken)` and `getQueryRunResults(reportToken, runToken, queryRunToken)`.
    - `listQueryRunsForRun` → `GET /api/${account}/reports/${reportToken}/runs/${runToken}/query_runs`. Returns `_embedded.query_runs[]`, each entry `{ token, query_name, state }`. The Python executor's `list_query_runs()` in `scripts/executor.py` hits the same endpoint — the TS port mirrors that contract.
    - `getQueryRunResults` → `GET /api/${account}/reports/${reportToken}/runs/${runToken}/query_runs/${queryRunToken}/results/content.json`. Returns an array of row objects (`Record<string, unknown>[]`) — same payload shape the Python `get_query_results()` returns. Mode caps the JSON response at ~1k rows; the endpoint slices to `limit` after the fetch (no server-side limit param available).
    - Error path: any `!res.ok` throws `new Error("Mode <fn>(<args>) failed: <status> <body>")` — same pattern as the existing `lib/mode.ts` helpers so the route handler can `catch err` and respond 502 uniformly.

  - [x] 17.3 Implement the route handler `web/app/api/mode/preview/[report]/[query]/route.ts` (path params + ?limit + ?force).
    - File header: `import "server-only";`, `export const runtime = "nodejs";`, `export const dynamic = "force-dynamic";`. Same prelude pattern as `/api/scheduler/tick` (14.0) and `/api/runs/[brief]` so the runtime contract is consistent.
    - Path-param signature follows Next 16's async params: `{ params: Promise<{ report: string; query: string }> }`. Read `searchParams` from the request URL for `limit` (default 10, clamped 1-50; non-numeric → 10) and `force` (`=== "true"`).
    - Sanitise the path params: reject empty strings with 400, reject anything outside `[A-Za-z0-9_-]+` with 400 (Mode tokens are stable alphanumeric; this is a cheap defence against path traversal smuggled into `report`/`query` even though the helper paths concatenate them into the Mode URL, not a filesystem path).

  - [x] 17.4 Add the in-memory cache to the preview endpoint (5-min TTL + `?force=true` bust).
    - Module-level `const cache = new Map<string, { fetchedAt: number; data: PreviewResult }>();` + `const TTL_MS = 5 * 60 * 1000;`.
    - Cache key: `` `${report}:${query}:${limit}` `` — different `limit` values are cached independently so `?limit=10` and `?limit=25` don't pollute each other.
    - `?force=true` deletes the entry before the fetch path runs (not after — so even if the upstream call fails, the next un-forced read won't return a stale-but-still-valid entry).
    - Identical pattern to `web/lib/channels.ts` and the cache in `/api/runs/[brief]/route.ts` so future readers can pattern-match without reading three implementations.

  - [x] 17.5 Implement the orchestration inside the preview endpoint: `findLatestSucceededRun` → `listQueryRunsForRun` → `getQueryRunResults` and return the discriminated-union response.
    - Algorithm:
      1. `const { latest, anyRun } = await findLatestSucceededRun(report);`
      2. If `latest === null && anyRun === null` → respond `{ kind: "no-previous-run" }` (HTTP 200).
      3. If `latest === null && anyRun !== null` → respond `{ kind: "run-failed", run: { state: anyRun.state, completed_at: anyRun.completed_at ?? anyRun.created_at } }` (HTTP 200).
      4. Else (`latest !== null`): `const queryRuns = await listQueryRunsForRun(report, latest.token);`
      5. Find `qr = queryRuns.find(q => q.token === query)` — note we match by the Mode **query** token, not by `query_name` (the Python executor uses name for run-time matching because YAMLs pre-2026-05 used query tokens that mapped to names; for preview we have the token directly from the BriefForm — token match is exact and rename-safe).
      6. If `qr === undefined` → respond `{ kind: "query-not-found" }` (HTTP 200).
      7. Else: `const rows = await getQueryRunResults(report, latest.token, qr.token); const total_rows = rows.length; const sliced = rows.slice(0, limit); const columns = sliced.length > 0 ? Object.keys(sliced[0]) : [];` then respond `{ kind: "ready", run: { completed_at: latest.completed_at, state: latest.state }, query: { token: qr.token, name: qr.query_name }, columns, rows: sliced, total_rows }`.
    - Wrap the whole orchestration in `try/catch (err)`. Any throw → HTTP 502 with `{ error: "Mode upstream failure", message: err.message }`. The 502 response is **not cached**; the cache only stores `kind: "ready" | "no-previous-run" | "run-failed" | "query-not-found"` so a transient Mode outage doesn't poison the cache for 5 min.

  - [x] 17.6 Define the `PreviewResult` TypeScript type at the top of the route file (or in a small `lib/preview-types.ts` if the client component also needs it — likely yes, see 17.10).
    - `type PreviewResult = | { kind: "ready"; run: { completed_at: string; state: string }; query: { token: string; name: string }; columns: string[]; rows: Record<string, unknown>[]; total_rows: number } | { kind: "no-previous-run" } | { kind: "run-failed"; run: { state: string; completed_at: string } } | { kind: "query-not-found" };`
    - Export it. Both the server (response) and the client (parsed `await res.json()` casting) consume the same shape.

  - [x] 17.7 Implement the `PreviewTable` presentational component (`web/components/PreviewTable.tsx`).
    - Client component (just because it's mounted inside `PreviewSheet` which is client). Pure render — no fetch, no state.
    - Props: `{ columns: string[]; rows: Record<string, unknown>[]; total_rows: number }`.
    - Layout: a `<div className="min-w-full overflow-x-auto">` wrapping a `<table className="text-sm">`. Columns get a `<th>` each (font-medium, zinc-600, left-aligned). Rows cycle alternating bg (`even:bg-zinc-50/40`) for legibility on wide tables.
    - Cell value rendered via `renderCell(value)` (next sub-task).
    - Footer line below the table: when `total_rows > rows.length`, render `«Showing N of M rows»` in `text-xs text-zinc-500 mt-2`. Otherwise nothing.
    - When `rows.length === 0` (the `0-row` edge case from 17.11 routes through this same component with an empty `rows` array), the component renders the table header row alone + a small `«Cap fila retornada en aquest run»` below (English chrome but Catalan narrative — same idiom the rest of the app follows).

  - [x] 17.8 Implement `renderCell(value: unknown)` inside `PreviewTable` (or extract to `web/lib/previewCell.tsx` if testing seams ever emerge).
    - `null` / `undefined` → `<span className="text-zinc-400">null</span>` (muted, distinct from empty string).
    - `boolean` → the literal `"true"` / `"false"` in font-mono.
    - `number` → toString, right-aligned cell (apply `text-right` on the `<td>` when the column's first non-null value is a number — best-effort column-level alignment from the first row).
    - `string` → as-is; long strings (> 80 chars) truncate with `truncate` + `max-w-xs` + a Tooltip showing the full value on hover. Same truncate idiom as the catalog landing.
    - Nested object / array → `JSON.stringify(value)` rendered inside `<code className="font-mono text-[11px]">`, truncated to 80 chars with the same Tooltip-on-hover pattern.
    - Date-like strings (anything `new Date(value).getTime()` returns a finite number AND the string matches `\d{4}-\d{2}-\d{2}`) → render as-is in font-mono. We don't reformat — Mode's output is already operator-friendly, and reformat would risk surprising the user.
    - All other types → `String(value)` fallback. Don't crash on exotic shapes.

  - [x] 17.9 Implement `PreviewSheet` (`web/components/PreviewSheet.tsx`) — the side-panel container that mounts once at the BriefForm root and consumes a `{ open, reportToken, queryToken }` state slice.
    - Client component. shadcn `Sheet` side="right", `SheetContent` width `sm:max-w-2xl` so 4-6-column tables fit before horizontal scroll kicks in.
    - Props: `{ open: boolean; reportToken: string | null; queryToken: string | null; onClose: () => void; }`. Parent (BriefForm) owns the state; the Sheet is fully controlled.
    - When `open && reportToken && queryToken`, fire a fetch to `/api/mode/preview/${reportToken}/${queryToken}?limit=10` and store the result in local state `{ status: "idle" | "loading" | "ready" | "error"; data?: PreviewResult; error?: string }`. On close (Escape, outside-click, X, or onClose), the parent flips `open=false`; the Sheet stays mounted to keep the closing animation smooth.
    - Header content per the PRD P4: query name (font-medium) + raw token muted underneath (read from `useSpaceCatalog()` — same client cache the comboboxes use; falls back to the raw token if the catalog hasn't resolved). Below: relative-time + Catalunya-time of the last run (when `kind: "ready"`); rows + columns count; Refresh button (lucide `RefreshCw`, ghost xs) that re-fires the fetch with `?force=true`.

  - [x] 17.10 Wire the `useEffect` fetch lifecycle inside `PreviewSheet` with `AbortController` for stale-request invalidation.
    - `useEffect(() => { ... }, [open, reportToken, queryToken])` — keyed so opening, switching queries, or re-opening fires a fresh fetch.
    - Inside the effect: if `!open || !reportToken || !queryToken`, return early. Otherwise create an `AbortController`, set status to `"loading"`, await `fetch(url, { signal: controller.signal })`, parse JSON, set status to `"ready"` with `data`. Catch `AbortError` and bail silently (the user re-clicked Preview on a different query before the previous fetch landed); catch other errors and set status `"error"` with `err.message`.
    - Cleanup function: `controller.abort()` — guarantees the previous fetch's setState calls are no-ops if a new fetch supersedes it.
    - A separate `refresh()` function that triggers the same fetch path with `?force=true` — wired to the header's Refresh button. Implementation: bump a local `refreshCounter` state value, add it to the effect's dep array, append `&force=true` when `refreshCounter > 0`. Avoids duplicating the fetch logic.

  - [x] 17.11 Render the 5 distinct edge-case states inside `PreviewSheet` based on the `PreviewResult` discriminated union.
    - `loading` → centered shadcn skeleton (3-line placeholder) with «Carregant preview…» below in muted text.
    - `kind: "ready"` → the `<PreviewTable>` from 17.7. (When `rows.length === 0`, the table itself renders the empty-state footer per 17.7's contract; no special branch needed here.)
    - `kind: "no-previous-run"` → muted info block: «Cap run previ d'aquest report a Mode. Desa el brief i fes Run Now per disparar el primer fetch.» No error styling — informational.
    - `kind: "run-failed"` → amber Alert: «L'últim run d'aquest report ha fallat (state: <state>). Tria un altre report o investiga a Mode.» Below: an `<a>` link to `https://app.mode.com/${account}/reports/${reportToken}/runs` (account read from a small `lib/mode-public.ts` helper that exposes only the `account` env value — never the token/secret — to the client; confirm shape during implementation). Open in new tab.
    - `kind: "query-not-found"` → muted info block: «Aquesta query no apareix dins de l'últim run del report. Pot ser que s'hagi renombrat o esborrat a Mode.»
    - `error` (the catch path, distinct from `kind: "run-failed"` which is a successful 200 response) → red Alert: «Mode no disponible — torna a provar més tard» + Retry button that calls `refresh()` (which fires `?force=true`).

  - [x] 17.12 Implement `PreviewButton` (`web/components/PreviewButton.tsx`) — the ghost button rendered next to each `QueryCombobox` row.
    - Client component. Props: `{ reportToken: string; queryToken: string; onClick: (report: string, query: string) => void; }`.
    - Layout: `<Button variant="ghost" size="sm">` with lucide `Eye` icon + the English label «Preview data». `disabled` when `!reportToken || !queryToken`.
    - Disabled-state tooltip: wrap in shadcn `Tooltip` rendering «Selecciona report i query abans de fer preview» on hover/focus. Wrap the disabled button in a `<span tabIndex={0}>` so Radix Tooltip receives the hover event even though `pointer-events: none` is on the disabled child — same idiom `RunNowButton` already uses for the create-mode disabled state.
    - Click handler: `() => onClick(reportToken, queryToken)`. The parent (`BriefForm`) maps that to its preview-state setter.

  - [x] 17.13 Plumb `PreviewSheet` state into `BriefForm.tsx` and mount one `PreviewSheet` instance at the form root.
    - New state slice inside `BriefForm`: `const [preview, setPreview] = useState<{ reportToken: string; queryToken: string } | null>(null);`. Single state shared across all query rows so we never paint two Sheets at once.
    - Mount `<PreviewSheet open={preview !== null} reportToken={preview?.reportToken ?? null} queryToken={preview?.queryToken ?? null} onClose={() => setPreview(null)} />` at the bottom of the form's JSX, next to the other top-level dialogs (Delete dialog at line ~872, Cancel-create dialog at line ~904 — pattern is the same).
    - Each query row inside `SourceCard` renders `<PreviewButton reportToken={...} queryToken={...} onClick={(r, q) => setPreview({ reportToken: r, queryToken: q })} />`. The button sits immediately to the right of `<QueryCombobox>` in the query row's flex container. The current `mode_report_token` for the parent source is already in scope via the `Controller` watching `sources.<i>.mode_report_token` — reuse the same `useWatch`.

  - [ ] 17.14 Smoke test on Vercel preview (the project's standard MVP gate; no automated tests). Checklist:
    1. Open an existing brief whose source uses a real Mode report + query (e.g. `app-version-adoption.yml`). Click the new Preview button next to its query. Sheet opens on the right; loading skeleton briefly, then the table appears with ≤ 10 rows.
    2. Verify the Sheet header shows the query's human name (from the catalog) + raw token, the run's relative time («fa Xh») + Catalunya date, and the rows/columns count. Refresh button cycles through the loading state and lands back on the same data within ~2 s (cache busted via `?force=true`).
    3. Close the Sheet (X / Escape / outside-click). Brief form behind is intact (scroll position, edit-mode state).
    4. Open the Preview Sheet for a query in a different source. Verify the Sheet replaces the previous content (single mounted Sheet, not two).
    5. Pick a Mode report token that is real but happens to have no successful runs (or create a temporary YAML pointing to one). Preview → «Cap run previ d'aquest report a Mode...» state renders.
    6. In a brief, change the query token to a non-existent one (free-text path) → Preview → «query-not-found» message renders.
    7. Curl the endpoint directly: `curl https://<preview>.vercel.app/api/mode/preview/<report>/<query>?limit=5` → JSON response with `kind: "ready"` and at most 5 rows. Repeat with `?force=true` and verify the response time on the second call is similar to the first (cache busted), then a third call without `?force` is instant (cache hit).
    8. With the Sheet open, edit the query combobox to a different token in the same row. Click Preview again. Verify the previous in-flight fetch was aborted (no console errors, no flicker of stale data).

  - [ ] 17.15 README roadmap entry + final docs sync.
    - Append to README Roadmap: «17.0 ⏳ Mode data preview — inline «Preview data» button on each BriefForm query row; right-side Sheet shows the last 10 rows of the latest successful Mode run, validating wiring before save.». Mark ✅ at merge time.
    - Mark every 17.x sub-task `[x]` in this file; on full ship, change the 17.0 parent header to `- [x] **17.0 Mode data preview** ✅`.
    - **No PRD edits at this stage** — the PRD already reflects the shipped spec (P1-P11 + §7) via the commits landed during the create-prd round. If implementation surfaces a deviation, document it inline at the deviating sub-task and add a «deviation» ribbon-note to the PRD section per the project convention.
- [x] **18.0 Dry-run output** — PRD §4 «Dry-run output» + §7 «Dry-run output». Branch `feature/18.0-dry-run-output` (already created, branched from the PRD-only base so it does not carry task 16.0 / 17.0 code). The Mode helpers this task needs that are ALSO part of 17.0 (`listQueryRunsForRun`, `getQueryRunResults`, `ModeQueryRun` type) are implemented locally here too — keeping the branches independent. When both PRs land on main, the second-to-merge resolves the helper duplication trivially (the two implementations are intentionally identical). **Operator action**: copy `GROQ_API_KEY` from the GitHub Secrets into the Vercel env-var inventory (Production + Preview, encrypted) before the PR can be smoke-tested.

  - [x] 18.1 Install the GROQ JS SDK: `cd web && npm install groq-sdk`. Adds it to `package.json` dependencies. The SDK mirrors the OpenAI SDK API (`chat.completions.create` with `stream: true` returning an async iterator), already battle-tested by the Python `executor.py` against `llama-3.3-70b-versatile`.

  - [x] 18.2 Extend `web/lib/mode.ts` with the helpers the dry-run pipeline needs that are NOT already in this branch (task 18.0 branched before 17.0 landed). Specifically:
    - `triggerReport(reportToken)` — `POST /api/${account}/reports/${reportToken}/runs`. Mirrors `executor.py:trigger_report`. Returns the new run's token (`{token}` from the response body).
    - `waitForCompletion(reportToken, runToken, opts?)` — polls `GET /api/${account}/reports/${reportToken}/runs/${runToken}` every 2 s until `state` is in `["completed", "succeeded"]` (success) or a failure terminal state. Throws on failure or timeout (`opts.deadlineMs`, default 120 s — Mode runs typically finish in 5-15 s; 120 s is the safe-but-not-runaway ceiling).
    - `listQueryRunsForRun(reportToken, runToken)` — `GET /api/${account}/reports/${reportToken}/runs/${runToken}/query_runs`. Returns `_embedded.query_runs[]` with `{ token, query_token?, query_name, state }`.
    - `getQueryRunResults(reportToken, runToken, queryRunToken)` — `GET /api/${account}/reports/${reportToken}/runs/${runToken}/query_runs/${queryRunToken}/results/content.json`. Returns `Record<string, unknown>[]`.
    - `getReportMetadata(reportToken)` — `GET /api/${account}/reports/${reportToken}`. Returns `{ name }`. Used to build the «Today's date: …\n\n## Query: "..." (from report "...")» header line in `dryRun.ts:buildUserMessage`.
    All follow the existing `getConfig()` + `authHeader()` + `throw new Error(...)` patterns of the file. Add a new exported type `ModeQueryRun` to `lib/mode-types.ts` matching what 17.0's identical type defines.

  - [x] 18.3 Implement `web/lib/groq.ts` — wrapper over the GROQ SDK with streaming support.
    - Constants: `LLM_MODEL = "llama-3.3-70b-versatile"` (matches `executor.py:LLM_MODEL`), `LLM_TEMPERATURE = 0.7`, `LLM_MAX_TOKENS = 4096`. All exported so the dry-run orchestrator can reference them.
    - `getGroqClient()`: lazy-construct + return a `Groq` instance from the `groq-sdk` package, reading `GROQ_API_KEY` from `process.env`. Throws a clear error when the env var is missing.
    - `streamChatCompletion({ systemPrompt, userMessage, signal })`: async generator that yields `{ delta: string }` for each token chunk and finally `{ done: true, usage: { input, output, total } }`. Internally calls `groq.chat.completions.create({ model, messages, stream: true, temperature, max_tokens }, { signal })`. The SDK's stream is an async iterable of chunks shaped like the OpenAI streaming response; project each chunk's `choices[0].delta.content` to a delta, and read the final chunk's `x_groq?.usage` for token counts.

  - [x] 18.4 Implement `web/lib/dryRun.ts` — the orchestrator that walks Mode then GROQ.
    - Exports `async function* runDryRun(brief: Brief, signal: AbortSignal): AsyncGenerator<DryRunEvent>` where `DryRunEvent` is:
      ```ts
      type DryRunEvent =
        | { kind: "mode-fetched" }
        | { kind: "groq-chunk"; delta: string }
        | { kind: "complete"; usage: { input: number; output: number; total: number } }
        | { kind: "error"; phase: "mode" | "groq"; message: string };
      ```
    - Algorithm:
      1. For each source in `brief.sources`: `triggerReport` → `waitForCompletion` → `listQueryRunsForRun` → for each query in the brief's source.queries: find the matching `query_run` by token (prefer `query_token`, fall back to `query_name`) → `getQueryRunResults` → accumulate `{ query_name, rows }` pairs.
      2. After all sources resolved, yield `{ kind: "mode-fetched" }`.
      3. Build the `userMessage` exactly as `executor.py:build_user_message` does: a compact-JSON serialisation under `## Query: "name" (from report "title")` blocks. Reuse the same compact-JSON shape (`separators: (",", ":")`) so the GROQ output matches what the production executor would emit.
      4. Call `streamChatCompletion({ systemPrompt: brief.prompt, userMessage, signal })` and yield each `groq-chunk` event.
      5. Yield the final `complete` event with the usage payload.
    - Catch errors at each phase boundary; yield `error` event with the phase tag. The route handler converts these into SSE `error` events.

  - [x] 18.5 Implement `web/app/api/briefs/dry-run/route.ts` — the POST endpoint with SSE response.
    - File header: `import "server-only";`, `export const runtime = "nodejs";`, `export const dynamic = "force-dynamic";`.
    - `POST` handler: validate `await request.json()` against `briefSchema`; respond 400 with zod errors on validation failure.
    - Build a `ReadableStream` that consumes `runDryRun(brief, request.signal)` and emits SSE-formatted lines (`event: <kind>\ndata: <json>\n\n`) for each event.
    - Set response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no` (the last header disables nginx-style proxy buffering so chunks reach the client as they're emitted).
    - On `request.signal.aborted`, the route exits cleanly: the GROQ stream's `signal` aborts → the SDK closes the HTTP connection → the generator completes without yielding further events.
    - The 502/error mapping happens at the route level: a `try/catch` around the orchestrator wraps any unexpected exception into a final SSE `error` event before closing the stream (so the client always sees a well-formed terminator instead of a torn connection).

  - [x] 18.6 Implement `web/components/DryRunSheet.tsx` — the controlled side-panel that renders the streamed output.
    - Client component. shadcn `Sheet side="right"`, `SheetContent className="sm:max-w-2xl"` so the markdown body has room to breathe.
    - Props: `{ open: boolean; payload: Brief | null; onClose: () => void }`. Parent (the DryRunProvider in 18.8) owns the state; the Sheet is fully controlled.
    - State machine: `{ status: "idle" | "loading-mode" | "streaming-groq" | "ready" | "cancelled" | "error"; markdown: string; usage?: TokenUsage; error?: string }`. Transitions:
      - On `open && payload`: status → `"loading-mode"`, markdown = `""`.
      - SSE `mode-fetched`: status → `"streaming-groq"`.
      - SSE `groq-chunk`: append `event.delta` to markdown.
      - SSE `complete`: status → `"ready"`, usage = event.usage.
      - SSE `error`: status → `"error"`, error = event.message.
      - Cancel button click OR Sheet close: AbortController.abort() → status → `"cancelled"`, markdown stays as-is (partial output preserved).
    - Body layout: phase indicator at top (Catalan narrative + spinner during loading-mode / streaming-groq), `<BriefMarkdown>` rendering the accumulated markdown (re-renders incrementally as chunks arrive), token usage line at the foot (visible after `ready`), Cancel button at top right (visible during the two loading phases).

  - [x] 18.7 Implement the SSE consumer inside `DryRunSheet` using `fetch` + `ReadableStream` reader.
    - When `open && payload`: create `AbortController`, do `fetch("/api/briefs/dry-run", { method: "POST", body: JSON.stringify(payload), signal: controller.signal })`. Read response body via `res.body.getReader()`; decode chunks via `new TextDecoder()`; buffer-and-split lines on `\n\n` (SSE message boundary); for each complete message, parse the `event:` + `data:` lines and dispatch into the state machine.
    - Cleanup: `useEffect`'s return function calls `controller.abort()`. The cleanup fires when `open` flips to `false`, when `payload` changes (which it shouldn't mid-run but defensively), or when the component unmounts.
    - Reuse the same fetch-streaming pattern Vercel's docs recommend for Node-runtime streamed endpoints (EventSource has flaky proxy behaviour in the Vercel edge layer for Node-runtime sources, per their own documentation).

  - [x] 18.8 Implement `web/hooks/useDryRun.tsx` — the React Context that the three trigger surfaces share.
    - Exports `DryRunProvider` (a client component wrapping `children` and mounting one `<DryRunSheet>` instance at its root) and `useDryRun()` (hook returning `{ run: (brief: Brief) => void }`).
    - Provider state: `const [dryRun, setDryRun] = useState<{ payload: Brief } | null>(null);`. The `run(brief)` callback sets `{ payload: brief }`; the Sheet's `onClose` callback resets to `null`.
    - Mount the provider as high as practical so all three triggers can access it. Two options:
      - Mount at `app/layout.tsx` root → every page can call `useDryRun`. Risk: leak of the Sheet's heavy `<BriefMarkdown>` import into the root bundle.
      - Mount at each of the three trigger points → smaller root bundle but the surfaces don't share state (closing the sheet on one trigger doesn't reset the others; each manages its own).
    - Default to the **first approach** (root mount). The bundle delta is negligible (<5 KB gz) and the shared-state semantics are simpler.

  - [x] 18.9 Implement `web/components/DryRunButton.tsx` — the trigger button shape used by the three surfaces.
    - Two prop shapes via discriminated union:
      ```ts
      type Props =
        | { mode: "persisted"; brief: Brief }
        | { mode: "form"; getBrief: () => Brief };
      ```
    - Renders a ghost-variant button with lucide `Sparkles` icon + English label «Preview output». Click handler reads the brief (either directly or via the closure) and calls `useDryRun().run(brief)`.
    - The form-mode closure path is critical: the BriefForm passes `() => getValues()` (RHF) so the button reads the LATEST form values at click time, not the values that existed at render time. Without this, a user editing for a few minutes then clicking Preview output would dry-run against stale values.
    - Disabled state: when the brief fails a quick `briefSchema.safeParse(brief)` validation (e.g. empty required fields), show the disabled button with a Catalan Tooltip («Omple els camps obligatoris abans de fer preview»). Same idiom RunNowButton uses on create mode.

  - [x] 18.10 Mount `DryRunButton mode="persisted"` in the **detail page header** (`app/briefs/[name]/page.tsx`), immediately to the LEFT of the Run Now button. Pass `brief={brief}` (the parsed YAML, already in scope). The DryRunProvider must be mounted at `app/layout.tsx` (per 18.8) so the button can find the context.

  - [x] 18.11 Mount `DryRunButton mode="form"` in the **form footer in edit mode** (`components/BriefForm.tsx`). Position: a separate row below the existing action row (Edit / Cancel + Save), visible only when `mode === "edit"`. Pass `getBrief={() => methods.getValues()}` where `methods` is the RHF `useForm()` return. The button is rendered in BOTH new-brief mode and existing-brief edit mode (the dry-run is brief-state-only; doesn't care if the brief is persisted).

  - [x] 18.12 Mount a Preview-output entry in the **sidebar kebab** (`components/BriefRowMenu.tsx`). Position: below the existing «History» entry. **Implementation deviation from the sub-task spec**: instead of propagating the full Brief through `BriefSidebarList` (which would inflate the sidebar payload by ~5 KB per brief), the kebab does a **lazy GET to `/api/briefs/[filename]`** when the user clicks Preview output. The fetched payload is then validated via `briefSchema.safeParse` and passed to `useDryRun().run(brief)`. Cost: one extra HTTP round-trip on click (~100 ms in practice; the brief is already cached server-side). Benefit: sidebar payload stays trim, the existing `BriefListItem` shape doesn't grow a heavy `brief: Brief` field. The kebab button shows a spinner during the fetch.

  - [x] 18.13 README env-var doc + roadmap entry.
    - Add `GROQ_API_KEY` to the web-app env-vars list in README's «Web app» section (placement next to the existing `MODE_TOKEN` block). Note that the value already exists in GitHub Secrets — operator copies it into Vercel.
    - Append to Roadmap: «18.0 ⏳ Dry-run output — «Preview output» from detail header, form footer or sidebar kebab streams a no-Slack, no-commit dry-run of the brief; 5-15 s end-to-end with progressive markdown rendering.». Flip to ✅ at merge time.

  - [ ] 18.14 Smoke test on Vercel preview (the project's standard MVP gate; no automated tests). Checklist:
    1. Open an existing brief in detail mode → click «Preview output» in the header → Sheet opens, shows «Carregant Mode data…» for 5-10 s, transitions to «Generant amb GROQ…» with text streaming, ends with «Llest» + token usage line. The output matches what Run Now would post to Slack (run a Run Now in parallel and eyeball-compare).
    2. Enter edit mode → tweak the prompt («Sigues més curt», «Afegeix percentatges», etc.) → click «Preview output» from the form footer → the new prompt's output streams; no Save was needed; closing the Sheet and re-opening starts a NEW generation (non-deterministic LLM output is the value).
    3. Click «Preview output» from the sidebar kebab → same flow as (1), no navigation needed.
    4. Click Cancel during the streaming phase → stream stops, partial output stays on screen with «(Cancel·lat)» badge.
    5. Close the Sheet (X / Escape / outside-click) mid-stream → same as Cancel — output preserved frozen.
    6. Verify NO `.run.json` artifact appears in GitHub Actions for these dry-runs (the executor pipeline was never invoked).
    7. Verify NO Slack message appears in the brief's channel.
    8. Verify `/history` does NOT show the dry-run output (artifact-backed read path; dry-runs don't write artifacts).
    9. Curl directly: `curl -X POST https://<preview>.vercel.app/api/briefs/dry-run -H 'content-type: application/json' -d @brief.json` → response is `text/event-stream` with `event: groq-chunk\ndata: ...` lines.
    10. Operator-only check: dispatch a `/api/briefs/dry-run` call WITHOUT setting GROQ_API_KEY in Vercel → endpoint should respond cleanly with an `error` SSE event explaining the missing env var, NOT a 500 / uncaught exception.
- [x] **19.0 Prompt Assistant** — PRD §4 «Prompt Assistant» + §7 «Prompt Assistant». Branch `feature/19.0-prompt-assistant` (already created, branched from the PRD-only base — independent of 16.0 / 17.0 / 18.0). Decisions recorded with user 2026-05-17: 1.B GROQ Llama 3.3 70b (reuses GROQ_API_KEY from 18.0), 2.B localStorage per brief, 3 metadata + few-shot (selected on best-UX grounds — no Mode data sample), 4.A Sheet right-side toggle from within the BriefForm. **No new env var** beyond what 18.0 already needs (GROQ_API_KEY). **No new shadcn primitive** (Sheet + Dialog + Button + Textarea all in place).

  - [x] 19.1 Add the GROQ SDK to the project (if not already present from task 18.0): `cd web && npm install groq-sdk`. The Prompt Assistant reuses the same SDK + same model (`llama-3.3-70b-versatile`) the dry-run endpoint uses. If task 18.0 has landed first on this branch via merge / rebase, the SDK is already there — this sub-task becomes a no-op verified by `grep groq-sdk package.json`.

  - [x] 19.2 Implement (or reuse from 18.0) `web/lib/groq.ts` with `streamChatCompletion({ systemPrompt, messages, signal })`. The function is an async generator yielding `{ kind: "delta", delta }` per token + `{ kind: "done", usage }` at the end. AbortSignal honoured for stream cancel. **Deviation from 18.0's signature**: this branch's wrapper takes a `messages: Array<{role, content}>` for multi-turn chat; 18.0's version takes a single `userMessage: string`. The second-to-merge PR unifies the signature on `messages` (the broader shape covers both consumers — 18.0's dry-run wraps its single user_message into `[{ role: "user", content }]`).

  - [x] 19.3 Implement `web/lib/promptAssistant.ts` with `ChatMessage` + `SourceContext` + `FewShotBrief` types, `buildFewShot()` (top 3 briefs with `prompt.length >= 200`, sorted by length desc, 5-min in-memory cache, small-repo fallback to top-3 regardless of length when filtering leaves fewer than 3) and `buildSystemPrompt({ briefName, currentPrompt, sources, fewShot })`. The system prompt includes a Catalan role description, the `<suggested_prompt>...</suggested_prompt>` output contract with explicit example, the current brief's metadata block (name + current prompt + sources list), and the few-shot block (one `### Exemple` heading per brief with sources + prompt in a code fence). `resolveSources()` helper exposed as a seam — currently a pass-through, ready for future name resolution via the Mode catalog.

  - [x] 19.4 Implement endpoint `web/app/api/briefs/prompt-assist/route.ts`: POST handler, runtime nodejs, dynamic force-dynamic. Validates body shape minimally (a custom `isValidBody` predicate checking the `messages: ChatMessage[]` + `context: { briefName, currentPrompt, sources }` shape), composes the system prompt via 19.3 helpers, calls `streamChatCompletion` with `request.signal`, streams SSE events `delta` / `complete` / `error` matching the dry-run wire shape. Defensive fallback when `buildFewShot()` throws (GitHub down / brief parser error): empty few-shot array, assistant continues without examples.

  - [x] 19.5 Implement `web/hooks/usePromptAssistant.tsx` exposing `{ applyPrompt(text: string): void }` via React Context. The BriefForm passes the closure that calls `setValue("prompt", text, { shouldDirty: true })` + flips `mode` to `edit` when needed.

  - [x] 19.6 Implement `web/components/PromptAssistantButton.tsx`: outline-variant Button with lucide `Bot` icon + English label «Prompt Assistant», size `xs`. Mounted inside `BriefForm` next to the Prompt LabelRow's Info icon (positioned on the right of the label row via a flex justify-between wrapper).

  - [x] 19.7 Implement `web/components/PromptAssistantSheet.tsx` — chat container. shadcn `Sheet side="right"`, `sm:max-w-2xl`. Local state machine `{ messages, status, pending, error }`. localStorage persistence (versioned shape `{ version: 1, messages, updatedAt }`) per `prompt-assistant:<filename>` with 50-message cap enforced on every save. SSE consumer pattern from 18.0 (fetch + ReadableStream reader + newline-boundary parser). Stop button replaces Send while streaming, Enter to send, Shift+Enter for newline. Clear-conversation button + Dialog confirm in the header. Auto-scroll to bottom on every chunk arrival. **Deviation from sub-task spec**: the Sheet accepts a `getBrief: () => Brief` closure instead of a `brief: Brief` prop, so each send call reads the LATEST form state (unsaved edits feed into the chat context). Without the closure, the user editing the form while the Sheet was open would see the chat send stale snapshot data.

  - [x] 19.8 Implement message bubble UI inside the Sheet. User bubbles right-aligned zinc-100 max-w-[80%]; assistant bubbles left-aligned with `<BriefMarkdown>` rendering inside a white-border bubble. When an assistant message contains `<suggested_prompt>...</suggested_prompt>`, extract the first match via a `/<suggested_prompt>([\s\S]*?)<\/suggested_prompt>/` regex, render the message stripped of the tags, surface an «Apply this prompt» Button below. Click calls `usePromptAssistant().applyPrompt(extracted)` + closes the Sheet + Sonner toast «Prompt actualitzat». The pending (in-flight) assistant message renders the same way but with `editable={false}` so the Apply button doesn't appear until the stream completes.

  - [x] 19.9 Mount `PromptAssistantProvider` + `PromptAssistantSheet` inside `BriefForm.tsx`. New state `[assistantOpen, setAssistantOpen]`. Provider receives `applyPrompt={(text) => { setValue("prompt", text, { shouldDirty: true, shouldValidate: true }); if (mode === "view") setMode("edit"); }}`. Provider wraps the entire form return. Sheet mounted just after `</form>` so it can portal correctly. The Prompt label row is now a custom flex justify-between div (replacing the LabelRow component for this one field) so the «Prompt Assistant» button can land on the right side of the row, opposite the Label + Info icon. storageKey is `prompt-assistant:_new` for the create flow and `prompt-assistant:<filename>` for existing briefs.

  - [ ] 19.10 Smoke test on Vercel preview. Checklist:
    1. New brief → click «Prompt Assistant» → ask for a prompt → assistant streams + suggests a `<suggested_prompt>` block → «Apply this prompt» button appears → click → form's Prompt field populated, toast surfaces.
    2. Existing brief → ask «fes-ho més curt» → assistant suggests a shorter version → Apply works.
    3. Close + re-open Sheet → conversation persists (localStorage).
    4. Refresh browser → still persists.
    5. Clear conversation → Dialog confirms → message list wiped.
    6. Stop button mid-stream → partial assistant message stays with «(aturat)» badge.
    7. Two different briefs in two tabs → per-brief localStorage isolation verified.
    8. Curl test against the endpoint — SSE response with delta + complete events.
    9. Without GROQ_API_KEY in Vercel → clean error SSE event, not 500.

  - [x] 19.11 README env-var doc + roadmap entry. `GROQ_API_KEY` line added to the web-app env-vars block noting both consumers (dry-run from task 18.0 + Prompt Assistant from task 19.0). Roadmap entry for 19.0 added in ⏳ state — flip to ✅ at merge time. Sub-task checkboxes flipped to `[x]` as each lands; `19.0` parent header flips to ✅ at full ship + smoke test pass.
