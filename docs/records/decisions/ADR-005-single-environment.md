# ADR-005: One Environment for Development and Production

**Date:** 2026-11-15
**Status:** accepted
**Decision makers:** Builder
**Supersedes:** ADR-003, in part: the separate dev and prod resources. ADR-003's other decisions stand.

## Context

ADR-003 put local development against real AWS resources and kept them separate from the
production resources created at deployment. The builder is the only user and does not want
to run or pay for more than one environment.

## Decision

One environment. The local version on the Mac and the deployed version on Lambda use the same
table and the same bucket:

- Table `receipt-pro`
- Bucket `receipt-pro-photos-jasen`

On the Mac the app uses IAM user `receipt-pro` (profile `receipt-pro`). On Lambda it uses an
IAM role created at deployment, with the same narrow permissions.

## Consequences

- Fewer resources to create and look after.
- Data written while developing or testing is the builder's real data. A bug in local code can change real settings or receipts.
- Cost is unchanged either way: on-demand tables and S3 buckets cost nothing when idle, so a second environment would not have doubled the bill. The builder chose one environment for simplicity.

## Alternatives Considered

- **Separate dev and prod resources (ADR-003).** Keeps test data away from real data. Rejected by the builder: one user, one environment.

## Evidence

- Builder, in chat, 2026-11-15: "I don't need multiple environments; one environment is enough."
