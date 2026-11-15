# MVP Ideation Interview

**Date:** 2026-11-15
**Type:** ideation
**Participants:** Builder (project owner); Claude (interviewer, OMT Interview)
**Source:** Interview with the builder, provided in chat. Conducted in Chinese; this record is the English summary.

## Summary

The builder described receipt-pro: a personal, mobile-first web app that turns a photo of a
receipt into one fixed line of plain text, which the builder copies on a computer and pastes
into Word to track personal spending. The MVP is the photo-in, text-out, copy loop, with
phone-to-desktop sync. Output style, preferred names, and processing rules are user
settings written in plain language, not code. The AI is DeepSeek. Next step: write the MVP
requirements (OMT PRD).

## Key Decisions

All decisions were made by the builder.

- **MVP scope is the capture-to-copy loop:** photo in, text out, copy button. Reason: close the loop first; everything else waits.
- **Output is plain text in one fixed format, with nothing extra.** Reason: it is pasted straight into Word; extra words break that.
- **Template and output format are the same thing.** One term, "template".
- **The AI writes the final text directly** from the template, the word list, and the custom instructions. Claude first proposed "AI extracts fields, code renders the text"; the builder rejected it because presentation rules (for example, how discounts are shown) change often and must live in prompts, not code. See `docs/records/decisions/ADR-002-ai-writes-final-text.md`.
- **The checker AI is out of the MVP.** It was in the builder's first description; the builder deferred it to a later version.
- **Phone-to-desktop sync is required in the MVP.** The builder called it "a very important point": the phone takes the photo, the computer shows the photo and the text.
- **Settings follow the person and persist; receipts follow the session.**
- **Sessions are manual and server-side.** Receipts are kept until the builder taps "new session". No fixed cap; only if the system cannot cope does it ask the builder to start a new session. The builder said "100" was only an example, not a requirement.
- **Rules are added with an "Add rule" button** in plain language. Two kinds: change the output, or add a preferred name or translation. The AI decides which kind. The builder said the details are not settled yet.
- **No first-run setup page in the MVP.** If no template exists when the first photo is taken, the AI's first output becomes the default template, so later output stays consistent.
- **One photo is one receipt.** Camera or photo library. Long receipts that need several photos are not supported in the MVP.
- **Partly unreadable receipts are still processed** (see Facts Learned for the three levels).
- **A "Regenerate" button runs the same photo again** with the current rules. This overturns an earlier answer in the same interview ("no regenerate button"). If the photo itself is bad, the builder retakes it.
- **New rules apply only to receipts processed after the rule was added**, or to a receipt the builder regenerates. Existing text is not changed automatically.
- **No in-app text editing.** Small fixes happen in Word.
- **No voice input.** The builder already uses other software for speech-to-text; the app takes typed text only.
- **Login is username and password** for the MVP. Biometric and Google login come later.
- **AI provider is DeepSeek, not Amazon Bedrock.** Reason: the builder has a DeepSeek API key with prepaid balance. See `docs/records/decisions/ADR-001-deepseek-for-receipt-reading.md`.
- **Framework: an isomorphic full-stack framework such as Next.js, as one standalone site.** Not a micro frontend, and not a monorepo with a separate frontend and backend.
- **Mobile-first PWA**, added to the home screen on iPhone and Xiaomi phones.
- **Hosting: the builder's own AWS account (Lambda) and the builder's own domain.**
- **Principle, cost:** use the cheapest solution that works.
- **Principle, quality:** it must be genuinely practical and robust. Long use must not make it lag, break, or show garbled text.
- **Principle, ease of use:** anyone who can take a photo and type can use it, with no technical background and no AI experience.

## Facts Learned

- Purpose: organising the builder's own spending. The text is pasted into a Word document on a computer.
- Single user for now: the builder.
- The builder's most common output, as given:
  `2026 年 10 月 1 日 Costco 超市 青菜 3.25 水 2.0 啤酒 10.0 共1234，现金`
  Parts: receipt date; merchant; items as Chinese name plus amount; `共` plus the total printed on the receipt; payment method. The `超市` (supermarket) word is a personal habit, not a required field; the builder may set it through the word list.
- `共` is followed by the total printed on the receipt, not a computed sum.
- Merchants keep their original name unless the word list says otherwise. Example: `Coles` → `红超市`; `Costco` stays `Costco`.
- Item names are translated into Chinese by default.
- Discounts must be shown clearly, but how is a rule, not code. Example: beer at 10 each, two for 15; the receipt shows minus 5. One day the builder may want `-5` shown, another day just `啤酒 2 个 15`.
- Unreadable content, three levels:
  - Whole receipt, or most of it, unreadable: show only `看不清，请重拍` ("can't read it, please retake").
  - One item fully unreadable: write `？？看不清` for that item.
  - Item name readable but price unreadable: write e.g. `西红柿 价格？？看不清`.
  - Everything readable is still output.
