# Tasks: Online Brief Management Platform

Implementation plan derived from `tasks/prd-online-brief-platform.md`.

**Scope: MVP** (decisions confirmed by the user):
- Calendar view is a **simple sorted list** of upcoming brief executions, not a weekly grid.
- **No conflict detection** for concurrent edits — last-write-wins, with a small "loaded at HH:MM" indicator in the form so the user knows their baseline.
- **Channel-list refresh by polling** (every 5 min via stale-while-revalidate), no explicit refresh button.
- **Desktop only**. Mobile may render but is not designed for; the calendar/list and forms assume ≥ 1024px width.

## Relevant Files

> This section will be filled out completely during Phase 2 (sub-task generation). The high-level structure expected:

- `web/` — new Next.js application at the root of the repo (separate from `scripts/`).
- `web/app/` — App Router pages: `/` (briefs list), `/briefs/[name]` (detail/edit), `/briefs/new`, `/schedule` (list-calendar).
- `web/app/api/` — serverless API routes: `briefs`, `briefs/[name]`, `channels`, `runs/[brief]`, `version`.
- `web/components/` — shadcn/ui components + custom (CronBuilder, ChannelCombobox, BriefForm, BriefSidebar, ExecutionMetadata, Footer).
- `web/lib/` — utilities: GitHub API client, Slack API client, YAML serializer, cron helpers.
- `scripts/executor.py` — to be modified to emit `runs.json` artifact per execution.
- `.github/workflows/run-brief.yml` and `run-due-briefs.yml` — to be modified to upload the runs artifact.
- `briefs/*.yml` — existing briefs to be migrated to the new CSV-per-query schema.

### Notes

- The web app lives under `web/` to keep it separate from the existing Python executor and YAML configs. The repo becomes a monorepo: Python on top, Next.js under `web/`.
- The static dashboard at `docs/index.html` will be retired once the new web app is live; the `build-dashboard.yml` workflow is removed in the final task.
- No automated tests in the MVP scope. Junior developers manually verify each task via the Vercel preview deployment that Vercel creates per PR.

## Tasks

- [ ] 0.0 Create feature branch
  - [ ] 0.1 Create and checkout a new branch: `git checkout -b feature/online-brief-platform`. All implementation work happens on this branch; the parent tasks below land as separate commits on it (or sub-PRs if the team prefers).

- [ ] 1.0 Project foundation: Next.js + Vercel + layout shell
      Bootstrap the web app, deploy it to Vercel, render the persistent sidebar + main content layout, and surface the version footer. By the end of this task there is a public Vercel URL showing the app shell with an empty "no briefs loaded yet" state.

- [ ] 2.0 Brief CRUD: read, edit, create, delete
      Wire the app to the canonical source (briefs YAML in the repo) via GitHub API. The user can view any brief in the sidebar, edit its fields in a form with always-visible inline help, save changes (commits via GitHub API), create new briefs from a template, and delete briefs.

- [ ] 3.0 Specialised form widgets: cron visual builder + Slack channel combobox
      Replace the raw `schedule` and `slack_channel` text inputs with friendly UI widgets. Cron builder emits canonical cron strings with a human-readable preview. Channel combobox queries Slack `conversations.list`, shows bot-member channels, and renders a non-blocking warning + `/invite` snippet for channels where the bot is absent.

- [ ] 4.0 Execution tracking + per-brief metadata
      Modify the Python executor to emit a `runs.json` artifact on every run. Add a workflow step that uploads it. Add an API route that reads the latest artifact per brief via the GitHub Actions API. Surface "last run status + tokens (input + output)" on both the sidebar item and the brief detail view.

- [ ] 5.0 List-calendar view + schema migration + polish + retire static dashboard
      Add a `/schedule` page that lists upcoming brief executions sorted by next fire time. Migrate the `csv` flag from brief level to query level (schema change in the executor + the two existing briefs). Final polish: empty states, loading states, error messages, inline help text review. Retire the old `docs/index.html` static dashboard and remove the `build-dashboard.yml` workflow.

---

**I have generated the high-level tasks based on your requirements. Ready to generate the sub-tasks? Respond with 'Go' to proceed.**
