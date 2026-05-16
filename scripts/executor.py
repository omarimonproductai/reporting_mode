"""Generic executor for Cooltra reporting briefs.

Reads a brief YAML config, triggers each required Mode report, fetches the
specified queries from each, composes a single LLM prompt with all the data,
generates an executive brief, and posts it to Slack via Bot Token API
(chat.postMessage). Each query can opt into having its raw rows attached as
a CSV file in a thread reply (files_upload_v2) via the per-query `csv: true`
flag.

Usage:
    python scripts/executor.py briefs/<brief>.yml

The brief YAML schema (see briefs/*.yml for examples):
    name: str
    schedule: cron string                (read by due_runner.py, ignored here)
    slack_channel: str                   (target channel for chat.postMessage)
    sources:
      - mode_account: str                (optional; falls back to env var)
        mode_report_token: str
        queries:                         (list of objects)
          - token: str                   (12-char Mode query token)
            csv: bool                    (optional; defaults to false)
    prompt: str                          (multiline, inline)
"""
import csv as csv_module
import io
import json
import os
import re
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

import requests
import yaml
from dotenv import load_dotenv
from groq import Groq
from slack_sdk import WebClient

load_dotenv()

# ---- Mode ----
MODE_BASE_URL = "https://app.mode.com/api"
DEFAULT_MODE_ACCOUNT = os.environ.get("DEFAULT_MODE_ACCOUNT")
HTTP_TIMEOUT = 30
POLL_INTERVAL_SECONDS = 5
POLL_TIMEOUT_SECONDS = 300
IN_PROGRESS_STATES = {"enqueued", "pending", "running"}
SUCCESS_STATES = {"completed", "succeeded"}

# ---- LLM ----
LLM_MODEL = "llama-3.3-70b-versatile"
# LLM_MODEL = "mixtral-8x7b-32768"  # alternativa amb context més gran
LLM_TEMPERATURE = 0.3
LLM_MAX_TOKENS = 800
LLM_TIMEOUT = 60

# ---- Slack ----
SLACK_TIMEOUT = 10  # seconds, applied to chat.postMessage and files.upload

OUT_DIR = Path(__file__).resolve().parent.parent / "out"


def load_credentials():
    token = os.environ.get("MODE_TOKEN")
    secret = os.environ.get("MODE_SECRET")
    if not token or not secret:
        sys.exit("ERROR: MODE_TOKEN i/o MODE_SECRET no definits. "
                 "Comprova .env (local) o secrets (CI).")
    return token, secret


def load_brief(path):
    with open(path, encoding="utf-8") as f:
        brief = yaml.safe_load(f)
    required = {"name", "sources", "prompt"}
    missing = required - set(brief.keys())
    if missing:
        sys.exit(f"ERROR: brief {path} mancan camps obligatoris: {missing}")
    if not brief["sources"]:
        sys.exit(f"ERROR: brief {path} no té cap source.")
    return brief


