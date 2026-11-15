# MVP Requirements Review

**Date:** 2026-11-15
**Type:** review
**Participants:** Builder (project owner); Claude (OMT PRD)
**Source:** Builder's review of `docs/work/mvp/requirements.md` v1.0, provided in chat. Conducted in Chinese; this record is the English summary.

## Summary

The builder reviewed requirements v1.0. Login moves to the last step before cloud deployment;
the local version has no login. A rule that repeats an existing one overrides it. The builder
accepted every other assumption in v1.0. Next step: OMT Kanban.

## Key Decisions

- **Login is the last step before cloud deployment.** The local version has no login. — decided by the builder, reason: everything else first. The builder was unsure whether login served another purpose; Claude explained it does not in a single-user local version, as long as data is stored per user from the start.
- **A new rule for the same thing overrides the old one.** Example: `Coles` → `红超市`, later `Coles` → `大红超市`; from then on it is `大红超市`. — decided by the builder.
- **All other v1.0 assumptions are accepted** — the builder: "I'm satisfied with the other decisions you made." This covers: no sign-up page; login lasts 30 days and renews on use; New session asks for confirmation; Regenerate replaces the old text; the computer is a Mac with Chrome or Safari; the targets of 5-second sync, an 8-hour open tab, and 100 responsive receipts per session; deleting a single receipt is out of the MVP.

## Facts Learned

- In a local single-user version, login has no job: the DeepSeek balance is not exposed on a home network, one built-in user owns all data, and phone and computer share one server.

## Open Questions

- [ ] How long is the builder willing to wait for one receipt's text? (G-007, not answered.)

## Action Items

- [ ] Claude: store all data per user from the first task, so login can be added without data migration.
- [ ] Claude: keep local testing on the home network; no public tunnel while there is no login.

## New Terms

None.
