# Business Rules

> **Purpose:** How receipt-pro behaves for the user: the workflow, the output, settings, rules, and sessions.
> **Status:** Current
> **Verified against:** Builder interview, 2026-11-15
> **Primary code:** none yet

## Summary

A receipt photo goes in; one line of plain text comes out, in the user's template. Settings
(template, word list, custom instructions) belong to the user and persist. Receipts belong
to a session, which the user ends manually. All rules below come from
`docs/records/meetings/2026-11-15_mvp-ideation-interview.md` unless another source is named.
Terms are defined in `docs/knowledge/glossary.md`.

## Workflow

1. The user is logged in on a phone and a computer. Each device logs in once and stays logged in.
2. On the phone, the user takes a photo or picks one from the library. One photo is one receipt.
3. The AI reads the photo and writes the output text.
4. Within seconds, the receipt appears on every device in the current session, with its photo, its text, and a copy button. No manual refresh.
5. On the computer, the user taps copy and pastes into Word.

## Output

- Plain text only. Exactly the template's shape, with nothing added before or after.
- No conversational text, ever. Example of what must never appear: "OK, this one is done, please send the next one." Anything like it breaks the paste into Word.
- The template and the output format are the same thing.
- The builder's usual template, by example: `2026 年 10 月 1 日 Costco 青菜 3.25 水 2.0 啤酒 10.0 共1234，现金`.
- `共` is followed by the total printed on the receipt, not a computed sum.
- Merchant names stay in the original language unless the word list maps them. `Coles` → `红超市`; `Costco` stays `Costco`.
- Item names are translated into Chinese by default; a word-list entry overrides the default translation.
- Discounts must be visible in the output. How they are written is a custom instruction, not fixed behaviour.
- If no template exists yet, the builder's usual template above is saved as the template on first use, not the first output: the first output carries that receipt's items and any slip into every later receipt (builder, 2026-11-15).

Every field has one way to be written, so outputs never mix styles (builder, 2026-11-15, after reviewing real outputs that mixed `现金` and `CASH`):

- **Payment method:** only `现金` or `刷卡`. Cash is `现金`; anything else (any card, EFTPOS, Apple Pay) is `刷卡`. Loyalty cards printed on the receipt (Flybuys) are not a payment method.
- **Merchant:** the short name people use, without `Pty Ltd`, branch, or address. A receipt with a Chinese store name uses only the Chinese name (`佳旺超市`, `牛车水`); otherwise the short English name (`Coles`, `Bunnings`).
- **Items:** one short Chinese name each, no brand, size, weight, count, or unit price; one name only, no alternatives after a slash. The amount is the line's total.
- **All Chinese in simplified characters**, even when the receipt prints traditional ones.
- **Amounts** as printed, no currency symbol. Not written: loyalty points, total savings, GST, change.
- A word-list entry or custom instruction overrides the merchant, item, and payment rules. An unknown brand (`V BLUE`, an energy drink) is a word-list entry, not a prompt change.

## Unreadable Receipts

Output everything that can be read. Mark what cannot:

| Situation                                        | Output                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| The whole receipt, or most of it, cannot be read | Only `看不清，请重拍` ("can't read it, please retake"); no text to copy |
| One item cannot be read at all                   | `？？看不清` in that item's place                                       |
| The item name can be read, the price cannot      | The name, then `价格？？看不清`, e.g. `西红柿 价格？？看不清`           |

## Settings and Rules

Settings belong to the user, not the session, and persist until changed:

- **Template:** the output shape.
- **Word list:** preferred names and translations.
- **Custom instructions:** plain-language processing rules.

The user changes settings with **Add rule**: a button that opens a text box where the user
states a rule in plain language. The AI decides whether the rule changes the output (template
or custom instructions) or adds a word-list entry. Before saving, the AI shows how it
understood the rule and the user confirms. For a template, the user can paste several past
outputs and the AI summarises them into one template. Settings must never require editing raw prompts.

Saved rules have one fixed place in the app where the user can see every rule and delete any
of them.

A new rule for the same thing overrides the saved one. `Coles` → `红超市`, later
`Coles` → `大红超市`: from then on it is `大红超市`.
(source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)

A new rule applies only to receipts processed after it is added, and to any receipt the user
regenerates. Existing text is not changed automatically.

Each receipt is read in its own request, carrying all saved rules and no earlier receipts
(ADR-006). A correction is remembered only if it becomes a rule.

## Regenerate

Each receipt has a **Regenerate** button. It runs the same photo through the AI again with the
current settings. The new text replaces the old text. If the photo itself is bad, the user retakes it instead, which creates a new
receipt.

## Sessions

- A session is a server-side batch of receipts, shared by all of the user's devices.
- Receipts stay until the user taps **New session** and confirms. That clears them, photos included, on every device.
- There is no fixed limit. Only if the system cannot cope with a session's size does it ask the user to start a new one.
- Output text cannot be edited inside the app.

## Login

Username and password, added as the last step before cloud deployment. No sign-up page; the
one account is created outside the app. A device stays logged in for 30 days, renewed on use.
The local version has no login and uses one built-in user.
(source: `docs/records/meetings/2026-11-15_mvp-requirements-review.md`)