def trigger_report(auth, account, report_token):
    url = f"{MODE_BASE_URL}/{account}/reports/{report_token}/runs"
    response = requests.post(
        url, json={"parameters": {}}, auth=auth,
        headers={"Accept": "application/hal+json"}, timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["token"]


def wait_for_completion(auth, account, report_token, run_token):
    url = f"{MODE_BASE_URL}/{account}/reports/{report_token}/runs/{run_token}"
    deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
    while True:
        response = requests.get(
            url, auth=auth,
            headers={"Accept": "application/hal+json"}, timeout=HTTP_TIMEOUT,
        )
        response.raise_for_status()
        state = response.json()["state"]
        print(f"   state: {state}")
        if state in SUCCESS_STATES:
            return
        if state not in IN_PROGRESS_STATES:
            sys.exit(f"ERROR: run en estat '{state}' (no és èxit).")
        if time.monotonic() >= deadline:
            sys.exit(f"ERROR: timeout esperant el run (>{POLL_TIMEOUT_SECONDS}s).")
        time.sleep(POLL_INTERVAL_SECONDS)


def list_query_runs(auth, account, report_token, run_token):
    url = f"{MODE_BASE_URL}/{account}/reports/{report_token}/runs/{run_token}/query_runs"
    response = requests.get(
        url, auth=auth,
        headers={"Accept": "application/hal+json"}, timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["_embedded"]["query_runs"]


def get_query_results(auth, account, report_token, run_token, query_run_token):
    url = (f"{MODE_BASE_URL}/{account}/reports/{report_token}/runs/{run_token}"
           f"/query_runs/{query_run_token}/results/content.json")
    response = requests.get(
        url, auth=auth,
        headers={"Accept": "application/json"}, timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def get_report_metadata(auth, account, report_token):
    """Get title and basic info for a Mode report."""
    url = f"{MODE_BASE_URL}/{account}/reports/{report_token}"
    response = requests.get(
        url, auth=auth,
        headers={"Accept": "application/hal+json"}, timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    return {"name": data.get("name") or report_token}


def resolve_account(source):
    """Return the Mode account for a source.

    Falls back to the DEFAULT_MODE_ACCOUNT env var when the YAML omits
    `mode_account`. Fails fast if neither is set.
    """
    account = source.get("mode_account") or DEFAULT_MODE_ACCOUNT
    if not account:
        sys.exit("ERROR: source.mode_account no definit i DEFAULT_MODE_ACCOUNT "
                 "env var també buit. Comprova els secrets del workflow.")
    return account


def get_queries(auth, account, report_token):
    """Fetch the list of queries declared on a Mode report.

    Returns a list of dicts with at least `token` and `name`. Used to map
    the stable query tokens from a brief to their (possibly renamed) names,
    so we can identify the right query_runs after a report run.
    """
    url = f"{MODE_BASE_URL}/{account}/reports/{report_token}/queries"
    response = requests.get(
        url, auth=auth,
        headers={"Accept": "application/hal+json"}, timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["_embedded"]["queries"]


def resolve_query_tokens(auth, account, report_token, requested_tokens):
    """Map requested query tokens to their current names in Mode.

    Returns a dict {token: name}. Exits if any requested token is missing
    from the report.
    """
    queries = get_queries(auth, account, report_token)
    by_token = {q["token"]: q["name"] for q in queries}
    missing = [tok for tok in requested_tokens if tok not in by_token]
    if missing:
        available = sorted(f"{q['token']} ({q['name']})" for q in queries)
        sys.exit(
            f"ERROR: query tokens no trobats al report {report_token}: {missing}\n"
            f"  Queries disponibles:\n    - " + "\n    - ".join(available)
        )
    return {tok: by_token[tok] for tok in requested_tokens}


def fetch_source(auth, source):
    """Trigger + poll + fetch for one source.

    Returns (report_title, {query_name: rows}, {query_name: csv_flag}).

    Accepts both the new query shape ({token, csv}) and the legacy
    bare-string shape (treated as csv=False).
    """
    account = resolve_account(source)
    report_token = source["mode_report_token"]

    requested_tokens = []
    csv_by_token = {}
    for q in source["queries"]:
        if isinstance(q, str):
            requested_tokens.append(q)
            csv_by_token[q] = False
        else:
            requested_tokens.append(q["token"])
            csv_by_token[q["token"]] = bool(q.get("csv", False))

    meta = get_report_metadata(auth, account, report_token)
    title = meta["name"]

    print(f"-> [{title}] Resolent {len(requested_tokens)} query token(s)...")
    token_to_name = resolve_query_tokens(auth, account, report_token, requested_tokens)
    for tok, name in token_to_name.items():
        print(f"     {tok} → \"{name}\"")
    desired = set(token_to_name.values())
    csv_by_name = {token_to_name[t]: csv_by_token[t] for t in requested_tokens}

    print(f"-> [{title}] Disparant run del report '{report_token}'...")
    run_token = trigger_report(auth, account, report_token)
    print(f"   run_token: {run_token}")

    print(f"-> [{title}] Esperant completion (poll cada {POLL_INTERVAL_SECONDS}s)...")
    wait_for_completion(auth, account, report_token, run_token)
    print(f"-> [{title}] Run completat.")

    query_runs = list_query_runs(auth, account, report_token, run_token)
    selected = [qr for qr in query_runs if qr.get("query_name") in desired]
    missing = desired - {qr.get("query_name") for qr in selected}
    if missing:
        sys.exit(f"ERROR: query_runs no trobats a '{title}': {sorted(missing)}")

    results = {}
    for qr in selected:
        name = qr["query_name"]
        if qr["state"] not in SUCCESS_STATES:
            sys.exit(f"ERROR: query '{name}' en state '{qr['state']}'.")
        print(f"   fetching '{name}'...")
        rows = get_query_results(auth, account, report_token, run_token, qr["token"])
        results[name] = rows
        print(f"     {len(rows)} files")

    return title, results, csv_by_name


def build_user_message(sources_data):
    """sources_data is list of (source_dict, report_title,
    {query_name: rows}, {query_name: csv_flag}).

    Data is serialised as compact JSON (no whitespace) to minimise the token
    count sent to the LLM. Modern LLMs parse compact JSON without trouble; the
    indent was purely cosmetic and was costing ~25-35% extra tokens per call.
    The saved JSON file (out/<slug>.raw.json) keeps indent for human readability.
    """
    parts = [f"Today's date: {date.today().isoformat()}", ""]
    for _source, title, results, _csv_by_name in sources_data:
        for query_name, rows in results.items():
            parts.append(f'## Query: "{query_name}" (from report "{title}")')
            parts.append("```json")
            parts.append(json.dumps(
                rows,
                ensure_ascii=False,
                default=str,
                separators=(",", ":"),
            ))
            parts.append("```")
            parts.append("")
    return "\n".join(parts)


def generate_brief(prompt, user_message):
    """Call the LLM and return (content, usage).

    usage is a dict {"input": int, "output": int, "total": int}; the
    values come from response.usage when the provider exposes it,
    otherwise zeros so downstream code can still serialise it.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        sys.exit("ERROR: GROQ_API_KEY no definit. Comprova .env (local) o secrets (CI).")
    client = Groq(api_key=api_key, timeout=LLM_TIMEOUT)
    response = client.chat.completions.create(
        model=LLM_MODEL,
        temperature=LLM_TEMPERATURE,
        max_tokens=LLM_MAX_TOKENS,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_message},
        ],
    )
    raw_usage = getattr(response, "usage", None)
    input_tokens = int(getattr(raw_usage, "prompt_tokens", 0) or 0)
    output_tokens = int(getattr(raw_usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(raw_usage, "total_tokens", 0) or 0) \
        or (input_tokens + output_tokens)
    usage = {
        "input": input_tokens,
        "output": output_tokens,
        "total": total_tokens,
    }
    return response.choices[0].message.content, usage


def markdown_to_slack(text):
    """Converteix markdown estàndard al format mrkdwn de Slack.

    - ## Header  → *Header*    (Slack no té headers; converteix a bold)
    - **bold**   → *bold*      (Slack fa servir un sol asterisc)
    """
    text = re.sub(r"^#{1,6}\s+(.+)$", r"*\1*", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
    return text


def get_slack_client():
    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        sys.exit("ERROR: SLACK_BOT_TOKEN no definit. Comprova .env (local) "
                 "o secrets (CI).")
    return WebClient(token=token, timeout=SLACK_TIMEOUT)


def rows_to_csv(rows):
    """Serialise a list of dicts to CSV text.

    Returns empty string for empty input. Column order is taken from the
    first row's keys. Extra keys in later rows are silently dropped (defensive
    against mismatched schemas).
    """
    if not rows:
        return ""
    buffer = io.StringIO()
    writer = csv_module.DictWriter(
        buffer,
        fieldnames=list(rows[0].keys()),
        extrasaction="ignore",
    )
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def slugify_for_filename(text):
    return re.sub(r"[^A-Za-z0-9_-]+", "_", text).strip("_") or "data"


def post_brief_to_slack(brief, sources_data, brief_text):
    """Post the brief to Slack and optionally attach CSVs as a thread reply.

    Uses chat.postMessage for the main message (Bot Token required) and
    files_upload_v2 for the CSV attachments.
    """
    channel = brief.get("slack_channel")
    if not channel:
        sys.exit("ERROR: el brief no té camp 'slack_channel'.")

    client = get_slack_client()
    formatted = markdown_to_slack(brief_text)
    today_str = date.today().strftime("%d/%m/%Y")
    body = f"📊 *{brief['name']} — {today_str}*\n\n{formatted}"

    print(f"-> Postejant a #{channel}...")
    response = client.chat_postMessage(channel=channel, text=body)
    thread_ts = response["ts"]
    # Slack returns the resolved channel ID even when we pass a channel name.
    # files_upload_v2 (via files.completeUploadExternal) only accepts IDs.
    channel_id = response["channel"]
    print(f"   ✓ missatge postejat (channel_id={channel_id}, ts={thread_ts})")

    today_iso = date.today().isoformat()
    csv_queue = []
    for _source, _title, results, csv_by_name in sources_data:
        for query_name, rows in results.items():
            if csv_by_name.get(query_name):
                csv_queue.append((query_name, rows))

    if not csv_queue:
        return

    print("-> Pujant CSVs com a thread replies...")
    for query_name, rows in csv_queue:
        if not rows:
            print(f"   - {query_name}: 0 files, omès")
            continue
        csv_content = rows_to_csv(rows)
        filename = f"{slugify_for_filename(query_name)}_{today_iso}.csv"
        client.files_upload_v2(
            channel=channel_id,
            thread_ts=thread_ts,
            content=csv_content,
            filename=filename,
            title=query_name,
        )
        print(f"   ✓ {filename} ({len(rows)} files)")


def save_artifacts(brief, brief_path, sources_data, brief_text):
    OUT_DIR.mkdir(exist_ok=True)
    slug = brief_slug_from_path(brief_path)
    raw = {
        "brief": brief["name"],
        "generated_at": date.today().isoformat(),
        "sources": [
            {
                "mode_account": resolve_account(source),
                "mode_report_token": source["mode_report_token"],
                "report_title": title,
                "queries": results,
            }
            for source, title, results, _csv_by_name in sources_data
        ],
    }
    (OUT_DIR / f"{slug}.raw.json").write_text(
        json.dumps(raw, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    (OUT_DIR / f"{slug}.brief.md").write_text(brief_text, encoding="utf-8")


def brief_slug_from_path(brief_path):
    """Filename-based slug for execution artifacts.

    The slug used for out/<slug>.run.json (and <slug>.raw.json /
    <slug>.brief.md) is derived from the brief YAML's filename, NOT from
    brief["name"]. Reason: filenames are stable across renames, while
    brief.name can be edited freely from the web app. The web app's
    /api/runs/[brief] looks up artifacts using the same filename slug,
    so the two sides stay aligned.
    """
    return Path(brief_path).stem


def write_run_record(brief, brief_path, state):
    """Write the per-execution status JSON read later by the web app.

    The web app (task 4.6) fetches the most recent artifact named
    run-<filename-slug>-* or runs-due-* and parses this file to render
    the ExecutionMetadata card. Schema must stay stable.
    """
    OUT_DIR.mkdir(exist_ok=True)
    slug = brief_slug_from_path(brief_path)
    record = {
        "brief": brief["name"],
        "started_at": state["started_at"],
        "finished_at": state["finished_at"],
        "status": state["status"],
        "tokens": state["tokens"],
        "error": state["error"],
    }
    (OUT_DIR / f"{slug}.run.json").write_text(
        json.dumps(record, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/executor.py <brief.yml>")
    brief_path = sys.argv[1]

    started_at = datetime.now(timezone.utc).isoformat()

    # Load brief before opening the try/finally: if the YAML is unreadable
    # or invalid we can't derive a slug, so the run.json can't be written
    # anyway. Let load_brief()'s sys.exit propagate.
    brief = load_brief(brief_path)

    state = {
        "started_at": started_at,
        "finished_at": None,
        "status": "failed",
        "tokens": None,
        "error": "unknown failure before completion",
    }

    try:
        print("=" * 70)
        print(f"BRIEF: {brief['name']}")
        print("=" * 70)

        auth = load_credentials()

        sources_data = []
        for source in brief["sources"]:
            title, results, csv_by_name = fetch_source(auth, source)
            sources_data.append((source, title, results, csv_by_name))

        print(f"-> Generant brief amb {LLM_MODEL}...")
        user_message = build_user_message(sources_data)
        brief_text, usage = generate_brief(brief["prompt"], user_message)
        state["tokens"] = usage
        print(
            f"   tokens: input={usage['input']} output={usage['output']} "
            f"total={usage['total']}"
        )

        save_artifacts(brief, brief_path, sources_data, brief_text)

        print("")
        print("=" * 70)
        print("OUTPUT")
        print("=" * 70)
        print(brief_text)
        print("=" * 70)
        print("")

        post_brief_to_slack(brief, sources_data, brief_text)

        state["status"] = "success"
        state["error"] = None
    except BaseException as exc:
        # Catch BaseException so sys.exit() paths and unexpected errors
        # are both recorded. The exception is re-raised in finally's wake
        # so the workflow still exits non-zero.
        msg = str(exc) or repr(exc)
        state["error"] = msg
        raise
    finally:
        state["finished_at"] = datetime.now(timezone.utc).isoformat()
        try:
            write_run_record(brief, brief_path, state)
        except Exception as werr:
            # Don't shadow the original failure if we can't write the record
            print(f"WARNING: no s'ha pogut escriure el run record: {werr}")


if __name__ == "__main__":
    main()
