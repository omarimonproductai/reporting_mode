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
    - **Early-data freshness warning** (`EarlyDataWarning.tsx`): client component mounted between the brief title and the ExecutionMetadata card on `/briefs/[name]`. Checks `Intl.DateTimeFormat({timeZone: "Europe/Madrid"})` for the current hour after mount and renders an amber `Alert` when hour < 10. Communicates that the daily Mode data dump may not be complete yet and the brief output could reflect yesterday's snapshot.
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

- [ ] **6.0 Manual brief runs ("Run Now" button)** (new, added 2026-05-16 after user feedback; revised 2026-05-16 to rename Test → Run Now, move to the top of the form, and render disabled-with-hint on the new-brief page instead of hidden)
  - **Dual purpose**: Run Now is both (a) the primary on-demand-test affordance during prompt iteration, and (b) the documented **recovery path** for missed scheduled runs (see PRD §7 "Scheduling reliability"). When GitHub Actions delays the master scanner cron beyond the 15-min window, the scheduled execution is lost; the user opens the affected brief and clicks Run Now to dispatch manually. The 2-minute cooldown still applies.
  - [ ] 6.1 **User action (cannot be coded)**: extend the existing `vercel-reporting-mode` PAT to include `Actions: Read & write` in addition to `Contents: Read & write` + `Metadata: Read-only`. Update the token value in Vercel (Production + Preview).
  - [ ] 6.2 Implement `web/lib/dispatch.ts` with `dispatchBriefRun(filename)`: calls `POST /repos/{owner}/{repo}/actions/workflows/run-brief.yml/dispatches` with `{ref: "main", inputs: {brief: filename}}`. Returns the workflow run URL when GitHub exposes one (otherwise the workflow's HTML URL).
  - [ ] 6.3 Implement `POST /api/briefs/[name]/run`: verifies the brief exists, enforces a 2-minute cooldown via a module-level `Map<filename, lastDispatchedAtMs>` (rejects with 429 + `{retry_after_seconds}` when violated), then calls `dispatchBriefRun`. (Endpoint path uses `/run` to match the UI label, not `/test`.)
  - [ ] 6.4 Implement `web/components/RunNowButton.tsx` (client): shadcn Button with a Play icon labelled "Run Now". The button is **always rendered** on the brief detail view; the disabled state is conditional:
    - **Disabled when in create mode** (no brief saved yet). The disabled state MUST show a Tooltip on hover/focus: «Crea el brief abans de poder executar-lo.» (chrome + Catalan narrative per the language policy).
    - **Disabled during cooldown** after a successful dispatch (120s). Label changes to `Run Now — torna a provar en 1:42` with a live countdown; deadline persisted to `localStorage` keyed by filename so reloads don't reset it.
    - **Disabled during the in-flight POST** (label `Running…`).
    - **Enabled** otherwise: on click POST `/api/briefs/[name]/run`; on success toast a confirmation with the workflow URL when available and start the cooldown.
  - [ ] 6.5 Brief detail view / new-brief page: mount `RunNowButton` at the **top of the form**, above the Brief Name field, as the most prominent action. On the existing-brief detail view it's enabled (subject to cooldown); on `/briefs/new` it's rendered but disabled with the explanatory tooltip (per 6.4). It MUST NOT be hidden.
  - [ ] 6.6 Manual verification on the Vercel preview: open `/briefs/new` → confirm Run Now is visible but disabled with the tooltip; save the brief → navigate to its detail page → confirm Run Now is enabled; click it → confirm the workflow appears in the GitHub Actions tab, the Slack message arrives, and the second-press-within-2min is blocked by both UI countdown and server 429.

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