- The builder usually opens the app and first adds an output template, then adds preferred translations over time.
- DeepSeek API, checked against the official docs on 2026-11-15 (`https://api-docs.deepseek.com/quick_start/pricing`, `https://api-docs.deepseek.com/api/create-chat-completion`):
  - Two models: `deepseek-flash` (DeepSeek-V4.1-Flash-1017, 1M context, vision supported) and `deepseek-v4-pro` (DeepSeek-V4-Pro-0813, 1M context, vision not supported).
  - Images go in a user message content part of type `image_url`, as an `http(s)` URL or a base64 data URL. Formats: JPEG, PNG, GIF, WebP. Optional `detail`: `low`, `high`, `original`, `auto`.

### Accepted in the final restatement

Claude stated these as assumptions; the builder accepted the restatement as a whole ("broadly no problem").

- Each device logs in once and stays logged in.
- A new receipt appears on the desktop within seconds, without a manual refresh.
- The interface language is Chinese.

### Future, not MVP

- Give the app a file; it edits the file and returns it for the builder to overwrite the original.
- Multiple users, each with their own template, output style, translation preferences, and target language.
- The checker AI: a second AI that verifies the first output before it reaches the user.
- Biometric login (Face ID, fingerprint) and Google login.
- Long receipts across several photos.

## Open Questions

- [ ] Add rule: should the AI show its understanding of a rule and ask before saving it? Where does the builder see the saved rules, and how does the builder delete one? Impacts: the rule feature's design and the requirements for it.
- [ ] Which domain or subdomain hosts the app? Impacts: deployment, TLS certificate, PWA install URL.
- [ ] Does `deepseek-flash` read real receipts accurately enough? Impacts: whether one model is enough, or a stronger extraction step is needed. Needs real receipts from the builder.
- [ ] Does "Regenerate" replace the earlier text, or keep both? Claude assumed replace; the builder did not say. Impacts: the receipt list and what gets copied.
- [ ] Can the builder delete a receipt from the session, for example after retaking a bad photo? Claude suggested it; the builder did not confirm. Impacts: risk of copying the wrong entry.
- [ ] How many receipts can one session hold before the system struggles? Not a builder question; to be measured. Impacts: when to show the "start a new session" prompt.

## Action Items

- [ ] Builder: provide real receipt photos for accuracy testing.
- [ ] Builder: name the domain or subdomain for deployment.

## New Terms

| Term                | Meaning                                                                                                 | Example                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Receipt             | One photographed till receipt; one photo is one receipt                                                 | A Costco receipt dated 2026-10-01                          |
| Template            | The fixed shape of the output text. Same thing as "output format"                                       | `<date> <merchant> <item> <amount> … 共<total>，<payment>` |
| Word list           | The builder's preferred names and translations, applied to every receipt                                | `Coles` → `红超市`                                         |
| Custom instructions | Plain-language processing rules for the AI                                                              | "Show discounts as a minus amount"                         |
| Rule                | One entry added through "Add rule"; it changes the template, the word list, or the custom instructions  | "From now on, call Coles 红超市"                           |
| Session             | A server-side batch of receipts, shared by phone and desktop, kept until the builder taps "new session" | Tonight's 12 receipts                                      |
| Regenerate          | Run the same photo through the AI again with the current rules                                          | Fix a result spoiled by a bad angle                        |

## Follow-up, Same Session

Added after the record above was first written, from the builder's answers to its Open Questions.

- **"Nothing extra" means no conversational text.** The builder's example of what must never appear: "OK, this one is done, please send the next one." Text like that breaks the paste into Word. When the app is processing a receipt, the output is the receipt text and nothing else.
- **Add rule needs confirmation and a fixed home.** The builder answered "the first one is definitely needed": saved rules must have one fixed place where the user can see them and delete them. Claude reads "definitely needed" as also covering the confirm-before-saving question.
- **Domain:** the builder owns one. It is decided at deployment time, not now.
- **Delivery order:** build and test a local version first. Deploy to the cloud only after local testing passes.
- **`deepseek-flash` accuracy:** the builder uses it for other work and puts its vision accuracy at about 70–80% (recalled, not measured on receipts). Receipt accuracy will be tested.
