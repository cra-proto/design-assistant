# AWS-AIDA skills

AWS-AIDA skills follow a small, portable package format inspired by the Claude skills model.

Each skill directory contains:

- `SKILL.md`: concise purpose, boundaries, workflow, and resource guidance. Keep this file short; detailed rules belong in references.
- `skill.json`: machine-readable dependencies and resource paths.
- `references/`: detailed instructions, taxonomies, examples, or reusable guidance.
- `assets/`: output schemas or fixed templates.

## `skill.json`

```json
{
  "id": "example-skill",
  "includes": [],
  "references": ["references/instructions.json"],
  "optionalReferences": [],
  "assets": ["assets/output-schema.json"],
  "outputModes": ["json"]
}
```

Identifiers use lowercase kebab-case. Resource paths are relative to the skill directory and cannot leave it. Supported output modes are `any`, `html`, `json`, and `text`.

`public/skills/manifest.json` is generated. Do not edit it directly.

Paths in the generated manifest are relative to the manifest's directory.

Run `npm run skills:generate` after changing a skill package. Run `npm run skills:check` to validate packages and confirm that the manifest is current.
