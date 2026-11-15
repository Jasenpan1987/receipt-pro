# Glossary

> **Purpose:** One meaning per term. Use these words in code, docs, and UI copy.
> **Status:** Current
> **Verified against:** Builder interview, 2026-11-15

| Term                | Meaning                                                                                                                                                        | Example                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Receipt             | One photographed till receipt. One photo is one receipt                                                                                                        | A Costco receipt dated 2026-10-01                          |
| Output text         | The plain text the AI writes for one receipt, in the template's shape                                                                                          | `2026 年 10 月 1 日 Costco 青菜 3.25 共1234，现金`         |
| Template            | The fixed shape of the output text. Same thing as "output format"                                                                                              | `<date> <merchant> <item> <amount> … 共<total>，<payment>` |
| Word list           | The user's preferred names and translations, applied to every receipt                                                                                          | `Coles` → `红超市`                                         |
| Custom instructions | Plain-language processing rules for the AI                                                                                                                     | "Show discounts as a minus amount"                         |
| Settings            | The template, word list, and custom instructions together. They belong to the user and persist                                                                 | —                                                          |
| Rule                | One plain-language entry added through **Add rule**. It changes the template, the word list, or the custom instructions                                        | "From now on, call Coles 红超市"                           |
| Session             | A server-side batch of receipts shared by all the user's devices, kept until the user taps **New session**. Not a browser session                              | Tonight's 12 receipts                                      |
| Regenerate          | Run the same photo through the AI again with the current settings                                                                                              | Fix a result spoiled by a bad angle                        |
| Checker             | Not in the MVP. A second AI that reviews the reader's output against the photo: pass, label as unsure, or send back to regenerate. The builder calls it 审核官 | Jev flags `啤酒 10.0` because the photo shows `16.0`       |
| Reader              | The AI that reads the photo and writes the output text; today `deepseek-flash`                                                                                 | —                                                          |

(source: `docs/records/meetings/2026-11-15_mvp-ideation-interview.md`)
