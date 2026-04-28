# MTUCI Guesser - Master Backlog for Labs 1-6

## Purpose

This folder contains an execution-ready backlog for all 6 laboratory works with:
- clear scope and boundaries per lab;
- ordered and non-conflicting tasks;
- Cursor-oriented prompts and working instructions;
- report requirements for each lab.

## Mandatory Global Rules (for all labs)

1. Preserve existing game functionality (`play`, `play360`, leaderboard, duel, account).
2. New security features must not reduce baseline UX:
   - if action is denied, show a clear user-friendly message;
   - do not crash UI on `401/403/404/500`.
3. Keep changes incremental:
   - one logical feature branch per lab;
   - smoke-check after each major subtask.
4. Do not rely on hardcoded admin checks by email.
5. Every backend access restriction must be duplicated in backend checks (not frontend-only).
6. Every lab must end with:
   - acceptance checklist;
   - test protocol;
   - report draft.

## Recommended Execution Order

1. `LAB1_RBAC.md`
2. `LAB2_AUTH_TOKENS.md`
3. `LAB3_FILTERS_CRUD_STORAGE.md`
4. `LAB4_SEO_EXTERNAL_API.md`
5. `LAB5_TESTING.md`
6. `LAB6_CONTAINERIZATION_CICD.md`

## "No Contradictions" Contract Between Labs

- Lab 1 defines access model (roles/permissions). Labs 2-6 use it unchanged unless explicitly versioned in report.
- Lab 2 changes auth mechanism (tokens) but must preserve RBAC behavior from Lab 1.
- Lab 3 extends data flows (filters/CRUD/files) and must obey auth + RBAC from Labs 1-2.
- Lab 4 adds SEO + external API without changing core game rules and scoring logic.
- Lab 5 validates all previous labs using reproducible tests.
- Lab 6 packages and automates deployment of the system built in Labs 1-5.

## Folder Content

- `LAB1_RBAC.md` - Lab 1 backlog, prompts, report plan.
- `LAB2_AUTH_TOKENS.md` - Lab 2 backlog, prompts, report plan.
- `LAB3_FILTERS_CRUD_STORAGE.md` - Lab 3 backlog, prompts, report plan.
- `LAB4_SEO_EXTERNAL_API.md` - Lab 4 backlog, prompts, report plan.
- `LAB5_TESTING.md` - Lab 5 backlog, prompts, report plan.
- `LAB6_CONTAINERIZATION_CICD.md` - Lab 6 backlog, prompts, report plan.
- `REPORT_TEMPLATE.md` - common report template for all labs.

## How to Work with Cursor

For each lab:
1. Open the corresponding `LAB*.md`.
2. Execute tasks in listed order only.
3. Use prompts from "Cursor Prompts" section.
4. After each milestone, run the lab acceptance checklist.
5. Fill report sections using `REPORT_TEMPLATE.md`.

## Definition of Success

All 6 labs are completed with:
- consistent implementation across frontend/backend/infrastructure;
- preserved or improved gameplay;
- clear, evidence-based reports for each lab.
