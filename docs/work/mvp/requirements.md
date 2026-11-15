# MVP Requirements

> **Version:** 1.2 · **Date:** 2026-11-15 · **Status:** reviewed by the builder
> **Epic:** `docs/work/mvp/README.md` · **Gaps:** `docs/work/mvp/gaps.md`

## What This Delivers and Why

The capture-to-copy loop: photograph a receipt on a phone, get one line of plain text in the
builder's own format, copy it on a computer, paste it into Word. It replaces typing each
receipt by hand when tracking personal spending.
(source: `docs/knowledge/project.md`)

## Background

- Product scope, principles, and delivery order: `docs/knowledge/project.md`
- Behaviour rules this spec turns into stories: `docs/knowledge/business.md`
- Terms: `docs/knowledge/glossary.md`
- Settled technology: `docs/knowledge/tech-conventions.md`
- Decisions: `docs/records/decisions/ADR-001-deepseek-for-receipt-reading.md`, `docs/records/decisions/ADR-002-ai-writes-final-text.md`

## Users

One user: the builder. Two devices at the same time:

| Device                                           | What the user does there                              |
| ------------------------------------------------ | ----------------------------------------------------- |
| Phone (iPhone or Xiaomi), app on the home screen | Take or pick receipt photos; add rules; can also copy |
| Computer, desktop browser                        | Watch receipts arrive; copy the text; paste into Word |

The interface is in Chinese. (source: `docs/records/meetings/2026-11-15_mvp-ideation-interview.md#accepted-in-the-final-restatement`)

## User Stories

### S-01 Log in

As the builder, I log in once on each device and then open the app straight to my receipts.

**When:** the last step before cloud deployment. The local version has no login and uses one
built-in user. All data is stored per user from the first task, so adding login needs no data
migration. (source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)

**Acceptance criteria**

1. The login page asks for a username and a password, and nothing else.
2. A wrong username or password shows a plain message and grants no access.
3. After login, reopening the app, including from the home screen, does not ask for login again.
4. A log-out action exists. After log-out, the device needs to log in again.
5. Every page and every server action, except the login page, refuses a request that is not logged in. Strangers who find the URL cannot use the DeepSeek balance.
6. There is no sign-up page. The one account is created by the builder outside the app.

**Edge cases**

- Login lasts 30 days and renews each time the app is used. (source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)
- No self sign-up in the MVP, because a public sign-up page would let anyone spend the builder's DeepSeek balance. (source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)

### S-02 Capture a receipt

As the builder, I take a photo of a receipt, or pick one from my photo library, and it starts processing.

**Acceptance criteria**

1. On the phone, the user can take a photo with the camera or pick one from the library.
2. One photo is one receipt.
3. Photos from the default camera settings of an iPhone and of a Xiaomi phone both work, whatever file format the phone saves them in.
4. As soon as a photo is submitted, a new receipt appears at the top of the list in a "processing" state.
5. If the upload fails, the user sees a plain message and can try again without leaving the screen.

**Edge cases**

- A large photo on a slow mobile connection still uploads, or fails with the message in criterion 5. It never hangs without feedback.
- A long receipt that does not fit in one photo is out of scope; the photo is processed as given.

### S-03 Generate the output text

As the builder, I get exactly the text my template describes, and nothing else.

**Acceptance criteria**

1. The output follows the user's template, word list, and custom instructions as they were when processing started.
2. The output contains only the receipt text. No greeting, no explanation, no conversational text such as "OK, this one is done, please send the next one". (source: `docs/records/meetings/2026-11-15_mvp-ideation-interview.md#follow-up-same-session`)
3. The amount after `共` is the total printed on the receipt.
4. Merchant names stay in the original language unless the word list maps them. Example: `Coles` → `红超市`; `Costco` stays `Costco`.
5. Item names are in Chinese, unless the word list says otherwise.
6. Discounts are visible in the output, written the way the custom instructions say.
7. If the user has no template yet, the builder's usual template (`docs/knowledge/business.md#output`) is used and saved to their settings. (Changed by the builder on 2026-11-15; it was: the first output becomes the template.)
8. Unreadable content follows the three rules in `docs/knowledge/business.md#unreadable-receipts`:
   - Whole receipt or most of it unreadable: only `看不清，请重拍`, and no copy button.
   - One item unreadable: `？？看不清` in its place.
   - Price unreadable: `<name> 价格？？看不清`.
