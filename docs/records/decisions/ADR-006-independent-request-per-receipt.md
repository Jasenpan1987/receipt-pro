# ADR-006: Each Receipt Is an Independent AI Request

**Date:** 2026-11-15
**Status:** accepted
**Decision makers:** Builder (accepted Claude's proposal)
**Supersedes:** none

## Context

A session can hold many receipts. One option is to send each new photo inside an ongoing
conversation that includes earlier photos and outputs, so the model "remembers" corrections.
The other is to send each photo on its own.

## Decision

Every receipt is one independent request containing only:

1. The fixed output rules.
2. The user's settings: template, word list, custom instructions.
3. That one photo.

No earlier receipts, outputs, or conversation are sent. Corrections persist as rules in the
user's settings, which every request carries. The Add rule dialog may hold its own short
conversation while it is open; only the confirmed rule survives it.

## Consequences

- Consistency comes from the template and rules, which are identical for every receipt.
- Less pull toward chat-style replies, the failure the builder most wants to avoid (`docs/work/mvp/requirements.md#s-03-generate-the-output-text`).
- Cost per receipt stays flat. With history, the 50th receipt would resend the previous 49.
- One misread cannot leak into the next receipt.
- Regenerate is a clean rerun of the same input.
- A correction that the builder does not turn into a rule is not remembered. A per-receipt Add rule entry would make that easier; it is deferred until real use shows it is needed.

## Alternatives Considered

- **Send the session's conversation with each photo.** The model could pick up corrections implicitly, but cost grows with every receipt, errors propagate, chatty replies become likelier, and the remembered corrections are invisible and cannot be deleted.

## Evidence

- `docs/records/meetings/2026-11-15_ai-calls-and-rules-design.md`
