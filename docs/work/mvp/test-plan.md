# MVP Test Plan

> **Purpose:** What was verified for each milestone, how, and with what result.
> **Status:** Current
> **Owner:** OMT QA

## T-006: M1 Verification (with the M2 features and login built so far)

### Automated, 2026-11-15

148 unit tests green (`pnpm check:all`). Integrated run in two browsers against real AWS and
DeepSeek, as a `smoke-test-` account (WebKit with an iPhone profile over the LAN address,
Chromium on `localhost`), after T-012:

| Check                                                                                                  | Result                                                                        |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Every page redirects to `/login` and all 8 API routes answer 401 without a cookie or with a forged one | Pass                                                                          |
| A photo uploaded on the phone appears on the Mac without a reload; one photo is text in 3.5 s          | Pass (three photos uploaded one after another: all three on the Mac in 5.4 s) |
| Outputs are in the template shape, `现金` or `刷卡` at the end, no conversational text                 | Pass                                                                          |
| A photo that is not a receipt shows `看不清，请重拍` and no copy button                                | Pass                                                                          |
| Copy on the Mac equals the shown text, Chinese intact; copy over plain HTTP on the phone confirms      | Pass                                                                          |
| A rule added on the phone, then regenerate on the Mac, changes the text on both devices                | Pass                                                                          |
| A rule deleted on the rules page is gone                                                               | Pass                                                                          |
| New session clears both devices                                                                        | Pass (3.2 s)                                                                  |
| The DeepSeek key is absent from the page and all 18 scripts it loads                                   | Pass                                                                          |
| No page errors on either device                                                                        | Pass                                                                          |

Earlier per-task checks (see each completion entry in `tasks.md`): wrong account ID refused
(T-001); retry without duplicates (T-003); invalid DeepSeek key gives `failed` with a plain
message (T-004); Mac Chrome and Safari to Word identical (T-005, by the builder); 10 wrong
passwords lock the account (T-012).

### Manual, with the builder: one sitting

**Prerequisites:** the dev server running (`pnpm dev`), the Mac and the iPhone on the same
Wi-Fi, tonight's paper receipts at hand.

| #   | Step                                                                                                                 | Expected                                                              | Result |
| --- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------ |
| 1   | In your own Terminal: `pnpm exec tsx --env-file=.env.local scripts/create-user.ts`; choose a username and a password | "账户已创建"                                                          |        |
| 2   | Log in on the Mac (`http://localhost:3000`, Chrome) and on the iPhone (`http://<Mac LAN IP>:3000`, Safari)           | The receipt list, empty                                               |        |
| 3   | iPhone: 从相册选, pick about 10 receipts                                                                             | Each appears on the Mac within about 5 s, then turns into text        |        |
| 4   | Compare each text with its paper receipt                                                                             | Count: receipts fully right; wrong prices; missing items; wrong names |        |
| 5   | Mac: copy two or three, paste into Word                                                                              | Identical to the app, Chinese intact                                  |        |
| 6   | iPhone: copy one, paste into Notes                                                                                   | Identical                                                             |        |
| 7   | For a wrong name: iPhone 加规则 (e.g. "以后 V BLUE 都叫能量饮料"), 确认保存, then 重新生成 on that receipt           | The corrected text on both devices                                    |        |
| 8   | iPhone: 规则, find the rule, delete it                                                                               | Gone from the list                                                    |        |
| 9   | Close Safari and open the app again                                                                                  | Still logged in                                                       |        |
| 10  | When everything is pasted: 新 session, confirm                                                                       | Both devices empty                                                    |        |

**Record:** number of receipts; fully right; errors by kind; any conversational text (expected:
none); rough seconds per receipt.

**Result, 2026-11-15 (builder):** account created with the script, logged in on both devices,
used the app end to end once without counting each receipt: it works. Two of the builder's
format rules (no 日 after the day; three spaces after the date) were often not followed: bug
T-017, fixed and re-measured the same day (0 of 6 wrong). Reading accuracy stays as measured in
T-002 and after the format fix (`docs/knowledge/tech-conventions.md#real-receipts-t-002-2026-11-15`, G-004).

**Verdict:** M1's definition of done is met. Accepted.

### Deferred

- To T-011 (automated by QA): a session of 100 receipts; a Mac tab open for 8 hours.
- To T-015 (builder, end of the MVP): Wi-Fi off mid-upload; every check on the Xiaomi phone.