9. If the AI call fails (network, timeout, empty DeepSeek balance), the receipt shows a plain failure message, no copy button, and the Regenerate button.
10. Chinese characters are never garbled, in the app or after copying.

**Edge cases**

- A photo that is not a receipt is treated as unreadable: `看不清，请重拍`.
- The same template run on 20 different receipts gives 20 outputs of the same shape.

### S-04 Copy the text

As the builder, I tap once and paste the text into Word.

**Acceptance criteria**

1. Each receipt with output text has a copy button.
2. One tap copies exactly the output text: no extra spaces, line breaks, or formatting.
3. The app confirms the copy with a short visible message.
4. Pasted into Word on the computer, the text is identical to what the app shows, Chinese included.
5. Copy works on the computer browser and on the phone.

**Edge cases**

- The computer is a Mac running Chrome or Safari. (source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)

### S-05 See receipts on every device

As the builder, I take a photo on the phone and see it on the computer without touching the computer.

**Acceptance criteria**

1. A receipt created on one device appears on every other logged-in device within 5 seconds, with no manual refresh.
2. Status changes reach every device the same way: processing, done, failed, regenerating.
3. Each receipt shows its photo (a thumbnail that can be opened larger) and its output text.
4. A computer tab left open for 8 hours still receives new receipts.
5. Opening the app on any device shows the current session's receipts, newest first.

### S-06 Sessions

As the builder, I keep working on one batch of receipts until I decide to start a new one.

**Acceptance criteria**

1. Receipts stay in the session across app restarts, device restarts, and days, until the user taps **New session**.
2. **New session** asks for confirmation, then clears the receipts on every device.
3. Clearing a session deletes its photos from storage.
4. Settings are not affected by **New session**.
5. If a session grows beyond what the system can handle, the app asks the user, in plain words, to start a new session. No fixed limit is shown before that point. See G-003.

**Edge cases**

- **New session** asks for confirmation, because one accidental tap would lose a batch nobody has pasted yet. (source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)

### S-07 Regenerate

As the builder, I run a receipt again when the result looks wrong.

**Acceptance criteria**

1. Every receipt has a **Regenerate** button, including failed and unreadable ones.
2. Regenerate uses the same photo and the user's current settings.
3. While regenerating, every device shows that receipt as "regenerating".
4. The new text replaces the old text. (source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)

### S-08 Add a rule

As someone with no technical background, I tell the app a rule in plain words and it follows it from the next receipt on.

**Acceptance criteria**

1. An **Add rule** button is reachable from the receipt list in one tap.
2. It opens a text box for plain-language input. No prompt text, code, or field names are shown.
3. After the user submits, the AI replies in plain words with how it understood the rule and which kind it is: an output change (template or custom instructions) or a word-list entry.
4. Nothing is saved until the user confirms. Cancelling saves nothing.
5. The user can paste one or more past outputs, such as `2026 年 10 月 1 日 Costco 青菜 3.25 共1234，现金`. The AI summarises them into a template, shows it, and saves it only after the user confirms. (source: `docs/records/meetings/2026-11-15_ai-calls-and-rules-design.md`)
6. A saved rule applies to receipts processed after it was saved, and to any receipt that is regenerated. Existing text does not change.
7. Input that is not a rule gets a plain reply saying so, and nothing is saved.
8. Every request that reads a receipt carries all saved rules; no earlier receipts or conversation are sent (ADR-006). (source: `docs/records/meetings/2026-11-15_ai-calls-and-rules-design.md`)

**Edge cases**

