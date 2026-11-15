# ADR-004: Sync Devices by Polling a Session Version

**Date:** 2026-11-15
**Status:** accepted
**Decision makers:** Builder (accepted the proposed architecture)
**Supersedes:** none

## Context

S-05 needs a receipt taken on the phone to appear on the computer within 5 seconds, and a
computer tab left open for 8 hours to keep working. The app will run on Lambda and must cost
close to nothing when idle.

## Decision

Each page polls `GET /api/session?since=<version>` every 3 seconds while visible, and at once
when it becomes visible again. The session's `version` number increases on every receipt
change; an unchanged version returns a tiny `{ changed: false }`.

## Consequences

- Nothing to reconnect: a dropped request is simply the next poll. This is what keeps an 8-hour tab working.
- Works unchanged on Lambda; no extra AWS service.
- Cost: about 1,200 small requests per hour per open tab. One tab open 8 hours a day is about 290,000 requests a month, inside Lambda's monthly free request allowance, plus the matching DynamoDB reads.
- Updates arrive up to 3 seconds late, inside the 5-second target.

## Alternatives Considered

- **API Gateway WebSocket API.** Instant updates, but a second service, connection management, and reconnect handling for long-open tabs.
- **Server-sent events.** Lambda would stay running for as long as the tab is open, which is billed by duration.

## Evidence

- `docs/work/mvp/requirements.md#s-05-see-receipts-on-every-device`
- Builder accepted the architecture in chat, 2026-11-15.
