---
name: alerts-rewriting
description: Rewrite Canada.ca web alerts and return corrected output only. Use when the task is to produce updated alert HTML from identified issues.
---

# Canada.ca Alerts Rewriting

Use this skill only for alert rewriting. Do not return issue-analysis payloads.

## Workflow
1. Rewrite each alert based on the provided issues.
2. Keep edits scoped to the alert container.
3. Return JSON only.

## Resources
- Read `references/shared-rewrite-guidance.json` for shared rewrite, style, link, example, and self-check guidance.
- Read `references/rewrite-instructions.json` for the rewrite contract, alert scope, markup rules, and output rules.
- Use `references/examples.json` for pattern guidance only. Do not copy wording.
- Apply the included `link-writing` skill for reusable link-writing rules.
- Match `assets/rewriting-output-schema.json` exactly.

## Source of Truth

For skill-composed alert rewriting, `references/rewrite-instructions.json`
and `assets/rewriting-output-schema.json` define the primary contract.
`references/shared-rewrite-guidance.json` defines the shared behavioural
guidance used by both the skill contract and the current AIDA runtime.

`references/runtime-rewrite-rules.json` is retained for the current AIDA
alert rewrite service, which uses a custom per-alert prompt, parser, retry,
and repair flow. Treat it as runtime-specific support, not as the general
skill contract.

## Output Boundary
- Return rewrite payloads only.
- Do not return issue-analysis payloads or prose commentary.