- If the AI's summary is not right, the user says so in the same dialog and the AI revises it, until the user confirms or cancels. The dialog's conversation is discarded when it closes; only the confirmed rule is kept. Confirmed by the builder. (source: `docs/records/meetings/2026-11-15_ai-calls-and-rules-design.md`)
- A new rule for the same thing overrides the saved one. Example: `Coles` → `红超市`, later `Coles` → `大红超市`; from then on it is `大红超市`. The confirmation step says which saved rule it replaces. (source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)

### S-09 See and delete rules

As the builder, I can always find my saved rules in the same place and remove one.

**Acceptance criteria**

1. One fixed place in the app lists everything saved: the template, each word-list entry, and each custom instruction, in plain words.
2. Each item can be deleted, after a confirmation.
3. A deletion affects only receipts processed afterwards.
4. If the template is deleted, the next first output becomes the template again (S-03 criterion 7).

## Non-Functional Requirements

| Area        | Requirement                                                                      | Source                                                           |
| ----------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Cost        | No always-on paid resources: when nobody uses the app, it costs close to nothing | `docs/knowledge/project.md#principles`                           |
| Robustness  | A session of 100 receipts stays responsive on phone and computer                 | `docs/knowledge/project.md#principles`                           |
| Robustness  | Long use does not cause lag, breakage, or garbled text                           | `docs/knowledge/project.md#principles`                           |
| Ease of use | Anyone who can take a photo and type can use every feature without help          | `docs/knowledge/project.md#principles`                           |
| Mobile      | Installable to the home screen on iPhone and Xiaomi, opening full screen         | `docs/knowledge/tech-conventions.md`                             |
| Security    | The DeepSeek API key never reaches the browser                                   | `docs/records/decisions/ADR-001-deepseek-for-receipt-reading.md` |
| Privacy     | Receipt photos are deleted when their session is cleared                         | S-06                                                             |
| Language    | All interface text is Chinese                                                    | Interview, accepted restatement                                  |

## Technical Constraints

All from `docs/knowledge/tech-conventions.md`: an isomorphic full-stack framework such as
Next.js, one standalone site, mobile-first PWA, DeepSeek `deepseek-flash` for photos, AWS
Lambda in the builder's account. The local version comes first; login and cloud deployment
follow only after local testing passes (`docs/knowledge/project.md#delivery-order`).

While there is no login, the app is reached only on the home network. No public tunnel. (source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)

## Dependencies

| Dependency                    | Needed for                    | Status                                           |
| ----------------------------- | ----------------------------- | ------------------------------------------------ |
| DeepSeek API key with balance | Every story that calls the AI | The builder has it                               |
| Real receipt photos           | Accuracy testing (G-004)      | The builder will provide them                    |
| AWS account                   | Cloud deployment              | The builder has it                               |
| Domain                        | Cloud deployment              | The builder has it; chosen at deployment (G-005) |

## Out of Scope

- A checker AI that verifies output before the user sees it.
- Long receipts across several photos.
- Voice input.
- A first-run setup page.
- Editing output text inside the app.
- Deleting a single receipt.
- An Add rule entry on each receipt that gives the AI that receipt's text as context. Deferred until real use shows the need. (source: `docs/records/meetings/2026-11-15_ai-calls-and-rules-design.md`) (source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)
- Biometric and Google login; sign-up; multiple users.
- File in, file out.

## Success Measures

1. The builder processes a real evening's receipts end to end: phone photo, computer copy, Word paste.
2. No output ever contains conversational text.
3. Pasted text needs no cleanup apart from the marked `？？看不清` parts and genuine reading errors.
4. Reading accuracy on the builder's test receipts is measured and recorded (G-004).

## Changelog

| Version | Date       | Change                                                                                                                                                               |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-11-15 | First draft from the 2026-11-15 interview                                                                                                                            |
| 1.1     | 2026-11-15 | Builder review: login moves to the last step before cloud; same-thing rules override; all other v1.0 assumptions accepted                                            |
| 1.2     | 2026-11-15 | S-08: template summarised from several pasted outputs; rules carried by every request (ADR-006); dialog revision assumption; per-receipt Add rule entry out of scope |
