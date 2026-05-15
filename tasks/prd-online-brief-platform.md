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

6. The main content area for a brief MUST present every field of the brief as an editable form: `name`, `schedule`, `timezone`, `slack_channel`, list of `sources` (each with `mode_report_token` and list of queries), and `prompt`.
7. **Each field MUST have an adjacent inline description** explaining what the field is for, the expected format, and a concrete example. The description MAY be expanded/collapsed but is visible by default for a new user (PLG: no onboarding needed).
8. The `prompt` field MUST be a multi-line text area with monospace font and visible line wrapping, sized to comfortably show ~20 lines without scrolling.
9. The application MUST allow the user to add and remove **sources** dynamically (rows of the form).
10. For each query within a source, the application MUST allow the user to **enable or disable CSV attachment to Slack** independently (this replaces the current per-brief `csv` flag). The default is `false`.

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
    - The timezone (default: `Europe/Madrid`).
19. The visual builder MUST emit a **valid cron expression** persisted to the YAML, plus a human-readable description shown to the user (e.g., "Cada dimarts a les 10:00 hora local Cooltra").
20. The visual builder MAY include a small "Advanced: edit cron directly" toggle for power users; this is a stretch goal, not a v1 requirement.

### Per-Brief Execution Metadata

21. The detail view MUST display, prominently and above the editable form:
    - The **timestamp** of the last execution (in local Cooltra time, with a tooltip showing the UTC original).
    - The **status** of the last execution (success / failed / never run), color-coded.
    - The **tokens consumed** in that last execution, split as **input** and **output** if available, otherwise total.
22. If the brief has never run, the section MUST display "Mai executat" (or equivalent) rather than empty.

### Calendar View

23. The calendar view MUST display a **weekly grid** (Monday → Sunday columns, 24h rows or compressed by hour blocks) showing every scheduled brief as a colored event at its scheduled time.
24. Clicking an event MUST open the corresponding brief's detail view.
25. The calendar MUST handle timezones correctly: events are drawn at the time they actually fire in `Europe/Madrid` (the operational timezone of Cooltra), regardless of the brief's own declared timezone.
26. A toggle MAY allow switching between weekly and monthly views (stretch goal).

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

## 5. Non-Goals (Out of Scope)

- **Authentication and per-user briefs**. The platform is openly accessible; everyone sees and edits everything. The data model includes a nullable `owner_email` field reserved for a future auth phase but it is never populated in this version.
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

- **Visual language**: continue with shadcn/ui aesthetic already established in the static dashboard (zinc palette, Inter font, JetBrains Mono for code/tokens, generous padding, subtle borders, rounded-lg). Reuse the design tokens.
- **Sidebar width**: ~280px on desktop. On screens narrower than `lg` (1024px), the sidebar collapses to a hamburger menu.
- **Form fields with inline help**: each field renders as `<Label> + <Input> + <description below in small muted text>`. No expandable tooltips at first — just always-visible muted text. PLG philosophy: zero friction, zero hidden info.
- **Cron visual builder**: standalone component, ~400px wide, with three sections: "Quan" (frequency: radio buttons), "A quina hora" (time picker, 15-min increments), "Zona horària" (dropdown defaulting to `Europe/Madrid`). A live preview below shows the human-readable schedule (e.g. "Cada dimarts a les 10:00 (Europe/Madrid)") and, in muted font, the generated cron expression.
- **Slack channel selector**: shadcn/ui `Combobox` pattern — a button that opens a popover with a searchable list. Public channels show with a `#` icon; private channels show with a `🔒` icon. Channel names rendered in `font-mono` to match Slack's own visual convention. Empty state when the bot is in zero channels: a friendly message + the `/invite @<bot-name>` snippet.
- **"Bot not in channel" warning**: renders below the channel field as a shadcn/ui `Alert` (warning variant — yellow/amber, not red, because the situation is recoverable). Inside: one line of explanation + a code block with the `/invite` snippet + a small "Copy" button that triggers a transient "Copiat!" toast. A subtle "Refresh channels" link to re-query the list after the user invites the bot.
- **Calendar event color**: derive deterministically from the brief name (so each brief has a consistent color across the calendar regardless of who sees it).
- **Footer**: 12px text, `text-zinc-400`, fixed bottom-right corner with `padding 8px 12px`. Format: `Built from <sha7> · <commit subject truncated to 50 chars> · <DD/MM/YYYY HH:MM Madrid>`.

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
- **GitHub authentication**: a service GitHub App or PAT stored in Vercel environment variables. The PAT scopes: `contents:write` on this repository only.
  - *Note*: never expose this PAT client-side. All GitHub API calls go through the server.

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

## 8. Success Metrics

- **Adoption**: at least 3 Cooltra non-engineers have created a brief through the UI within the first month of release, without help from the engineering team.
- **Time to first brief**: median time from "opens platform URL" to "first brief saved successfully" is under 5 minutes for new users.
- **Operational visibility**: 100% of brief executions in the last 30 days are visible from the UI (no need to open GitHub Actions to see results).
- **Cost**: monthly infrastructure cost remains 0 € for at least 90 days post-launch, with up to 20 briefs and 100 user sessions per day.
- **Reliability**: at least 99% of writes succeed (commit lands on `main` and is reflected in the UI) when measured over a rolling 30-day window.
- **Support load**: zero "how do I…" questions arrive to the engineering team that are answered by information already visible in the inline help texts.
- **Channel-misconfiguration runtime failures**: at most 1 per month after launch. Users either pick a valid channel from the dropdown or follow the inline `/invite` snippet — they should not be discovering "bot not in channel" through a Slack delivery error.

## 9. Open Questions

1. **GitHub identity for writes**: should commits made through the platform come from a Service GitHub App (cleaner, more granular permissions, slightly more setup) or from a Personal Access Token tied to a service account (simpler, less granular)?
2. **Cron builder library or custom**: is the maintenance + bundle size cost of an existing library (e.g., `cron-builder`) better than ~200 lines of custom code? To be decided during implementation.
3. **Calendar event collisions**: when two briefs are scheduled at the same exact minute, how do we render them? Stacked? Side-by-side? Indicator with count?
4. **Brief deletion confirmation**: do we require a typed confirmation (typing the brief name) for delete, or just a "Are you sure?" modal? Lean toward the modal only — deletion is reversible from git history.
5. **Empty calendar state**: when no briefs are scheduled in the current week, show an illustration + CTA "Create your first brief" or just an empty grid?
6. **Visualisation of token consumption over time**: nice-to-have for a future iteration. Not in this PRD's scope, but the artifact data captured here enables it.
7. **DM-style destinations**: the `slack_channel` field accepts a channel name. Should we also support direct messages (`@username`) or multi-person DMs as destinations? Out of scope today, but the schema (single string) doesn't preclude it. Decide before implementation if such use cases exist.
8. **Migrating "fully-private" channels**: if Cooltra later wants briefs to publish to channels where the bot's `groups:read` is disabled by workspace policy, what's the fallback? Most likely: those channels don't appear in the dropdown and the user must type them manually + trigger the warning flow. Validate this assumption with workspace admin.
