# Cooltra Reporting Platform

A small, repo-as-database platform for scheduled Slack briefs built on top of [Mode Analytics](https://mode.com) data.

## What it does

- Each brief is a single YAML file in `briefs/`, declaring:
  - Where to pull data from (a Mode report + one or more queries).
  - When to run (a 5-field cron expression interpreted in `Europe/Madrid`).
  - Where to publish the result (a Slack channel).
  - A natural-language prompt that an LLM (Groq) turns into the final message.
  - Optionally, a `reference_link` URL appended as a clickable line to the Slack message.
- A Vercel Cron tick every 5 minutes calls the web app's `/api/scheduler/tick` endpoint, which scans the briefs and dispatches the ones whose cron is due.
- A Next.js web app on Vercel lets non-engineer users browse, create, edit and delete briefs through a form UI; the underlying YAML files are committed back to the repo via the GitHub Contents API.

## Repository layout

```
briefs/                       YAML brief definitions (one file per brief)
scripts/
  executor.py                 Runs a single brief: fetch Mode data → Groq prompt → Slack message + CSVs
.github/workflows/
  run-brief.yml               Manual / API-dispatched single-brief run; uploads .run.json artifact
web/                          Next.js 16 App Router web UI deployed on Vercel
  app/api/scheduler/tick      GET endpoint called by Vercel Cron every 5 min; dispatches due briefs
  vercel.json                 Vercel Cron declaration (*/5 * * * * → /api/scheduler/tick)
tasks/                        PRD + task list driving the current iteration
```

## Web app (`web/`)

- Stack: Next.js 16 (App Router, React 19), Tailwind v4, shadcn UI, React Hook Form, Zod, server-only persistence via the GitHub Contents API.
- Deployment: Vercel. Preview deployments per branch; production tracks `main`.
- Required environment variables (set in Vercel, not committed):
  - `GITHUB_TOKEN` — fine-grained PAT (`vercel-reporting-mode`) with `Contents: Read & write` + `Metadata: Read-only` on this repo. Will need `Actions: Read & write` once task 6.0 (Run Now button) lands.
  - `GITHUB_OWNER`, `GITHUB_REPO` — `omarimonagentai` / `reporting_mode`.
  - `SLACK_BOT_TOKEN` — for the channel picker (`/api/channels`).
  - `CRON_SECRET` — 32+ byte random string (`openssl rand -hex 32`) shared between Vercel Cron and `/api/scheduler/tick`. Vercel Cron auto-injects it as the `Authorization: Bearer …` header; the endpoint rejects mismatches with 401.
  - `GROQ_API_KEY` — same value already in GitHub Secrets for the executor pipeline; the web app needs it for the dry-run endpoint (`/api/briefs/dry-run`). Copy the existing GitHub Secret into Vercel env vars (Production + Preview, encrypted).

## Python executor

- Required environment variables (set as GitHub Secrets on this repo, consumed by the workflows):
  - `MODE_TOKEN`, `MODE_SECRET`, `DEFAULT_MODE_ACCOUNT` — Mode API credentials.
  - `GROQ_API_KEY` — Groq LLM API key.
  - `SLACK_BOT_TOKEN` — bot must be a member of every channel a brief publishes to.

## Customization

Tunable knobs that live in code (not env vars) so they version-control
with the rest of the app.

- **Output-token visual signal** — the output-token count rendered next
  to a brief's last-run meta (sidebar + ExecutionMetadata card) is
  colour-coded above two thresholds, so expensive briefs are visible
  at a glance. Defaults: `> 250` → orange, `> 1000` → red. Re-calibrate
  by editing the four constants at the top of `web/lib/tokenWarnings.ts`
  (`OUTPUT_TOKEN_WARN_THRESHOLD`, `OUTPUT_TOKEN_DANGER_THRESHOLD`,
  `OUTPUT_TOKEN_WARN_CLASS`, `OUTPUT_TOKEN_DANGER_CLASS`). Both consumer
  sites import the same helper, so changing the file re-calibrates
  the whole app.

## Running a brief manually

From the GitHub UI:

1. Open the [Actions tab](../../actions).
2. Pick the **Run brief** workflow.
3. Click "Run workflow", select the branch, enter the brief filename (e.g. `app-version-adoption.yml`) and submit.

The workflow uploads a `<slug>.run.json` artifact summarising the run (status, timestamps, token usage, error if any). The web app reads this artifact to display per-brief execution metadata.

## Development

```bash
# Python executor (locally)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # if present, otherwise the script lists its own deps
python scripts/executor.py briefs/<file>.yml

# Web app (locally)
cd web
npm install
npm run dev
```

## Roadmap

The active iteration is tracked in `tasks/tasks-online-brief-platform.md`. Major milestones:

- 1.0–3.0 ✅ Initial monorepo + web CRUD for briefs.
- 4.0 ✅ Per-brief execution metadata + run history surfaced in the UI.
- 5.0 ✅ Schedule/Calendar view, UX polish, retire static dashboard.
- 6.0 ✅ Manual "Run Now" button (workflow_dispatch from the web app).
- 7.0 ⏳ Multi-language support.
- 8.0 ✅ Mode space catalog — name-based pickers for reports + queries in BriefForm.
- 9.0 ✅ `/schedule` sortable columns + "Última run" timestamp.
- 10.0 ✅ Brief output history — backend capture + `/api/briefs/[name]/outputs` endpoint.
- 11.0 ✅ Mode catalog landing — `/` becomes a browse view of the Mode space.
- 12.0 ✅ Brief output history — UI surfacing (`/history` page + per-brief drawer on the detail view).
- 13.0 ⏳ Authentication & access wall — magic-link login + domain restriction.
- 14.0 ✅ Scheduler reliability via Vercel Cron — replaces the GH Actions scanner with a `*/5` cron hitting `/api/scheduler/tick`.
- 15.0 ✅ Sidebar brief actions menu — per-row kebab exposing Edit, Run Now, History without navigating.
- 16.0 ⏳ Publish/Unpublish briefs — Draft state gates the cron auto-dispatch; new briefs default to Draft; Run Now requires confirmation when dispatching a draft.
- 17.0 ⏳ Mode data preview — inline «Preview data» button on each BriefForm query row; right-side Sheet shows the last 10 rows of the latest successful Mode run, validating wiring before save.
- 18.0 ⏳ Dry-run output — «Preview output» from detail header, form footer or sidebar kebab streams a no-Slack, no-commit dry-run of the brief; 5-15 s end-to-end with progressive markdown rendering.
