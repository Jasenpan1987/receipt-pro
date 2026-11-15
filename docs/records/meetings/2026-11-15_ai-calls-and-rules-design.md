# AI Calls and Rules Design

**Date:** 2026-11-15
**Type:** ad-hoc
**Participants:** Builder (project owner); Claude
**Source:** Discussion in chat. Conducted in Chinese; this record is the English summary.

## Summary

The builder chose the Vercel AI SDK so another model can replace DeepSeek easily. Each receipt
is processed as an independent AI request; corrections carry forward as saved rules, not as
conversation history. Rules and templates are both created through the AI dialog, and a
template can be summarised from several past outputs. A per-receipt "Add rule" entry was
deferred: use the MVP first, then fix the pain points that real use reveals.

## Key Decisions

- **AI library: Vercel AI SDK** — decided by the builder, reason: if DeepSeek disappoints, switching models should be easy. Claude had recommended the `openai` package with a thin wrapper.
- **Each receipt is an independent AI request** with the fixed output rules, the user's settings, and that one photo; no earlier receipts or conversation. Proposed by Claude; the builder raised the concern that a corrected mistake would be forgotten, accepted that corrections persist as rules, and did not object further. See `docs/records/decisions/ADR-006-independent-request-per-receipt.md`.
- **Templates and rules are both made through the AI dialog.** For a template, the builder may paste several past receipt outputs; the AI summarises them into a template and asks the builder to confirm. For a rule, e.g. "from now on every Coles becomes 红超市", the AI states it and the builder confirms. — the builder.
- **No per-receipt "Add rule" entry in the MVP.** Claude proposed one that would give the AI the receipt's text as context. — deferred by the builder.
- **Approach: use first, fix later.** "After we've used it for a while, many design pain points will show up. Solving them then is much better than planning for them now." — the builder.

## Facts Learned

- Vercel AI SDK's DeepSeek provider page and DeepSeek's own docs disagree on whether `deepseek-flash` accepts images. Recorded in `docs/knowledge/tech-conventions.md#conflict-does-deepseek-flash-accept-images-through-the-ai-sdk`; T-002 settles it.

## Open Questions

- [x] If the AI's summary of a template or rule is not right, does the builder correct it in the same dialog until it is, or cancel and start again? Answered in the same session: the same dialog, until the builder confirms or cancels.

## Action Items

- [ ] Claude: update S-08 and the out-of-scope list; record ADR-006.

## New Terms

None.
