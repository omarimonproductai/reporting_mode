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

- [ ] **6.0 Manual brief runs ("Run Now" button)** (new, added 2026-05-16 after user feedback; revised 2026-05-16 to rename Test → Run Now, move to the top of the form, and render disabled-with-hint on the new-brief page instead of hidden)
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
