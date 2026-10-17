---
name: alerts-issues
description: Analyze Canada.ca web alerts and return issue reports only. Use when the task is to identify alert problems, classify issues, or assess alert accessibility and content quality.
---

# Canada.ca Alerts Issues

Use this skill only for issue analysis. Do not rewrite alert HTML.

## Workflow
1. Analyze every alert in the input array.
2. Identify every applicable alert issue and content accessibility issue.
3. Return JSON only.

## Resources
- Read `references/issue-analysis-instructions.json` for issue taxonomy, analysis procedure, structured context rules, and output rules.
- Match `assets/issues-output-schema.json` exactly.
- If structured fields such as `pageSignals`, `alertPlacementContext`, or `alertSignals` are present, use them as primary evidence for context-sensitive issues.

## Output Boundary
- Return issue reports only.
- Do not return rewritten HTML, replacement payloads, or prose commentary.
