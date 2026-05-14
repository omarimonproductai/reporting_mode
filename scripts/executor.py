"""Generic executor for Cooltra reporting briefs.

Reads a brief YAML config, triggers each required Mode report, fetches the
specified queries from each, composes a single LLM prompt with all the data,
generates an executive brief, and posts it to Slack via incoming webhook.

Usage:
    python scripts/executor.py briefs/<brief>.yml

The brief YAML schema (see briefs/*.yml for examples):
    name: str
    schedule: cron string                (read by due_runner.py, ignored here)
    slack_channel: str                   (informational; webhook URL from env)
    sources:
      - mode_account: str
        mode_report_token: str
        queries: [str, ...]
    prompt: str                          (multiline, inline)
"""
import json
import os
import re
import sys
import time
from datetime import date
from pathlib import Path

import requests
import yaml
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

# ---- Mode ----
MODE_BASE_URL = "https://app.mode.com/api"
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
SLACK_TIMEOUT = 10

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


def fetch_source(auth, source):
    """Trigger + poll + fetch for one source.

    Returns (report_title, dict {query_name: rows}).
    """
    account = source["mode_account"]
    report_token = source["mode_report_token"]
    desired = set(source["queries"])

    meta = get_report_metadata(auth, account, report_token)
    title = meta["name"]

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
        sys.exit(f"ERROR: queries no trobades a '{title}': {sorted(missing)}")

    results = {}
    for qr in selected:
        name = qr["query_name"]
        if qr["state"] not in SUCCESS_STATES:
            sys.exit(f"ERROR: query '{name}' en state '{qr['state']}'.")
        print(f"   fetching '{name}'...")
        rows = get_query_results(auth, account, report_token, run_token, qr["token"])
        results[name] = rows
        print(f"     {len(rows)} files")

    return title, results


def build_user_message(sources_data):
    """sources_data is list of (source_dict, report_title, {query_name: rows})."""
    parts = [f"Today's date: {date.today().isoformat()}", ""]
    for source, title, results in sources_data:
        for query_name, rows in results.items():
            parts.append(f'## Query: "{query_name}" (from report "{title}")')
            parts.append("```json")
            parts.append(json.dumps(rows, indent=2, ensure_ascii=False, default=str))
            parts.append("```")
            parts.append("")
    return "\n".join(parts)


def generate_brief(prompt, user_message):
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
    return response.choices[0].message.content


def markdown_to_slack(text):
    """Converteix markdown estàndard al format mrkdwn de Slack.

    - ## Header  → *Header*    (Slack no té headers; converteix a bold)
    - **bold**   → *bold*      (Slack fa servir un sol asterisc)
    """
    text = re.sub(r"^#{1,6}\s+(.+)$", r"*\1*", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
    return text


def send_to_slack(brief_name, brief_text):
    webhook = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook:
        sys.exit("ERROR: SLACK_WEBHOOK_URL no definit.")
    formatted = markdown_to_slack(brief_text)
    today_str = date.today().strftime("%d/%m/%Y")
    body = f"📊 *{brief_name} — {today_str}*\n\n{formatted}"
    response = requests.post(
        webhook, json={"text": body}, timeout=SLACK_TIMEOUT,
    )
    response.raise_for_status()
    return response.status_code


def save_artifacts(brief, sources_data, brief_text):
    OUT_DIR.mkdir(exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", brief["name"].lower()).strip("-")
    raw = {
        "brief": brief["name"],
        "generated_at": date.today().isoformat(),
        "sources": [
            {
                "mode_account": source["mode_account"],
                "mode_report_token": source["mode_report_token"],
                "report_title": title,
                "queries": results,
            }
            for source, title, results in sources_data
        ],
    }
    (OUT_DIR / f"{slug}.raw.json").write_text(
        json.dumps(raw, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    (OUT_DIR / f"{slug}.brief.md").write_text(brief_text, encoding="utf-8")


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/executor.py <brief.yml>")
    brief_path = sys.argv[1]
    brief = load_brief(brief_path)

    print("=" * 70)
    print(f"BRIEF: {brief['name']}")
    print("=" * 70)

    auth = load_credentials()

    sources_data = []
    for source in brief["sources"]:
        title, results = fetch_source(auth, source)
        sources_data.append((source, title, results))

    print(f"-> Generant brief amb {LLM_MODEL}...")
    user_message = build_user_message(sources_data)
    brief_text = generate_brief(brief["prompt"], user_message)

    save_artifacts(brief, sources_data, brief_text)

    print("")
    print("=" * 70)
    print("OUTPUT")
    print("=" * 70)
    print(brief_text)
    print("=" * 70)
    print("")

    print(f"-> Enviant a Slack...")
    status = send_to_slack(brief["name"], brief_text)
    print(f"   ✓ enviat (status {status})")


if __name__ == "__main__":
    main()
