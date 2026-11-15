# Project

> **Purpose:** What receipt-pro is, for whom, and what is in and out of scope.
> **Status:** Current
> **Verified against:** Builder interview, 2026-11-15
> **Primary code:** none yet

## Summary

receipt-pro turns a photo of a till receipt into one fixed line of plain text. The builder
takes the photo on a phone, then copies the text on a computer and pastes it into Word to
track personal spending. It is a personal project. It runs in
the builder's own AWS account on the builder's own domain. Today there is one user: the
builder. (source: `docs/records/meetings/2026-11-15_mvp-ideation-interview.md`)

## MVP Scope

The capture-to-copy loop:

1. Log in with a username and password.
2. Take a photo of a receipt, or pick one from the photo library.
3. The AI writes the output text from the builder's template, word list, and custom instructions.
4. The receipt and its text appear on every logged-in device, phone and desktop.
5. Copy the text with one tap.

Also in the MVP: "Add rule" in plain language, "Regenerate", and manual sessions. The rules
for each are in `docs/knowledge/business.md`.

## Delivery Order

1. A local version that runs and passes local testing. It has no login and is reached only on the home network.
2. Login, as the last step before the cloud.
3. Deployment to the builder's AWS account and domain. The domain is chosen at this step.

(source: `docs/records/meetings/2026-11-15_mvp-ideation-interview.md#follow-up-same-session`, `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)

## Out of Scope for the MVP

- A checker AI that verifies output before the user sees it.
- Long receipts across several photos.
- Voice input (the builder uses other software for speech-to-text).
- A first-run setup page.
- Editing the output text inside the app.
- Biometric or Google login.
- Multiple users.

## Future Direction

- File in, file out: the app edits a file the builder provides and returns it.
- Multiple users, each with their own template, output style, translation preferences, and target language.
- The checker AI (the builder calls it 审核官). First experiment when it is added: Jev, a judgement model that checks values against the photo; its image support is still preview. See `docs/records/investigations/2026-11-15_jev-as-receipt-checker.md`.

## Principles

These decide trade-offs when requirements do not.

1. **Cheapest solution that works.** It runs on the builder's own money.
2. **Practical and robust.** Not built for its own sake. Long use must not make it lag, break, or show garbled text.
3. **No barrier to use.** Anyone who can take a photo and type can use it, with no technical background and no AI experience.
4. **Use first, fix later.** Ship the MVP, use it for a while, and solve the design pain points real use reveals, rather than planning for them in advance. (source: `docs/records/meetings/2026-11-15_ai-calls-and-rules-design.md`)
