# MVP Milestones

> **Epic:** `docs/work/mvp/README.md` · **Tasks:** `docs/work/mvp/tasks.md`
> Only M1 is committed. M2 and M3 get reprioritised as M1 teaches us things.

## M1: Local Capture-to-Copy Loop (committed)

**Status:** accepted 2026-11-15 (`docs/records/completed-work/mvp-m1.md`)

**Goal:** the builder photographs a receipt on the phone and copies its text on the Mac, with the app running locally.

**Tasks:** T-001, T-002, T-003, T-004, T-005, T-006

**Definition of done**

- A photo taken on the iPhone or Xiaomi phone appears on the Mac within 5 seconds and turns into text in the builder's template.
- Copy on the Mac, pasted into Word, gives exactly that text, Chinese included.
- No output, across the builder's real test receipts, contains conversational text.
- Unreadable receipts and failed AI calls show their plain messages, never a copy button.
- No AWS resource exists outside the personal account; the app refuses to run against any account but the personal one.
- Reading accuracy and time per receipt are measured and recorded.

## M2: Rules, Regenerate, Sessions

**Goal:** the builder shapes the output in plain language, reruns a bad result, and starts fresh batches.

**Tasks:** T-007, T-008, T-009, T-010, T-011

**Status:** T-007 to T-010 done; T-011, the verification, in backlog (the builder chose to deploy first)

**Definition of done**

- The builder adds a word entry, an instruction, and a template in plain Chinese, confirms each, and later receipts follow them.
- A repeated rule overrides the old one.
- Every rule is visible in one place and can be deleted.
- Regenerate reruns a receipt with the current rules.
- New session clears every device, photos included, after a confirmation.
- A 100-receipt session and an 8-hour open tab both stay responsive.

## M3: Login and Cloud

**Goal:** the builder uses the app from the home screen, anywhere, on the builder's own domain.

**Tasks:** T-012, T-013, T-014, T-015

**Status:** T-012 to T-014 done (the app runs on Lambda at `https://receipts.jasenpan.com`); T-015 left

**Definition of done**

- Nothing works without logging in; each device logs in once for 30 days.
- The app runs on Lambda in the personal account, on the builder's domain, over HTTPS.
- It installs to the home screen on iPhone and Xiaomi and opens full screen.
- When nobody uses it, nothing is billed by the hour.
