# ADR-001: Use DeepSeek to Read Receipts

**Date:** 2026-11-15
**Status:** accepted
**Decision makers:** Builder
**Supersedes:** none

## Context

The core of the MVP is one AI call: a receipt photo in, the output text out. The app runs in
the builder's own AWS account, so Claude on Amazon Bedrock was the natural candidate: same
account, same bill, IAM-role access, no API key to manage. Claude recommended it.

## Decision

Use the DeepSeek API. Use `deepseek-flash` for every call that includes a photo.

## Consequences

- The builder already holds a DeepSeek API key with prepaid balance, so there is no new account or bill. This fits the cheapest-solution principle in `docs/knowledge/project.md#principles`.
- The API key must be stored as a secret and kept out of the client. Lambda has no IAM-based access to DeepSeek.
- Only `deepseek-flash` accepts images; `deepseek-v4-pro` does not. Image input details are in `docs/knowledge/tech-conventions.md#deepseek-image-input`.
- Calls leave AWS for DeepSeek's servers. Receipt photos are sent to a third party.
- Accuracy on real receipts is not yet measured. If `deepseek-flash` is not accurate enough, this decision is the one to revisit.

## Alternatives Considered

- **Claude on Amazon Bedrock.** One account and one bill, no key to manage. Rejected by the builder in favour of the existing prepaid DeepSeek balance.
- **Anthropic API directly.** Newest features first, but a separate key and a separate bill. Not chosen.

## Evidence

- `docs/records/meetings/2026-11-15_mvp-ideation-interview.md`
- DeepSeek docs, checked 2026-11-15: `https://api-docs.deepseek.com/quick_start/pricing`, `https://api-docs.deepseek.com/api/create-chat-completion`
