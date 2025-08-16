### Stories Folder Guide (Local Synthetic Data & Playbooks)

This document explains the purpose, structure, and recommended usage patterns for the local `Stories/` folder so that current and future agents (human and software) can make effective use of its contents during development.

Note: `Stories/` is intentionally ignored by git to avoid committing potentially sensitive or bulky test data. Keep real PII out of this folder.

---

## Purpose
- Provide realistic, offline datasets and scenarios for developing and evaluating the multi‑agent pipeline (task extraction, project classification, sentiment/blocker detection, question generation, reporting).
- Allow repeatable local tests without relying on live Google Chat or Cloud Run.
- Serve as a scratch area to prepare fixtures for unit/integration tests later.

## High‑Level Contents
- Aggregated CSV exports of check‑ins (global and per‑employee).
- Per‑person folders of Markdown notes representing weekly updates.
- Time‑series analyses in `weekly_analyses/` to benchmark analytics.
- PDF archives of historical weekly updates for regression testing.
- Python utilities to analyze, refine, summarize, and generate timelines.
- Prompt and helper text used to guide generative models.

## Directory Taxonomy (Observed)
- `Stories/Data/<Person>/` — Employee‑specific material
  - `Check-ins <space-hash>_all.csv` and `Check-ins <space-hash>.csv`: CSV exports of that person’s messages.
  - `Check-ins <space-hash>/` — Markdown files, typically one per weekly update or message cluster.
  - May include complementary artifacts (e.g., images or supplemental CSVs).
- `Stories/weekly_analyses/` — Dated `.txt` analyses summarizing a given week.
- `Stories/Weekly Updates_2024/` — Dated `.pdf` exports of weekly updates.
- Top‑level helper scripts (Python):
  - `analyze_*`, `generate_*timeline.py`, `refine_*`, `summarize_*`, `parse_weekly_analysis.py`, etc.
  - `requirements.txt` for Python dependencies.
  - `gemini_prompt.txt` containing prompt patterns.

## Recommended Usage Patterns

### 1) Local Agent Evaluation (No Network)
- Pick a Markdown file from `Stories/Data/<Person>/Check-ins <hash>/...md`.
- Feed its text into the Task Agent and Project Agent to verify:
  - Task extraction quality (titles, statuses, priorities, due dates)
  - Project classification and auto‑creation logic
  - Knowledge gaps identified and questions generated

### 2) Synthetic Webhook Simulation
- Use `messageText` from a `.md` or a CSV row to simulate a webhook call to `/inbound/webhook` in a local dev server.
- Populate `metaIds` (e.g., `spaceName`, `threadName`, `senderEmail`, `senderDisplay`) from the filename or CSV fields.
- Confirm resulting updates and analytics appear in `/dashboard/overview`.

### 3) Analytics Regression
- Compare computed analytics against `Stories/weekly_analyses/*.txt` for the same week to ensure:
  - Total updates, active employees, project activity counts
  - Blocker/positive/negative distributions
  - Top projects and task volumes

### 4) Timeline & Reporting Benchmarks
- Use `generate_*timeline.py` scripts to build a project or presentation timeline from historical inputs.
- Compare Reporting Agent output (summaries/insights) to these generated timelines.

## Suggested Pipelines

### A) CSV → Webhook Mapper (manual outline)
1. Read a CSV row (e.g., per‑person check‑in CSV) using pandas.
2. Construct a form payload:
   - `messageText` = row.text (or concatenation of message snippets)
   - `meta` = JSON with `senderEmail`, `senderDisplay`, `spaceName`, `threadName`, `ts`
3. POST to local `/inbound/webhook` with token header.

### B) MD → Agent Orchestrator
1. Read a `.md` file’s text.
2. Call `/agents/run` with `{ userId, conversationId, messageText }`.
3. Inspect `/agents/debug` or server logs for routing and questions.

## Conventions & Notes
- “`<space-hash>`” is a stable token (hash) corresponding to a space or channel; use it to group messages per context.
- Markdown notes generally contain weekly updates written by the named person; treat them as unstructured text input.
- CSVs may include timestamps, display names, emails, and message content; exact columns can vary between exports.
- PDFs in `Weekly Updates_2024/` are useful for validating OCR or reference summaries (not directly parsed by default).

## Safety & Privacy
- Do not upload `Stories/` contents to any external service without explicit approval.
- Avoid storing real PII; prefer sanitized or synthetic values.
- Keep API keys and secrets out of this folder.

## For Future Automation
- Consider adding a small loader script that:
  - Iterates over `Stories/Data/*/Check-ins */*.md`,
  - Generates batched test cases for agents,
  - Writes results to a local `Stories/.artifacts/` folder (ignored),
  - Compares outputs against `weekly_analyses/` summaries for quick regression checks.


