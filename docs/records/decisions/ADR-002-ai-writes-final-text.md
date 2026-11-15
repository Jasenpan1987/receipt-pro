# ADR-002: The AI Writes the Final Output Text

**Date:** 2026-11-15
**Status:** accepted
**Decision makers:** Builder
**Supersedes:** none

## Context

The output must be plain text in one fixed shape, with nothing added, because it is pasted
straight into Word. Two designs were on the table:

1. The AI extracts structured fields; code renders them into the template. The AI cannot add stray words.
2. The AI writes the final text itself, following the template, the word list, and the custom instructions.

Claude recommended design 1 for its guarantee of a fixed shape.

## Decision

Design 2. The AI writes the final output text.

## Consequences

- Presentation rules live in the user's settings, not in code. Example: whether a discount is shown as `-5` or folded into `啤酒 2 个 15` is a custom instruction the builder changes at will.
- Nothing in code guarantees the fixed shape. The prompt must hold the AI to it, and any stray words reach the user. The deferred checker AI (`docs/knowledge/project.md#out-of-scope-for-the-mvp`) is the planned safeguard; until then, the guarantee is only as strong as the prompt.
- "Add rule" can change output style without a code change or deployment.

## Alternatives Considered

- **Design 1, code renders the text.** Guarantees the shape, but every new presentation rule needs a code change. Rejected: the builder wants to change rules daily, in plain language.

## Evidence

- `docs/records/meetings/2026-11-15_mvp-ideation-interview.md`
